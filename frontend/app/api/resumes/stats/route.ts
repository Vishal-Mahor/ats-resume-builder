import { NextResponse } from 'next/server';
import { db } from '@/lib/server/db';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { handleRouteError } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const {
      rows: [stats],
    } = await db.query(
      `SELECT
         CAST(COUNT(*) AS INTEGER) AS total_resumes,
         CAST(COUNT(DISTINCT company_name) AS INTEGER) AS companies_targeted,
         CAST(ROUND(COALESCE(AVG(ats_score), 0)) AS INTEGER) AS avg_ats_score,
         COALESCE(MAX(ats_score), 0) AS best_score
       FROM resumes WHERE user_id=$1`,
      [userId]
    );

    return NextResponse.json(stats);
  } catch (error) {
    return handleRouteError(error);
  }
}
