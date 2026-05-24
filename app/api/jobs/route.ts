import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/server/db';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { handleRouteError, HttpError } from '@/lib/server/http';

export const runtime = 'nodejs';

const jobSchema = z.object({
  company_name: z.string().trim().min(1).max(200),
  job_title: z.string().trim().min(1).max(200),
  location: z.string().trim().max(120).optional(),
  source_platform: z.string().trim().max(40).default('manual'),
  status: z.string().trim().max(40).default('saved'),
  application_link: z.string().trim().url().max(500).optional().or(z.literal('')),
});

const statusUpdateSchema = z.object({
  id: z.string().trim().min(1),
  source: z.enum(['resume', 'manual']),
  status: z.string().trim().min(1).max(40),
});

const deleteSchema = z.object({
  id: z.string().trim().min(1),
  source: z.enum(['resume', 'manual']),
});

const reorderSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().trim().min(1),
      source: z.enum(['resume', 'manual']),
      sort_order: z.number().int(),
    })
  ),
});

export async function GET(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const { rows } = await db.query(
      `SELECT
         'resume' AS source,
         r.id AS id,
         r.id AS resume_id,
         r.company_name,
         r.job_title,
         p.location,
         r.source_platform,
         r.status,
         NULL AS application_link,
         r.created_at,
         COALESCE(r.sort_order, 1000000000) AS sort_order
       FROM resumes r
       LEFT JOIN profiles p ON p.user_id = r.user_id
       WHERE r.user_id=$1
       UNION ALL
       SELECT
         'manual' AS source,
         j.id AS id,
         NULL AS resume_id,
         j.company_name,
         j.job_title,
         j.location,
         j.source_platform,
         j.status,
         j.application_link,
         j.created_at,
         COALESCE(j.sort_order, 1000000000) AS sort_order
       FROM job_applications j
       WHERE j.user_id=$1
       ORDER BY sort_order ASC, created_at DESC`,
      [userId]
    );

    return NextResponse.json(rows);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const body = jobSchema.parse(await request.json());
    const {
      rows: [job],
    } = await db.query(
      `INSERT INTO job_applications (user_id, company_name, job_title, location, source_platform, status, application_link, sort_order)
       VALUES (
         $1,$2,$3,$4,$5,$6,$7,
         COALESCE(
           (SELECT MIN(sort_order) - 1 FROM (
             SELECT sort_order FROM job_applications WHERE user_id=$1
             UNION ALL
             SELECT sort_order FROM resumes WHERE user_id=$1
           ) WHERE sort_order IS NOT NULL),
           0
         )
       )
       RETURNING
         'manual' AS source,
         id,
         NULL AS resume_id,
         company_name,
         job_title,
         location,
         source_platform,
         status,
         application_link,
         created_at,
         COALESCE(sort_order, 0) AS sort_order`,
      [
        userId,
        body.company_name,
        body.job_title,
        body.location || null,
        body.source_platform || 'manual',
        body.status || 'saved',
        body.application_link || null,
      ]
    );

    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const rawBody = await request.json();

    if (rawBody && Array.isArray(rawBody.items)) {
      const body = reorderSchema.parse(rawBody);

      for (const item of body.items) {
        if (item.source === 'resume') {
          await db.query(
            `UPDATE resumes
             SET sort_order=$3,
                 updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id=$1 AND user_id=$2`,
            [item.id, userId, item.sort_order]
          );
        } else {
          await db.query(
            `UPDATE job_applications
             SET sort_order=$3,
                 updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id=$1 AND user_id=$2`,
            [item.id, userId, item.sort_order]
          );
        }
      }

      return NextResponse.json({ success: true });
    }

    const body = statusUpdateSchema.parse(rawBody);

    if (body.source === 'resume') {
      const {
        rows: [job],
      } = await db.query(
        `UPDATE resumes
         SET status=$3,
             updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id=$1 AND user_id=$2
         RETURNING
           'resume' AS source,
           id,
           id AS resume_id,
           company_name,
           job_title,
           NULL AS location,
           source_platform,
           status,
           NULL AS application_link,
           created_at,
           COALESCE(sort_order, 1000000000) AS sort_order`,
        [body.id, userId, body.status]
      );

      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }

      return NextResponse.json(job);
    }

    const {
      rows: [job],
    } = await db.query(
      `UPDATE job_applications
       SET status=$3,
           updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id=$1 AND user_id=$2
       RETURNING
         'manual' AS source,
         id,
         NULL AS resume_id,
         company_name,
         job_title,
         location,
         source_platform,
         status,
         application_link,
         created_at,
         COALESCE(sort_order, 1000000000) AS sort_order`,
      [body.id, userId, body.status]
    );

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const body = deleteSchema.parse(await request.json());
    const table = body.source === 'resume' ? 'resumes' : 'job_applications';
    const { rowCount } = await db.query(`DELETE FROM ${table} WHERE id=$1 AND user_id=$2`, [body.id, userId]);

    if (!rowCount) {
      throw new HttpError(404, 'Job not found');
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
