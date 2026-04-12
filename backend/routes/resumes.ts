// ============================================================
// Resumes Routes — /api/resumes
// ============================================================
import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../utils/db';
import { generateResumePdf, generateCoverLetterPdf } from '../services/pdfService';

export const resumeRouter = Router();

// ─── GET /api/resumes — list all resumes for user ─────────
resumeRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { rows } = await db.query(
      `SELECT id, company_name, job_title, ats_score, status, created_at, updated_at
       FROM resumes WHERE user_id=$1 ORDER BY created_at DESC`,
      [userId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ─── GET /api/resumes/stats ───────────────────────────────
resumeRouter.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { rows: [stats] } = await db.query(
      `SELECT
         CAST(COUNT(*) AS INTEGER) AS total_resumes,
         CAST(COUNT(DISTINCT company_name) AS INTEGER) AS companies_targeted,
         CAST(ROUND(COALESCE(AVG(ats_score), 0)) AS INTEGER) AS avg_ats_score,
         COALESCE(MAX(ats_score), 0) AS best_score
       FROM resumes WHERE user_id=$1`,
      [userId]
    );
    res.json(stats);
  } catch (err) { next(err); }
});

// ─── GET /api/resumes/:id ─────────────────────────────────
resumeRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { rows: [resume] } = await db.query(
      'SELECT * FROM resumes WHERE id=$1 AND user_id=$2',
      [req.params.id, userId]
    );
    if (!resume) return res.status(404).json({ error: 'Resume not found' });
    res.json(resume);
  } catch (err) { next(err); }
});

// ─── PUT /api/resumes/:id ─────────────────────────────────
resumeRouter.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { resume_content, cover_letter, status } = req.body;

    const { rows: [resume] } = await db.query(
      `UPDATE resumes SET
         resume_content = COALESCE($1, resume_content),
         cover_letter   = COALESCE($2, cover_letter),
         status         = COALESCE($3, status),
         updated_at     = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id=$4 AND user_id=$5 RETURNING *`,
      [resume_content ? JSON.stringify(resume_content) : null,
       cover_letter, status, req.params.id, userId]
    );
    if (!resume) return res.status(404).json({ error: 'Resume not found' });
    res.json(resume);
  } catch (err) { next(err); }
});

// ─── DELETE /api/resumes/:id ──────────────────────────────
resumeRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { rowCount } = await db.query(
      'DELETE FROM resumes WHERE id=$1 AND user_id=$2',
      [req.params.id, userId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Resume not found' });
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── GET /api/resumes/:id/pdf ─────────────────────────────
resumeRouter.get('/:id/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { rows: [resume] } = await db.query(
      `SELECT r.*, u.name, u.email, p.phone, p.location, p.linkedin, p.github
       FROM resumes r
       JOIN users u ON u.id = r.user_id
       LEFT JOIN profiles p ON p.user_id = r.user_id
       WHERE r.id=$1 AND r.user_id=$2`,
      [req.params.id, userId]
    );
    if (!resume) return res.status(404).json({ error: 'Resume not found' });

    const pdfBuffer = await generateResumePdf(
      { name: resume.name, email: resume.email, phone: resume.phone,
        location: resume.location, linkedin: resume.linkedin, github: resume.github },
      resume.resume_content
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${resume.company_name}-${resume.job_title}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) { next(err); }
});

// ─── GET /api/resumes/:id/cover-pdf ──────────────────────
resumeRouter.get('/:id/cover-pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { rows: [resume] } = await db.query(
      `SELECT r.*, u.name, u.email, p.phone, p.location
       FROM resumes r
       JOIN users u ON u.id = r.user_id
       LEFT JOIN profiles p ON p.user_id = r.user_id
       WHERE r.id=$1 AND r.user_id=$2`,
      [req.params.id, userId]
    );
    if (!resume) return res.status(404).json({ error: 'Resume not found' });
    if (!resume.cover_letter) return res.status(404).json({ error: 'No cover letter' });

    const pdfBuffer = await generateCoverLetterPdf(
      { name: resume.name, email: resume.email, phone: resume.phone, location: resume.location },
      resume.cover_letter, resume.company_name, resume.job_title
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${resume.company_name}-CoverLetter.pdf"`);
    res.send(pdfBuffer);
  } catch (err) { next(err); }
});
