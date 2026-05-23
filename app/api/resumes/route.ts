import { NextResponse } from 'next/server';
import { db } from '@/lib/server/db';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { handleRouteError } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const { rows } = await db.query(
      `SELECT r.id, r.company_name, r.job_title, r.source_platform, r.template_id, r.ats_score, r.status, r.created_at, r.updated_at,
              p.location
       FROM resumes r
       LEFT JOIN profiles p ON p.user_id = r.user_id
       WHERE r.user_id=$1
       ORDER BY r.created_at DESC`,
      [userId]
    );

    return NextResponse.json(rows);
  } catch (error) {
    return handleRouteError(error);
  }
}
