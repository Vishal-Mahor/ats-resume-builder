import { z } from 'zod';
import { db } from './db';

export const profileInputSchema = z.object({
  phone: z.string().max(30).optional(),
  location: z.string().max(100).optional(),
  linkedin: z.string().max(200).optional(),
  github: z.string().max(200).optional(),
  website: z.string().max(200).optional(),
  summary: z.string().max(1000).optional(),
  skills: z.array(z.string().max(80)).max(60).optional(),
  experiences: z
    .array(
      z.object({
        id: z.string().max(64).optional(),
        job_title: z.string().max(200),
        company: z.string().max(200),
        location: z.string().max(100).optional(),
        start_date: z.string().max(20),
        end_date: z.string().max(20).optional(),
        is_current: z.boolean().default(false),
        bullets: z.array(z.string().max(500)).max(10),
        sort_order: z.number().int().default(0),
      })
    )
    .optional(),
  projects: z
    .array(
      z.object({
        id: z.string().max(64).optional(),
        name: z.string().max(200),
        tech_stack: z.string().max(300).optional(),
        url: z.string().max(300).optional(),
        description: z.string().max(1000),
        sort_order: z.number().int().default(0),
      })
    )
    .optional(),
  education: z
    .array(
      z.object({
        id: z.string().max(64).optional(),
        degree: z.string().max(200),
        institution: z.string().max(200),
        field: z.string().max(100).optional(),
        year: z.string().max(10),
        gpa: z.string().max(20).optional(),
        sort_order: z.number().int().default(0),
      })
    )
    .optional(),
});

export async function getFullProfile(userId: string) {
  const [profile, experiences, projects, skills, education] = await Promise.all([
    db.query('SELECT * FROM profiles WHERE user_id=$1', [userId]),
    db.query('SELECT * FROM experiences WHERE user_id=$1 ORDER BY sort_order, created_at DESC', [userId]),
    db.query('SELECT * FROM projects WHERE user_id=$1 ORDER BY sort_order, created_at DESC', [userId]),
    db.query<{ name: string }>('SELECT name, category FROM skills WHERE user_id=$1 ORDER BY created_at', [userId]),
    db.query('SELECT * FROM education WHERE user_id=$1 ORDER BY sort_order', [userId]),
  ]);

  return {
    ...(profile.rows[0] || {}),
    experiences: experiences.rows,
    projects: projects.rows,
    skills: skills.rows.map((skill) => skill.name),
    education: education.rows,
  };
}

export async function upsertFullProfile(userId: string, input: z.infer<typeof profileInputSchema>) {
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
    [userId, input.phone, input.location, input.linkedin, input.github, input.website, input.summary]
  );

  if (input.skills !== undefined) {
    await db.query('DELETE FROM skills WHERE user_id=$1', [userId]);
    for (const skill of input.skills) {
      await db.query(
        'INSERT INTO skills (user_id, name) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [userId, skill]
      );
    }
  }

  if (input.experiences !== undefined) {
    await db.query('DELETE FROM experiences WHERE user_id=$1', [userId]);
    for (const experience of input.experiences) {
      await db.query(
        `INSERT INTO experiences (user_id, job_title, company, location, start_date, end_date, is_current, bullets, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          userId,
          experience.job_title,
          experience.company,
          experience.location,
          experience.start_date,
          experience.end_date,
          experience.is_current,
          JSON.stringify(experience.bullets),
          experience.sort_order,
        ]
      );
    }
  }

  if (input.projects !== undefined) {
    await db.query('DELETE FROM projects WHERE user_id=$1', [userId]);
    for (const project of input.projects) {
      await db.query(
        `INSERT INTO projects (user_id, name, tech_stack, url, description, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [userId, project.name, project.tech_stack, project.url, project.description, project.sort_order]
      );
    }
  }

  if (input.education !== undefined) {
    await db.query('DELETE FROM education WHERE user_id=$1', [userId]);
    for (const entry of input.education) {
      await db.query(
        `INSERT INTO education (user_id, degree, institution, field, year, gpa, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [userId, entry.degree, entry.institution, entry.field, entry.year, entry.gpa, entry.sort_order]
      );
    }
  }

  return getFullProfile(userId);
}
