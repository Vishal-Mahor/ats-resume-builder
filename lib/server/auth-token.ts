import jwt from 'jsonwebtoken';
import { HttpError } from './http';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error('Missing JWT_SECRET or NEXTAUTH_SECRET');
  }

  return secret;
}

export function signAccessToken(userId: string) {
  return jwt.sign({ sub: userId }, getJwtSecret(), {
    expiresIn: (process.env.JWT_EXPIRES || '7d') as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, getJwtSecret()) as { sub: string };
}

export function requireAuthUserId(request: Request) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Missing or invalid Authorization header');
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    return payload.sub;
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }
}
