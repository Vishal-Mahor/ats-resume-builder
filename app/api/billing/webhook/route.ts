import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/server/http';
import { handlePlusPaymentWebhook } from '@/lib/server/payment-service';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const signature = request.headers.get('x-razorpay-signature');
    const rawBody = await request.text();
    const result = await handlePlusPaymentWebhook(rawBody, signature);
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    return handleRouteError(error);
  }
}
