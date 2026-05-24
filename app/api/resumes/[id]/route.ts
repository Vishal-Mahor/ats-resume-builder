import { NextResponse } from 'next/server';
import { db } from '@/lib/server/db';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { handleRouteError, HttpError } from '@/lib/server/http';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const userId = requireAuthUserId(request);
    const { id } = await context.params;
    const {
      rows: [resume],
    } = await db.query('SELECT * FROM resumes WHERE id=$1 AND user_id=$2', [id, userId]);

    if (!resume) {
      throw new HttpError(404, 'Resume not found');
    }

    return NextResponse.json(resume);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const userId = requireAuthUserId(request);
    const { id } = await context.params;
    const body = (await request.json()) as {
      company_name?: string;
      job_title?: string;
      resume_content?: unknown;
      cover_letter?: string;
      status?: string;
      ats_score?: number;
      matched_keywords?: string[];
      missing_keywords?: string[];
      suggestions?: unknown[];
    };

    const {
      rows: [resume],
    } = await db.query(
      `UPDATE resumes SET
         company_name   = COALESCE($1, company_name),
         job_title      = COALESCE($2, job_title),
         resume_content = COALESCE($3, resume_content),
         cover_letter   = COALESCE($4, cover_letter),
         status         = COALESCE($5, status),
         ats_score      = COALESCE($6, ats_score),
         matched_keywords = COALESCE($7, matched_keywords),
         missing_keywords = COALESCE($8, missing_keywords),
         suggestions      = COALESCE($9, suggestions),
         updated_at     = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id=$10 AND user_id=$11 RETURNING *`,
      [
        body.company_name?.trim() || null,
        body.job_title?.trim() || null,
        body.resume_content !== undefined ? JSON.stringify(body.resume_content) : null,
        body.cover_letter,
        body.status,
        body.ats_score ?? null,
        body.matched_keywords !== undefined ? JSON.stringify(body.matched_keywords) : null,
        body.missing_keywords !== undefined ? JSON.stringify(body.missing_keywords) : null,
        body.suggestions !== undefined ? JSON.stringify(body.suggestions) : null,
        id,
        userId,
      ]
    );

    if (!resume) {
      throw new HttpError(404, 'Resume not found');
    }

    return NextResponse.json(resume);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const userId = requireAuthUserId(request);
    const { id } = await context.params;
    const { rowCount } = await db.query('DELETE FROM resumes WHERE id=$1 AND user_id=$2', [id, userId]);

    if (!rowCount) {
      throw new HttpError(404, 'Resume not found');
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
