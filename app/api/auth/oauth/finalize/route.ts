import { NextResponse } from 'next/server';
import { z } from 'zod';
import { setRefreshTokenCookie } from '@/lib/server/auth-cookie';
import { verifyRefreshToken } from '@/lib/server/auth-token';
import { handleRouteError } from '@/lib/server/http';

export const runtime = 'nodejs';

const finalizeSchema = z.object({
  refreshToken: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = finalizeSchema.parse(await request.json());
    verifyRefreshToken(body.refreshToken);
    await setRefreshTokenCookie(body.refreshToken);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
