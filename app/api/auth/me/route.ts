import { NextResponse } from 'next/server';
import { getUserById } from '@/lib/server/auth-service';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { handleRouteError } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const user = await getUserById(userId);
    return NextResponse.json(user);
  } catch (error) {
    return handleRouteError(error);
  }
}
