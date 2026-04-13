import { NextResponse } from 'next/server';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { handleRouteError } from '@/lib/server/http';
import { sendVerificationOtp } from '@/lib/server/verification-service';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const result = await sendVerificationOtp(userId, 'email');
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
