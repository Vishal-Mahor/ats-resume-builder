import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { handleRouteError } from '@/lib/server/http';
import { suggestLiveJobValues } from '@/lib/server/job-search-service';

export const runtime = 'nodejs';

const requestSchema = z.object({
  type: z.enum(['title', 'skills', 'company', 'source']),
  query: z.string().trim().min(2).max(120),
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
    requireAuthUserId(request);
    const body = requestSchema.parse(await request.json());
    const results = await suggestLiveJobValues(body);
    return NextResponse.json({ results });
  } catch (error) {
    return handleRouteError(error);
  }
}
