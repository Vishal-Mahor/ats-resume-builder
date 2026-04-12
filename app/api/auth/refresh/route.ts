import { NextResponse } from 'next/server';
import { getRefreshTokenCookie } from '@/lib/server/auth-cookie';
import { signAccessToken, verifyRefreshToken } from '@/lib/server/auth-token';
import { getUserById } from '@/lib/server/auth-service';
import { handleRouteError, HttpError } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const refreshToken = await getRefreshTokenCookie();

    if (!refreshToken) {
      throw new HttpError(401, 'Missing refresh token');
    }

    const payload = verifyRefreshToken(refreshToken);
    const user = await getUserById(payload.sub);

    return NextResponse.json({
      accessToken: signAccessToken(user.id),
      user,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
