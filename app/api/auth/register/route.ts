import { NextResponse } from 'next/server';
import { z } from 'zod';
import { registerWithEmail } from '@/lib/server/auth-service';
import { setRefreshTokenCookie } from '@/lib/server/auth-cookie';
import { handleRouteError } from '@/lib/server/http';

export const runtime = 'nodejs';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

export async function POST(request: Request) {
  try {
    const body = registerSchema.parse(await request.json());
    const result = await registerWithEmail(body);
    await setRefreshTokenCookie(result.refreshToken);
    return NextResponse.json(
      {
        accessToken: result.accessToken,
        user: result.user,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
