import { NextResponse } from 'next/server';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { handleRouteError } from '@/lib/server/http';
import { createPlusPaymentLink } from '@/lib/server/payment-service';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const origin = new URL(request.url).origin;
    const payload = await createPlusPaymentLink(userId, origin);
    return NextResponse.json(payload);
  } catch (error) {
    return handleRouteError(error);
  }
}
