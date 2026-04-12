import { NextResponse } from 'next/server';
import { clearRefreshTokenCookie } from '@/lib/server/auth-cookie';
import { handleRouteError } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function POST() {
  try {
    await clearRefreshTokenCookie();
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
