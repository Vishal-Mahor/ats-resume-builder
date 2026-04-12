// ============================================================
// Profile Routes — /api/profile
// ============================================================
import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../utils/db';
import { z } from 'zod';

export const profileRouter = Router();

// ─── GET /api/profile ─────────────────────────────────────
profileRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;

    const [profile, experiences, projects, skills, education] = await Promise.all([
      db.query('SELECT * FROM profiles WHERE user_id=$1', [userId]),
      db.query('SELECT * FROM experiences WHERE user_id=$1 ORDER BY sort_order, created_at DESC', [userId]),
      db.query('SELECT * FROM projects WHERE user_id=$1 ORDER BY sort_order, created_at DESC', [userId]),
      db.query('SELECT name, category FROM skills WHERE user_id=$1 ORDER BY created_at', [userId]),
      db.query('SELECT * FROM education WHERE user_id=$1 ORDER BY sort_order', [userId]),
    ]);

    res.json({
      ...(profile.rows[0] || {}),
      experiences: experiences.rows,
      projects:    projects.rows,
      skills:      skills.rows.map((s: any) => s.name),
      education:   education.rows,
    });
  } catch (err) { next(err); }
});

// ─── PUT /api/profile ─────────────────────────────────────
// Upserts basic profile info + replaces skills/exp/projects/education
profileRouter.put('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;

    const ProfileSchema = z.object({
      phone:       z.string().max(30).optional(),
      location:    z.string().max(100).optional(),
      linkedin:    z.string().max(200).optional(),
      github:      z.string().max(200).optional(),
      website:     z.string().max(200).optional(),
      summary:     z.string().max(1000).optional(),
      skills:      z.array(z.string().max(80)).max(60).optional(),
      experiences: z.array(z.object({
        id:         z.string().max(64).optional(),
        job_title:  z.string().max(200),
        company:    z.string().max(200),
        location:   z.string().max(100).optional(),
        start_date: z.string().max(20),
        end_date:   z.string().max(20).optional(),
        is_current: z.boolean().default(false),
        bullets:    z.array(z.string().max(500)).max(10),
        sort_order: z.number().int().default(0),
      })).optional(),
      projects: z.array(z.object({
        id:          z.string().max(64).optional(),
        name:        z.string().max(200),
        tech_stack:  z.string().max(300).optional(),
        url:         z.string().max(300).optional(),
        description: z.string().max(1000),
        sort_order:  z.number().int().default(0),
      })).optional(),
      education: z.array(z.object({
        id:          z.string().max(64).optional(),
        degree:      z.string().max(200),
        institution: z.string().max(200),
        field:       z.string().max(100).optional(),
        year:        z.string().max(10),
        gpa:         z.string().max(20).optional(),
        sort_order:  z.number().int().default(0),
      })).optional(),
    });

    const data = ProfileSchema.parse(req.body);

    // Upsert base profile
    await db.query(
      `INSERT INTO profiles (user_id, phone, location, linkedin, github, website, summary)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (user_id) DO UPDATE SET
         phone=$2,
         location=$3,
         linkedin=$4,
         github=$5,
         website=$6,
         summary=$7,
         updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      [userId, data.phone, data.location, data.linkedin, data.github, data.website, data.summary]
    );

    // Replace skills (delete + re-insert for simplicity)
    if (data.skills !== undefined) {
      await db.query('DELETE FROM skills WHERE user_id=$1', [userId]);
      for (const skill of data.skills) {
        await db.query(
          'INSERT INTO skills (user_id, name) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [userId, skill]
        );
      }
    }

    // Replace experiences
    if (data.experiences !== undefined) {
      await db.query('DELETE FROM experiences WHERE user_id=$1', [userId]);
      for (const exp of data.experiences) {
        await db.query(
          `INSERT INTO experiences (user_id, job_title, company, location, start_date, end_date, is_current, bullets, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [userId, exp.job_title, exp.company, exp.location, exp.start_date,
           exp.end_date, exp.is_current, JSON.stringify(exp.bullets), exp.sort_order]
        );
      }
    }

    // Replace projects
    if (data.projects !== undefined) {
      await db.query('DELETE FROM projects WHERE user_id=$1', [userId]);
      for (const proj of data.projects) {
        await db.query(
          `INSERT INTO projects (user_id, name, tech_stack, url, description, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [userId, proj.name, proj.tech_stack, proj.url, proj.description, proj.sort_order]
        );
      }
    }

    // Replace education
    if (data.education !== undefined) {
      await db.query('DELETE FROM education WHERE user_id=$1', [userId]);
      for (const edu of data.education) {
        await db.query(
          `INSERT INTO education (user_id, degree, institution, field, year, gpa, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [userId, edu.degree, edu.institution, edu.field, edu.year, edu.gpa, edu.sort_order]
        );
      }
    }

    res.json({ success: true });
  } catch (err) { next(err); }
});
