import { NextResponse } from 'next/server';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { handleRouteError } from '@/lib/server/http';
import { getFullProfile, profileInputSchema, upsertFullProfile } from '@/lib/server/profile-service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const profile = await getFullProfile(userId);
    return NextResponse.json(profile);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const body = profileInputSchema.parse(await request.json());
    const profile = await upsertFullProfile(userId, body);
    return NextResponse.json(profile);
  } catch (error) {
    return handleRouteError(error);
  }
}
