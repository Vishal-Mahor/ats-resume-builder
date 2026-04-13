import { NextResponse } from 'next/server';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { handleRouteError } from '@/lib/server/http';
import { getUserSettings, upsertUserSettings, userSettingsInputSchema } from '@/lib/server/settings-service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const settings = await getUserSettings(userId);
    return NextResponse.json(settings);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const body = userSettingsInputSchema.parse(await request.json());
    const settings = await upsertUserSettings(userId, body);
    return NextResponse.json(settings);
  } catch (error) {
    return handleRouteError(error);
  }
}
