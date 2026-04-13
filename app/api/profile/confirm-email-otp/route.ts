import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { handleRouteError } from '@/lib/server/http';
import { confirmVerificationOtp } from '@/lib/server/verification-service';

export const runtime = 'nodejs';

const schema = z.object({
  code: z.string().trim().length(6),
});

export async function POST(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const body = schema.parse(await request.json());
    const profile = await confirmVerificationOtp(userId, 'email', body.code);
    return NextResponse.json(profile);
  } catch (error) {
    return handleRouteError(error);
  }
}
