import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { ResumeContent } from '@/lib/api';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { handleRouteError, HttpError } from '@/lib/server/http';
import { db } from '@/lib/server/db';
import { refreshResumeAtsAnalysis } from '@/lib/server/ats-service';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const schema = z.object({
  resume_content: z.any(),
});

export async function POST(request: Request, context: RouteContext) {
  try {
    const userId = requireAuthUserId(request);
    const { id } = await context.params;
    const body = schema.parse(await request.json());

    const {
      rows: [resume],
    } = await db.query<{
      matched_keywords?: string[] | string;
      missing_keywords?: string[] | string;
      suggestions?: unknown[] | string;
    }>('SELECT matched_keywords, missing_keywords, suggestions FROM resumes WHERE id=$1 AND user_id=$2', [id, userId]);

    if (!resume) {
      throw new HttpError(404, 'Resume not found');
    }

    const result = refreshResumeAtsAnalysis({
      resumeContent: body.resume_content as ResumeContent,
      matchedKeywords: parseJsonArray<string>(resume.matched_keywords),
      missingKeywords: parseJsonArray<string>(resume.missing_keywords),
      suggestions: parseJsonArray<{ action: string; impact_pct: number; reason: string }>(resume.suggestions),
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

function parseJsonArray<T>(value: unknown) {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}
