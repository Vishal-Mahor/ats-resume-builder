import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { handleRouteError, HttpError } from '@/lib/server/http';
import { getBillingSnapshot, updateUserPlan } from '@/lib/server/billing-service';

export const runtime = 'nodejs';

const billingUpdateSchema = z.object({
  plan: z.enum(['free', 'plus']),
});

export async function GET(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const billing = await getBillingSnapshot(userId);
    return NextResponse.json(billing);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const body = billingUpdateSchema.parse(await request.json());
    if (body.plan === 'plus') {
      throw new HttpError(400, 'Plus upgrade requires payment checkout.');
    }
    const billing = await updateUserPlan(userId, body.plan);
    return NextResponse.json(billing);
  } catch (error) {
    return handleRouteError(error);
  }
}
