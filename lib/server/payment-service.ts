import { db } from '@/lib/server/db';
import crypto from 'node:crypto';
import { HttpError } from '@/lib/server/http';
import { updateUserPlan } from '@/lib/server/billing-service';

const PLUS_MONTHLY_PRICE_PAISE = 49900;

export async function createPlusPaymentLink(userId: string, origin: string) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new HttpError(500, 'Razorpay credentials are missing.');
  }

  const {
    rows: [user],
  } = await db.query<{ email: string; name?: string }>('SELECT email, name FROM users WHERE id=$1', [userId]);
  if (!user?.email) {
    throw new HttpError(400, 'User email not found for billing.');
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const callbackUrl = `${origin}/billing?upgrade=plus`;
  const payload = {
    amount: PLUS_MONTHLY_PRICE_PAISE,
    currency: 'INR',
    accept_partial: false,
    description: 'ATS Resume Builder Plus Plan - Rs 499/month',
    customer: {
      name: user.name || user.email,
      email: user.email,
    },
    notify: {
      sms: false,
      email: true,
    },
    reminder_enable: false,
    callback_url: callbackUrl,
    callback_method: 'get',
  };

  const response = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new HttpError(500, `Failed to create payment link: ${error}`);
  }

  const paymentLink = (await response.json()) as { id: string; short_url: string; status: string };

  await db.query(
    `INSERT INTO billing_transactions (user_id, provider, provider_reference_id, amount_paise, currency, status, metadata)
     VALUES ($1,'razorpay',$2,$3,'INR',$4,$5)
     ON CONFLICT(provider, provider_reference_id) DO UPDATE SET
       status=excluded.status,
       metadata=excluded.metadata,
       updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    [userId, paymentLink.id, PLUS_MONTHLY_PRICE_PAISE, paymentLink.status, JSON.stringify({ shortUrl: paymentLink.short_url })]
  );

  return { checkoutUrl: paymentLink.short_url, paymentLinkId: paymentLink.id, amountPaise: PLUS_MONTHLY_PRICE_PAISE };
}

export async function confirmPlusPayment(userId: string, paymentLinkId: string) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new HttpError(500, 'Razorpay credentials are missing.');
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const response = await fetch(`https://api.razorpay.com/v1/payment_links/${encodeURIComponent(paymentLinkId)}`, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new HttpError(500, `Failed to confirm payment status: ${error}`);
  }

  const paymentLink = (await response.json()) as {
    id: string;
    status: string;
    amount: number;
    amount_paid: number;
    currency: string;
  };

  const paid = paymentLink.status === 'paid' && Number(paymentLink.amount_paid) >= PLUS_MONTHLY_PRICE_PAISE;

  await applyPaymentLinkStatus({
    paymentLinkId: paymentLink.id,
    userId,
    status: paid ? 'paid' : paymentLink.status,
    metadata: {
      amount: paymentLink.amount,
      amountPaid: paymentLink.amount_paid,
      currency: paymentLink.currency,
      source: 'callback-confirm',
    },
  });

  if (!paid) {
    throw new HttpError(400, 'Payment is not completed yet.');
  }

  return updateUserPlan(userId, 'plus');
}

export async function handlePlusPaymentWebhook(rawBody: string, signature: string | null) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw new HttpError(500, 'Missing Razorpay webhook secret.');
  }
  if (!signature) {
    throw new HttpError(400, 'Missing Razorpay signature header.');
  }

  const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new HttpError(400, 'Invalid Razorpay webhook signature.');
  }

  const payload = JSON.parse(rawBody) as {
    event?: string;
    payload?: {
      payment_link?: { entity?: { id?: string; status?: string; amount?: number; amount_paid?: number; currency?: string } };
      payment?: { entity?: { amount?: number; amount_refunded?: number; status?: string; id?: string; notes?: Record<string, unknown> } };
    };
  };

  const paymentLinkEntity = payload.payload?.payment_link?.entity;
  const paymentLinkId = paymentLinkEntity?.id;

  if (!paymentLinkId) {
    return { processed: false, reason: 'No payment link id in payload.' };
  }

  const amountPaid = Number(paymentLinkEntity?.amount_paid ?? 0);
  const paid = payload.event === 'payment_link.paid' || amountPaid >= PLUS_MONTHLY_PRICE_PAISE;

  await applyPaymentLinkStatus({
    paymentLinkId,
    status: paid ? 'paid' : paymentLinkEntity?.status || 'created',
    metadata: {
      event: payload.event,
      amount: paymentLinkEntity?.amount,
      amountPaid,
      currency: paymentLinkEntity?.currency,
      source: 'webhook',
    },
  });

  if (paid) {
    const {
      rows: [txn],
    } = await db.query<{ user_id: string }>(
      `SELECT user_id
       FROM billing_transactions
       WHERE provider='razorpay' AND provider_reference_id=$1`,
      [paymentLinkId]
    );

    if (txn?.user_id) {
      await updateUserPlan(txn.user_id, 'plus');
    }
  }

  return { processed: true };
}

async function applyPaymentLinkStatus(input: {
  paymentLinkId: string;
  userId?: string;
  status: string;
  metadata: Record<string, unknown>;
}) {
  if (input.userId) {
    await db.query(
      `UPDATE billing_transactions
       SET status=$3,
           metadata=$4,
           updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE user_id=$1 AND provider_reference_id=$2`,
      [input.userId, input.paymentLinkId, input.status, JSON.stringify(input.metadata)]
    );
    return;
  }

  await db.query(
    `UPDATE billing_transactions
     SET status=$2,
         metadata=$3,
         updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE provider='razorpay' AND provider_reference_id=$1`,
    [input.paymentLinkId, input.status, JSON.stringify(input.metadata)]
  );
}
