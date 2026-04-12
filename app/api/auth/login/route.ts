import { NextResponse } from 'next/server';
import { z } from 'zod';
import { loginWithEmail } from '@/lib/server/auth-service';
import { setRefreshTokenCookie } from '@/lib/server/auth-cookie';
import { handleRouteError } from '@/lib/server/http';

export const runtime = 'nodejs';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());
    const result = await loginWithEmail(body);
    await setRefreshTokenCookie(result.refreshToken);
    return NextResponse.json({
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
