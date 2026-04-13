import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { handleRouteError } from '@/lib/server/http';
import { confirmPlusPayment } from '@/lib/server/payment-service';

export const runtime = 'nodejs';

const confirmSchema = z.object({
  paymentLinkId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const body = confirmSchema.parse(await request.json());
    const snapshot = await confirmPlusPayment(userId, body.paymentLinkId);
    return NextResponse.json(snapshot);
  } catch (error) {
    return handleRouteError(error);
  }
}
