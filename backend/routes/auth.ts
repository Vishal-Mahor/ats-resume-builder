// ============================================================
// Auth Routes — /api/auth
// Supports: Email/Password, Google OAuth, GitHub OAuth
// ============================================================
import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../utils/db';
import { z } from 'zod';

export const authRouter = Router();

const JWT_SECRET   = process.env.JWT_SECRET!;
const JWT_EXPIRES  = process.env.JWT_EXPIRES || '7d';

function signToken(userId: string) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES as any });
}

// ─── POST /api/auth/register ──────────────────────────────
authRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name } = z.object({
      email:    z.string().email(),
      password: z.string().min(8),
      name:     z.string().min(1).max(100),
    }).parse(req.body);

    const existing = await db.query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rows.length) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 12);
    const { rows: [user] } = await db.query(
      `INSERT INTO users (email, name, password_hash, provider)
       VALUES ($1,$2,$3,'email') RETURNING id`,
      [email, name, hash]
    );

    // Create empty profile row
    await db.query('INSERT INTO profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);

    res.status(201).json({ token: signToken(user.id), user: { id: user.id, email, name } });
  } catch (err) { next(err); }
});

// ─── POST /api/auth/login ─────────────────────────────────
authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = z.object({
      email:    z.string().email(),
      password: z.string(),
    }).parse(req.body);

    const { rows: [user] } = await db.query(
      'SELECT id, name, password_hash FROM users WHERE email=$1 AND provider=\'email\'',
      [email]
    );
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({ token: signToken(user.id), user: { id: user.id, email, name: user.name } });
  } catch (err) { next(err); }
});

// ─── POST /api/auth/oauth ─────────────────────────────────
// Called by NextAuth.js after Google/GitHub OAuth callback
// NextAuth sends the provider profile here to issue our JWT
authRouter.post('/oauth', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider, provider_id, email, name, avatar_url } = z.object({
      provider:    z.enum(['google', 'github']),
      provider_id: z.string(),
      email:       z.string().email(),
      name:        z.string().optional().nullable(),
      avatar_url:  z.string().url().optional().nullable(),
    }).parse(req.body);

    // Upsert user
    const { rows: [user] } = await db.query(
      `INSERT INTO users (email, name, avatar_url, provider, provider_id)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (email) DO UPDATE
         SET provider=$4,
             provider_id=$5,
             avatar_url=COALESCE($3, users.avatar_url),
             updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       RETURNING id, name`,
      [email, name ?? email.split('@')[0], avatar_url ?? null, provider, provider_id]
    );

    await db.query('INSERT INTO profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);

    res.json({ token: signToken(user.id), user: { id: user.id, email, name: user.name } });
  } catch (err) { next(err); }
});

// ─── GET /api/auth/me ─────────────────────────────────────
authRouter.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token' });

    const { sub } = jwt.verify(token, JWT_SECRET) as { sub: string };
    const { rows: [user] } = await db.query(
      'SELECT id, email, name, avatar_url, plan FROM users WHERE id=$1',
      [sub]
    );
    if (!user) return res.status(401).json({ error: 'User not found' });

    res.json(user);
  } catch (err) { next(err); }
});
