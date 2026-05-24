import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/server/db';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { handleRouteError } from '@/lib/server/http';
import { getFullProfile } from '@/lib/server/profile-service';
import { createDraftResume, createResumeContentFromProfile } from '@/lib/server/resume-draft-service';
import type { ResumeContent } from '@/lib/api';

export const runtime = 'nodejs';

const createResumeSchema = z.object({
  resume_name: z.string().trim().min(1).max(200),
  job_title: z.string().trim().min(1).max(200),
  template_id: z.string().trim().min(1).max(80),
  source_platform: z.string().trim().max(40).default('manual'),
  use_profile: z.boolean().default(false),
  resume_content: z.unknown().optional(),
});

export async function GET(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const { rows } = await db.query(
      `SELECT r.id, r.company_name, r.job_title, r.source_platform, r.template_id, r.ats_score, r.status, r.created_at, r.updated_at, r.resume_content,
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

export async function POST(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const body = createResumeSchema.parse(await request.json());
    const profile = body.use_profile ? await getFullProfile(userId) : null;
    const resume = await createDraftResume({
      userId,
      resumeName: body.resume_name,
      jobTitle: body.job_title,
      templateId: body.template_id,
      sourcePlatform: body.source_platform,
      content: body.resume_content
        ? body.resume_content as ResumeContent
        : profile
          ? createResumeContentFromProfile(profile, body.job_title)
          : undefined,
    });

    return NextResponse.json(resume, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
