import bcrypt from 'bcryptjs';
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

export async function registerWithEmail(input: {
  email: string;
  password: string;
  name: string;
}) {
  const existing = await db.query<{ id: string }>('SELECT id FROM users WHERE email=$1', [input.email]);
  if (existing.rows.length) {
    throw new HttpError(409, 'Email already registered');
  }

  const hash = await bcrypt.hash(input.password, 12);
  const {
    rows: [user],
  } = await db.query<{ id: string }>(
    `INSERT INTO users (email, name, password_hash, provider, email_verified_at)
     VALUES ($1,$2,$3,'email',$4) RETURNING id`,
    [input.email, input.name, hash, new Date().toISOString()]
  );

  await db.query('INSERT INTO profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);

  return {
    accessToken: signAccessToken(user.id),
    refreshToken: signRefreshToken(user.id),
    user: {
      id: user.id,
      email: input.email,
      name: input.name,
      plan: 'free',
    },
  };
}

export async function loginWithEmail(input: { email: string; password: string }) {
  const {
    rows: [user],
  } = await db.query<{ id: string; name: string; password_hash: string | null }>(
    'SELECT id, name, password_hash FROM users WHERE email=$1 AND provider=\'email\'',
    [input.email]
  );

  if (!user?.password_hash) {
    throw new HttpError(401, 'Invalid credentials');
  }

  const valid = await bcrypt.compare(input.password, user.password_hash);
  if (!valid) {
    throw new HttpError(401, 'Invalid credentials');
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
