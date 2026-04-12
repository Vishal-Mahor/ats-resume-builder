import { NextResponse } from 'next/server';
import { db } from '@/lib/server/db';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { handleRouteError } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const { rows } = await db.query(
      `SELECT id, company_name, job_title, ats_score, status, created_at, updated_at
       FROM resumes WHERE user_id=$1 ORDER BY created_at DESC`,
      [userId]
    );

    return NextResponse.json(rows);
  } catch (error) {
    return handleRouteError(error);
  }
}
