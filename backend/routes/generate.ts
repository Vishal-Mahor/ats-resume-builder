// ============================================================
// POST /api/generate-resume
// ============================================================
import { Router, Request, Response, NextFunction } from 'express';
import OpenAI from 'openai';
import { db } from '../utils/db';
import {
  JD_ANALYSIS_PROMPT,
  MATCH_PROFILE_PROMPT,
  RESUME_GENERATION_PROMPT,
  COVER_LETTER_PROMPT,
} from '../prompts';
import { z } from 'zod';

export const generateRouter = Router();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.2';

// ─── Validation Schema ────────────────────────────────────
const GenerateSchema = z.object({
  company_name:       z.string().min(1).max(200),
  job_title:          z.string().min(1).max(200),
  job_description:    z.string().min(50).max(8000),  // NOT stored in DB
  cover_letter_tone:  z.enum(['formal', 'modern', 'aggressive']).default('formal'),
});

// ─── Helper: call OpenAI ──────────────────────────────────
async function callOpenAI(prompt: string, expectJson = true): Promise<string> {
  const response = await client.responses.create({
    model: OPENAI_MODEL,
    input: prompt,
  });
  const text = response.output_text.trim();
  if (expectJson) {
    // Strip possible markdown code fences
    return text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  return text;
}

// ─── POST /api/generate-resume ────────────────────────────
generateRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = GenerateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const { company_name, job_title, job_description, cover_letter_tone } = parsed.data;
    const userId = (req as any).userId;

    // ── 1. Fetch complete user profile from DB ──────────────
    const [profile, experiences, projects, skills, education] = await Promise.all([
      db.query('SELECT * FROM profiles WHERE user_id = $1', [userId]),
      db.query('SELECT * FROM experiences WHERE user_id = $1 ORDER BY sort_order', [userId]),
      db.query('SELECT * FROM projects WHERE user_id = $1 ORDER BY sort_order', [userId]),
      db.query('SELECT * FROM skills WHERE user_id = $1', [userId]),
      db.query('SELECT * FROM education WHERE user_id = $1 ORDER BY sort_order', [userId]),
    ]);

    const userProfile = {
      profile: profile.rows[0] || {},
      experiences: experiences.rows,
      projects: projects.rows,
      skills: skills.rows.map((s: any) => s.name),
      education: education.rows,
    };

    // ── 2. Analyze Job Description (NOT stored) ─────────────
    const jdRaw = await callOpenAI(JD_ANALYSIS_PROMPT(job_description));
    const jdAnalysis = JSON.parse(jdRaw);

    // ── 3. Match profile vs JD ──────────────────────────────
    const matchRaw = await callOpenAI(MATCH_PROFILE_PROMPT(userProfile, jdAnalysis));
    const matchResult = JSON.parse(matchRaw);

    // ── 4. Generate resume content ──────────────────────────
    const resumeRaw = await callOpenAI(
      RESUME_GENERATION_PROMPT(userProfile, jdAnalysis, matchResult, company_name, job_title)
    );
    const resumeContent = JSON.parse(resumeRaw);

    // ── 5. Generate cover letter ────────────────────────────
    const coverLetter = await callOpenAI(
      COVER_LETTER_PROMPT(userProfile, jdAnalysis, resumeContent, company_name, job_title, cover_letter_tone),
      false
    );

    // ── 6. Persist to DB (no JD stored) ────────────────────
    const { rows: [resume] } = await db.query(
      `INSERT INTO resumes
         (user_id, company_name, job_title, resume_content, cover_letter, cover_letter_tone,
          ats_score, matched_keywords, missing_keywords, suggestions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, created_at`,
      [
        userId, company_name, job_title,
        JSON.stringify(resumeContent), coverLetter, cover_letter_tone,
        matchResult.ats_score,
        JSON.stringify(matchResult.matched_keywords),
        JSON.stringify(matchResult.missing_keywords),
        JSON.stringify(matchResult.suggestions),
      ]
    );

    res.status(201).json({
      resume_id:        resume.id,
      resume_content:   resumeContent,
      cover_letter:     coverLetter,
      ats_score:        matchResult.ats_score,
      matched_keywords: matchResult.matched_keywords,
      missing_keywords: matchResult.missing_keywords,
      suggestions:      matchResult.suggestions,
      created_at:       resume.created_at,
    });
  } catch (err) {
    next(err);
  }
});
