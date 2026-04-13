import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { db } from './db';
import { HttpError } from './http';
import { signAccessToken, signRefreshToken } from './auth-token';

type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  plan?: string;
};

const OTP_TTL_MINUTES = 10;

function generateOtp() {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

function hashCode(code: string) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function expirationTimestamp() {
  return new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();
}

async function invalidateOpenEmailCodes(userId: string) {
  await db.query(
    `UPDATE verification_codes
     SET consumed_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE user_id=$1 AND channel='email' AND consumed_at IS NULL`,
    [userId]
  );
}

async function sendRegistrationEmailOtp(target: string, code: string) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM_EMAIL;

  if (!host || !user || !pass || !from) {
    throw new HttpError(500, 'Missing SMTP configuration');
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to: target,
    subject: 'Verify your ATS Resume Builder account',
    text: `Your signup verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`,
    html: `<p>Your signup verification code is <strong>${code}</strong>.</p><p>It expires in ${OTP_TTL_MINUTES} minutes.</p>`,
  });
}

export async function registerWithEmail(input: {
  email: string;
  password: string;
  name: string;
}) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const existing = await db.query<{ id: string; provider: string; email_verified_at?: string | null }>(
    'SELECT id, provider, email_verified_at FROM users WHERE email=$1',
    [normalizedEmail]
  );
  if (existing.rows.length && existing.rows[0].provider !== 'email') {
    throw new HttpError(409, 'Email already registered');
  }

  const hash = await bcrypt.hash(input.password, 12);
  let userId = existing.rows[0]?.id;

  if (userId) {
    await db.query(
      `UPDATE users
       SET name=$2,
           password_hash=$3,
           provider='email',
           email_verified_at=NULL,
           updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id=$1`,
      [userId, input.name, hash]
    );
  } else {
    const {
      rows: [user],
    } = await db.query<{ id: string }>(
      `INSERT INTO users (email, name, password_hash, provider, email_verified_at)
       VALUES ($1,$2,$3,'email',NULL) RETURNING id`,
      [normalizedEmail, input.name, hash]
    );
    userId = user.id;
  }

  await db.query('INSERT INTO profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
  await invalidateOpenEmailCodes(userId);

  const code = generateOtp();
  await db.query(
    `INSERT INTO verification_codes (user_id, channel, target, code_hash, expires_at)
     VALUES ($1,'email',$2,$3,$4)`,
    [userId, normalizedEmail, hashCode(code), expirationTimestamp()]
  );
  await sendRegistrationEmailOtp(normalizedEmail, code);

  return {
    sent: true,
  };
}

export async function confirmRegistrationEmailOtp(input: { email: string; code: string }) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const {
    rows: [user],
  } = await db.query<{ id: string; name: string; plan?: string }>(
    `SELECT id, name, plan
     FROM users
     WHERE email=$1 AND provider='email'`,
    [normalizedEmail]
  );

  if (!user) {
    throw new HttpError(404, 'Account not found for this email.');
  }

  const {
    rows: [record],
  } = await db.query<{ id: string; target: string; code_hash: string; expires_at: string }>(
    `SELECT id, target, code_hash, expires_at
     FROM verification_codes
     WHERE user_id=$1 AND channel='email' AND consumed_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [user.id]
  );

  if (!record) {
    throw new HttpError(404, 'No active verification code found.');
  }

  if (record.target !== normalizedEmail) {
    throw new HttpError(409, 'The email changed. Request a new signup code.');
  }

  if (new Date(record.expires_at).getTime() < Date.now()) {
    throw new HttpError(410, 'Verification code expired. Request a new one.');
  }

  if (record.code_hash !== hashCode(input.code)) {
    throw new HttpError(400, 'Invalid verification code.');
  }

  await db.query(
    `UPDATE verification_codes
     SET consumed_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id=$1`,
    [record.id]
  );

  await db.query(
    `UPDATE users
     SET email_verified_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
         updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id=$1`,
    [user.id]
  );

  return {
    accessToken: signAccessToken(user.id),
    refreshToken: signRefreshToken(user.id),
    user: {
      id: user.id,
      email: normalizedEmail,
      name: user.name,
      plan: user.plan || 'free',
    },
  };
}

export async function loginWithEmail(input: { email: string; password: string }) {
  const {
    rows: [user],
  } = await db.query<{ id: string; name: string; password_hash: string | null; email_verified_at?: string | null }>(
    'SELECT id, name, password_hash, email_verified_at FROM users WHERE email=$1 AND provider=\'email\'',
    [input.email.trim().toLowerCase()]
  );

  if (!user?.password_hash) {
    throw new HttpError(401, 'Invalid credentials');
  }

  const valid = await bcrypt.compare(input.password, user.password_hash);
  if (!valid) {
    throw new HttpError(401, 'Invalid credentials');
  }
  if (!user.email_verified_at) {
    throw new HttpError(403, 'Please verify your email via OTP before signing in.');
  }

  return {
    accessToken: signAccessToken(user.id),
    refreshToken: signRefreshToken(user.id),
    user: {
      id: user.id,
      email: input.email,
      name: user.name,
      plan: 'free',
    },
  };
}

export async function upsertOAuthUser(input: {
  provider: 'google' | 'github';
  providerId: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
}) {
  const {
    rows: [user],
  } = await db.query<{ id: string; name: string; email: string; avatar_url?: string; plan: string }>(
    `INSERT INTO users (email, name, avatar_url, provider, provider_id, email_verified_at)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (email) DO UPDATE
       SET provider=$4,
           provider_id=$5,
           avatar_url=COALESCE($3, users.avatar_url),
           email_verified_at=COALESCE(users.email_verified_at, $6),
           updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     RETURNING id, email, name, avatar_url, plan`,
    [
      input.email,
      input.name ?? input.email.split('@')[0],
      input.avatarUrl ?? null,
      input.provider,
      input.providerId,
      new Date().toISOString(),
    ]
  );

  await db.query('INSERT INTO profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);

  return {
    accessToken: signAccessToken(user.id),
    refreshToken: signRefreshToken(user.id),
    user,
  };
}

export async function getUserById(userId: string) {
  const {
    rows: [user],
  } = await db.query<AuthUser>(
    'SELECT id, email, name, avatar_url, plan FROM users WHERE id=$1',
    [userId]
  );

  if (!user) {
    throw new HttpError(401, 'User not found');
  }

  return user;
}
