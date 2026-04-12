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
      resume_content?: unknown;
      cover_letter?: string;
      status?: string;
    };

    const {
      rows: [resume],
    } = await db.query(
      `UPDATE resumes SET
         resume_content = COALESCE($1, resume_content),
         cover_letter   = COALESCE($2, cover_letter),
         status         = COALESCE($3, status),
         updated_at     = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id=$4 AND user_id=$5 RETURNING *`,
      [body.resume_content ? JSON.stringify(body.resume_content) : null, body.cover_letter, body.status, id, userId]
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
