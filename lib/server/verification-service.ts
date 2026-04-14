import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { db } from './db';
import { HttpError } from './http';
import { getFullProfile } from './profile-service';

type VerificationChannel = 'email' | 'phone';

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

async function invalidateOpenCodes(userId: string, channel: VerificationChannel) {
  await db.query(
    `UPDATE verification_codes
     SET consumed_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE user_id=$1 AND channel=$2 AND consumed_at IS NULL`,
    [userId, channel]
  );
}

async function storeCode(userId: string, channel: VerificationChannel, target: string, code: string) {
  await invalidateOpenCodes(userId, channel);
  await db.query(
    `INSERT INTO verification_codes (user_id, channel, target, code_hash, expires_at)
     VALUES ($1,$2,$3,$4,$5)`,
    [userId, channel, target, hashCode(code), expirationTimestamp()]
  );
}

async function sendEmailOtp(target: string, code: string) {
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
    subject: 'Your ATS Resume Builder verification code',
    text: `Your verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`,
    html: `<p>Your verification code is <strong>${code}</strong>.</p><p>It expires in ${OTP_TTL_MINUTES} minutes.</p>`,
  });
}

async function sendPhoneOtp(target: string, code: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_PHONE;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken) {
    throw new HttpError(500, 'Missing Twilio configuration');
  }

  const to = normalizePhoneNumberForSms(target);
  if (!to) {
    throw new HttpError(400, 'Enter phone number in international format, e.g. +91XXXXXXXXXX.');
  }

  if (verifyServiceSid) {
    const body = new URLSearchParams({
      To: to,
      Channel: 'sms',
    });

    const response = await twilioRequest(
      `https://verify.twilio.com/v2/Services/${verifyServiceSid}/Verifications`,
      accountSid,
      authToken,
      body
    );

    if (!response.ok) {
      const errorBody = await readTwilioError(response);
      if (errorBody.code === 60200 || errorBody.code === 60203) {
        throw new HttpError(400, 'Invalid phone number. Use international format like +91XXXXXXXXXX.');
      }
      throw new HttpError(
        500,
        errorBody.message
          ? `Twilio Verify error ${errorBody.code ?? 'unknown'}: ${errorBody.message}`
          : 'Failed to send Twilio Verify OTP. Please check Twilio Verify configuration.'
      );
    }

    return;
  }

  if (!from) {
    throw new HttpError(500, 'Missing Twilio phone number configuration');
  }

  const body = new URLSearchParams({
    To: to,
    From: from,
    Body: `Your ATS Resume Builder verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`,
  });

  const response = await twilioRequest(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    accountSid,
    authToken,
    body
  );

  if (!response.ok) {
    const errorBody = await readTwilioError(response);
    if (errorBody.code === 21211) {
      throw new HttpError(400, 'Invalid phone number. Use international format like +91XXXXXXXXXX.');
    }
    throw new HttpError(
      500,
      errorBody.message
        ? `Twilio SMS error ${errorBody.code ?? 'unknown'}: ${errorBody.message}`
        : 'Failed to send SMS OTP. Please check Twilio configuration and try again.'
    );
  }
}

export async function sendVerificationOtp(userId: string, channel: VerificationChannel) {
  const profile = await getFullProfile(userId);
  const target = channel === 'email' ? profile.email?.trim() : profile.phone?.trim();

  if (!target) {
    throw new HttpError(400, `Add a ${channel} value before requesting verification.`);
  }

  const code = generateOtp();

  if (channel === 'email') {
    await storeCode(userId, channel, target, code);
    await sendEmailOtp(target, code);
  } else {
    if (!process.env.TWILIO_VERIFY_SERVICE_SID) {
      await storeCode(userId, channel, target, code);
    }
    await sendPhoneOtp(target, code);
  }

  return { sent: true };
}

export async function confirmVerificationOtp(userId: string, channel: VerificationChannel, code: string) {
  const profile = await getFullProfile(userId);
  const target = channel === 'email' ? profile.email?.trim() : profile.phone?.trim();

  if (!target) {
    throw new HttpError(400, `Add a ${channel} value before verifying.`);
  }

  if (channel === 'phone' && process.env.TWILIO_VERIFY_SERVICE_SID) {
    await verifyPhoneOtpWithTwilio(target, code);
    await markPhoneVerified(userId);
    return getFullProfile(userId);
  }

  const {
    rows: [record],
  } = await db.query<{ id: string; target: string; code_hash: string; expires_at: string }>(
    `SELECT id, target, code_hash, expires_at
     FROM verification_codes
     WHERE user_id=$1 AND channel=$2 AND consumed_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, channel]
  );

  if (!record) {
    throw new HttpError(404, 'No active verification code found.');
  }

  if (record.target !== target) {
    throw new HttpError(409, `The ${channel} value changed. Request a new OTP.`);
  }

  if (new Date(record.expires_at).getTime() < Date.now()) {
    throw new HttpError(410, 'Verification code expired. Request a new OTP.');
  }

  if (record.code_hash !== hashCode(code)) {
    throw new HttpError(400, 'Invalid verification code.');
  }

  await db.query(
    `UPDATE verification_codes
     SET consumed_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id=$1`,
    [record.id]
  );

  if (channel === 'email') {
    await db.query(
      `UPDATE users
       SET email_verified_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
           updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id=$1`,
      [userId]
    );
  } else {
    await markPhoneVerified(userId);
  }

  return getFullProfile(userId);
}

async function verifyPhoneOtpWithTwilio(target: string, code: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !verifyServiceSid) {
    throw new HttpError(500, 'Missing Twilio Verify configuration');
  }

  const to = normalizePhoneNumberForSms(target);
  if (!to) {
    throw new HttpError(400, 'Enter phone number in international format, e.g. +91XXXXXXXXXX.');
  }

  const body = new URLSearchParams({
    To: to,
    Code: code,
  });

  const response = await twilioRequest(
    `https://verify.twilio.com/v2/Services/${verifyServiceSid}/VerificationCheck`,
    accountSid,
    authToken,
    body
  );

  const responseText = await response.text();
  if (!response.ok) {
    const errorBody = parseTwilioErrorText(responseText);
    if (errorBody.code === 20404) {
      throw new HttpError(500, 'Twilio Verify service not found. Check TWILIO_VERIFY_SERVICE_SID.');
    }
    throw new HttpError(
      400,
      errorBody.message
        ? `Twilio Verify error ${errorBody.code ?? 'unknown'}: ${errorBody.message}`
        : 'Invalid or expired verification code.'
    );
  }

  if (!responseText.includes('"status": "approved"') && !responseText.includes('"status":"approved"')) {
    throw new HttpError(400, 'Invalid or expired verification code.');
  }
}

async function markPhoneVerified(userId: string) {
  await db.query(
    `UPDATE profiles
     SET phone_verified_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
         updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE user_id=$1`,
    [userId]
  );
}

async function twilioRequest(url: string, accountSid: string, authToken: string, body: URLSearchParams) {
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  return fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
}

async function readTwilioError(response: Response) {
  const text = await response.text();
  return parseTwilioErrorText(text);
}

function parseTwilioErrorText(text: string) {
  try {
    const parsed = JSON.parse(text) as { code?: number; message?: string };
    return {
      code: typeof parsed.code === 'number' ? parsed.code : undefined,
      message: typeof parsed.message === 'string' ? parsed.message : text,
    };
  } catch {
    return { code: undefined, message: text };
  }
}

function normalizePhoneNumberForSms(raw: string) {
  const defaultCountryCode = process.env.TWILIO_DEFAULT_COUNTRY_CODE?.trim() || '';
  const digitsOnly = raw.replace(/[^\d+]/g, '');

  if (!digitsOnly) {
    return null;
  }

  if (digitsOnly.startsWith('+')) {
    return /^\+[1-9]\d{7,14}$/.test(digitsOnly) ? digitsOnly : null;
  }

  if (digitsOnly.startsWith('00')) {
    const normalized = `+${digitsOnly.slice(2)}`;
    return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
  }

  if (defaultCountryCode && /^\+?[1-9]\d{0,3}$/.test(defaultCountryCode)) {
    const prefix = defaultCountryCode.startsWith('+') ? defaultCountryCode : `+${defaultCountryCode}`;
    const normalized = `${prefix}${digitsOnly.replace(/^0+/, '')}`;
    return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
  }

  return null;
}
