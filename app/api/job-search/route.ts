import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { ResumeContent } from '@/lib/api';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { db } from '@/lib/server/db';
import { handleRouteError, HttpError } from '@/lib/server/http';
import { searchLiveJobs } from '@/lib/server/job-search-service';

export const runtime = 'nodejs';

const requestSchema = z.object({
  query: z.string().trim().max(200).optional(),
  mode: z.enum(['standard', 'ai']).default('standard'),
  resumeId: z.string().trim().optional(),
  pageToken: z.string().trim().optional(),
  filters: z
    .object({
      title: z.string().trim().max(120).optional(),
      location: z.string().trim().max(120).optional(),
      skills: z.string().trim().max(180).optional(),
      company: z.string().trim().max(120).optional(),
      source: z.string().trim().max(80).optional(),
      workMode: z.string().trim().max(40).optional(),
      posted: z.string().trim().max(40).optional(),
    })
    .default({}),
});

export async function POST(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const body = requestSchema.parse(await request.json());
    let aiResume: { title: string; content: ResumeContent } | undefined;

    if (body.mode === 'ai') {
      if (!body.resumeId) {
        throw new HttpError(400, 'Select a resume before searching with AI.');
      }

      const {
        rows: [resume],
      } = await db.query<{ job_title: string; resume_content: ResumeContent }>(
        'SELECT job_title, resume_content FROM resumes WHERE id=$1 AND user_id=$2',
        [body.resumeId, userId]
      );

      if (!resume) {
        throw new HttpError(404, 'Selected resume not found.');
      }

      aiResume = { title: resume.job_title, content: resume.resume_content };
    }

    const result = await searchLiveJobs({
      query: body.query,
      filters: body.filters,
      aiResume,
      pageToken: body.pageToken,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
