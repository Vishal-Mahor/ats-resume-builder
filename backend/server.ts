// ============================================================
// ATS Resume Builder — Express Backend (Node.js + TypeScript)
// ============================================================
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { authRouter } from './routes/auth';
import { profileRouter } from './routes/profile';
import { resumeRouter } from './routes/resumes';
import { generateRouter } from './routes/generate';
import { errorHandler } from './middleware/errorHandler';
import { authenticate } from './middleware/auth';

const app = express();

// ─── Security Middleware ───────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10kb' })); // prevent oversized JD payloads

// ─── Rate Limiting ────────────────────────────────────────
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
const generateLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20 }); // 20 generations/hr

app.use('/api/', apiLimiter);
app.use('/api/generate-resume', generateLimiter);

// ─── Health Check ─────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date() }));

// ─── Routes ───────────────────────────────────────────────
app.use('/api/auth',            authRouter);
app.use('/api/profile',         authenticate, profileRouter);
app.use('/api/resumes',         authenticate, resumeRouter);
app.use('/api/generate-resume', authenticate, generateRouter);

// ─── Error Handler ────────────────────────────────────────
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Server running on :${PORT}`));
}

export default app;
