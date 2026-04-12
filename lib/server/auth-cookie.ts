import { cookies } from 'next/headers';

export const REFRESH_TOKEN_COOKIE = 'ats_refresh_token';

function getCookieSecure() {
  return process.env.NODE_ENV === 'production';
}

export async function setRefreshTokenCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(REFRESH_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: getCookieSecure(),
    path: '/',
    maxAge: 60 * 60 * 24,
  });
}

export async function clearRefreshTokenCookie() {
  const cookieStore = await cookies();
  cookieStore.set(REFRESH_TOKEN_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: getCookieSecure(),
    path: '/',
    maxAge: 0,
  });
}

export async function getRefreshTokenCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(REFRESH_TOKEN_COOKIE)?.value ?? null;
}
