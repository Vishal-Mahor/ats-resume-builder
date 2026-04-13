import { NextResponse } from 'next/server';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { handleRouteError } from '@/lib/server/http';
import { listResumeTemplates } from '@/lib/server/template-service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    requireAuthUserId(request);
    const templates = await listResumeTemplates();
    return NextResponse.json(templates);
  } catch (error) {
    return handleRouteError(error);
  }
}
