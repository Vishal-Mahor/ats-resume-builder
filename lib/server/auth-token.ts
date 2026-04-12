import jwt from 'jsonwebtoken';
import { HttpError } from './http';

type TokenKind = 'access' | 'refresh';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error('Missing JWT_SECRET or NEXTAUTH_SECRET');
  }

  return secret;
}

function getRefreshTokenSecret() {
  return process.env.JWT_REFRESH_SECRET || `${getJwtSecret()}-refresh`;
}

function signToken(userId: string, kind: TokenKind, expiresIn: jwt.SignOptions['expiresIn'], secret: string) {
  return jwt.sign({ sub: userId, typ: kind }, secret, { expiresIn });
}

export function signAccessToken(userId: string) {
  return signToken(userId, 'access', (process.env.JWT_EXPIRES || '1h') as jwt.SignOptions['expiresIn'], getJwtSecret());
}

export function signRefreshToken(userId: string) {
  return signToken(
    userId,
    'refresh',
    (process.env.JWT_REFRESH_EXPIRES || '24h') as jwt.SignOptions['expiresIn'],
    getRefreshTokenSecret()
  );
}

export function verifyAccessToken(token: string) {
  const payload = jwt.verify(token, getJwtSecret()) as { sub: string; typ?: TokenKind };
  if (payload.typ !== 'access') {
    throw new Error('Invalid token type');
  }
  return payload;
}

export function verifyRefreshToken(token: string) {
  const payload = jwt.verify(token, getRefreshTokenSecret()) as { sub: string; typ?: TokenKind };
  if (payload.typ !== 'refresh') {
    throw new Error('Invalid token type');
  }
  return payload;
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
