import { NextResponse } from 'next/server';
import { z } from 'zod';
import { confirmRegistrationEmailOtp } from '@/lib/server/auth-service';
import { setRefreshTokenCookie } from '@/lib/server/auth-cookie';
import { handleRouteError } from '@/lib/server/http';

export const runtime = 'nodejs';

const confirmSchema = z.object({
  email: z.string().email(),
  code: z.string().trim().length(6),
});

export async function POST(request: Request) {
  try {
    const body = confirmSchema.parse(await request.json());
    const result = await confirmRegistrationEmailOtp(body);
    await setRefreshTokenCookie(result.refreshToken);
    return NextResponse.json({
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
