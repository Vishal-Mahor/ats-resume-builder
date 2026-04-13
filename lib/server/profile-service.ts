import { z } from 'zod';
import { db } from './db';

export const profileInputSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().max(200).optional(),
  phone: z.string().max(30).optional(),
  location: z.string().max(100).optional(),
  linkedin: z.string().max(200).optional(),
  github: z.string().max(200).optional(),
  website: z.string().max(200).optional(),
  summary: z.string().max(1000).optional(),
  technicalSkills: z.array(z.string().max(80)).max(60).optional(),
  softSkills: z.array(z.string().max(80)).max(40).optional(),
  achievements: z.array(z.string().max(300)).max(20).optional(),
  languages: z.array(z.string().max(80)).max(20).optional(),
  hobbies: z.array(z.string().max(80)).max(20).optional(),
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
    db.query(
      `SELECT
         p.*,
         u.name,
         u.email,
         u.email_verified_at
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id=$1`,
      [userId]
    ),
    db.query('SELECT * FROM experiences WHERE user_id=$1 ORDER BY sort_order, created_at DESC', [userId]),
    db.query('SELECT * FROM projects WHERE user_id=$1 ORDER BY sort_order, created_at DESC', [userId]),
    db.query<{ name: string; category?: string }>('SELECT name, category FROM skills WHERE user_id=$1 ORDER BY created_at', [userId]),
    db.query('SELECT * FROM education WHERE user_id=$1 ORDER BY sort_order', [userId]),
  ]);

  const technicalSkills = skills.rows
    .filter((skill) => (skill.category ?? 'technical') === 'technical')
    .map((skill) => skill.name);
  const softSkills = skills.rows
    .filter((skill) => skill.category === 'soft')
    .map((skill) => skill.name);

  return {
    ...(profile.rows[0] || {}),
    experiences: experiences.rows,
    projects: projects.rows,
    technicalSkills,
    softSkills,
    skills: [...technicalSkills, ...softSkills],
    education: education.rows,
  };
}

export async function upsertFullProfile(userId: string, input: z.infer<typeof profileInputSchema>) {
  const {
    rows: [existingUser],
  } = await db.query<{ email: string; email_verified_at?: string | null }>(
    'SELECT email, email_verified_at FROM users WHERE id=$1',
    [userId]
  );

  if (input.email !== undefined && input.email !== existingUser?.email) {
    await db.query(
      `UPDATE users
       SET email=$2,
           email_verified_at=NULL,
           updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id=$1`,
      [userId, input.email]
    );
  }

  if (input.name !== undefined) {
    await db.query(
      `UPDATE users
       SET name=$2,
           updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id=$1`,
      [userId, input.name]
    );
  }

  await db.query(
    `INSERT INTO profiles (
       user_id, phone, location, linkedin, github, website, summary,
       achievements, languages, hobbies
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (user_id) DO UPDATE SET
       phone=excluded.phone,
       phone_verified_at=CASE
         WHEN profiles.phone IS excluded.phone THEN profiles.phone_verified_at
         ELSE NULL
       END,
       location=excluded.location,
       location_verified_at=CASE
         WHEN profiles.location IS excluded.location THEN profiles.location_verified_at
         ELSE NULL
       END,
       linkedin=excluded.linkedin,
       github=excluded.github,
       website=excluded.website,
       summary=excluded.summary,
       achievements=excluded.achievements,
       languages=excluded.languages,
       hobbies=excluded.hobbies,
       updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    [
      userId,
      input.phone,
      input.location,
      input.linkedin,
      input.github,
      input.website,
      input.summary,
      JSON.stringify(input.achievements ?? []),
      JSON.stringify(input.languages ?? []),
      JSON.stringify(input.hobbies ?? []),
    ]
  );

  if (input.technicalSkills !== undefined || input.softSkills !== undefined) {
    await db.query('DELETE FROM skills WHERE user_id=$1', [userId]);
    for (const skill of input.technicalSkills ?? []) {
      await db.query(
        'INSERT INTO skills (user_id, name, category) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
        [userId, skill, 'technical']
      );
    }
    for (const skill of input.softSkills ?? []) {
      await db.query(
        'INSERT INTO skills (user_id, name, category) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
        [userId, skill, 'soft']
      );
    }
  }

  if (input.experiences !== undefined) {
    await db.query('DELETE FROM experiences WHERE user_id=$1', [userId]);
    for (const experience of input.experiences) {
      const normalizedEndDate = experience.is_current ? currentDateIso() : experience.end_date;
      await db.query(
        `INSERT INTO experiences (user_id, job_title, company, location, start_date, end_date, is_current, bullets, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          userId,
          experience.job_title,
          experience.company,
          experience.location,
          experience.start_date,
          normalizedEndDate,
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

export async function verifyEmailForProfile(userId: string) {
  await db.query(
    `UPDATE users
     SET email_verified_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
         updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id=$1`,
    [userId]
  );

  return getFullProfile(userId);
}

export async function verifyPhoneForProfile(userId: string) {
  await db.query(
    `UPDATE profiles
     SET phone_verified_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
         updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE user_id=$1 AND phone IS NOT NULL AND trim(phone) <> ''`,
    [userId]
  );

  return getFullProfile(userId);
}

function currentDateIso() {
  return new Date().toISOString().slice(0, 10);
}
