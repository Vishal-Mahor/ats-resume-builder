import { db } from '@/lib/server/db';
import { HttpError } from '@/lib/server/http';

export type SubscriptionPlan = 'free' | 'plus';
export type UsageType = 'resume' | 'jd-analysis';

type SubscriptionRow = {
  plan: SubscriptionPlan;
  period_start: string;
  period_end: string;
  resumes_used_in_period: number;
  jd_analyses_used_in_period: number;
};

type BillingEventRow = {
  id: string;
  event_type: string;
  plan?: SubscriptionPlan | null;
  usage_type?: UsageType | null;
  delta: number;
  metadata?: Record<string, unknown>;
  created_at: string;
};

type BillingTransactionRow = {
  id: string;
  provider: string;
  provider_reference_id: string;
  amount_paise: number;
  currency: string;
  status: string;
  metadata?: Record<string, unknown>;
  created_at: string;
};

const PLAN_LIMITS: Record<SubscriptionPlan, { resumesPerMonth: number; jdAnalysesPerMonth: number }> = {
  free: { resumesPerMonth: 1, jdAnalysesPerMonth: 1 },
  plus: { resumesPerMonth: 20, jdAnalysesPerMonth: 30 },
};

export async function getBillingSnapshot(userId: string) {
  const row = await ensureSubscriptionRow(userId);
  const events = await listBillingEvents(userId);
  const transactions = await listBillingTransactions(userId);
  return toSnapshot(row, events, transactions);
}

export async function updateUserPlan(userId: string, plan: SubscriptionPlan) {
  const current = await ensureSubscriptionRow(userId);
  await db.query(
    `UPDATE user_subscriptions
     SET plan=$2,
         updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE user_id=$1`,
    [userId, plan]
  );
  await db.query(
    `UPDATE users
     SET plan=$2,
         updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id=$1`,
    [userId, plan]
  );
  await logBillingEvent(userId, {
    eventType: 'plan-changed',
    plan,
    delta: 0,
    metadata: { from: current.plan, to: plan },
  });
  return getBillingSnapshot(userId);
}

export async function consumeUsage(userId: string, usageType: UsageType) {
  const row = await ensureSubscriptionRow(userId);
  assertWithinLimit(row, usageType);

  if (usageType === 'resume') {
    await db.query(
      `UPDATE user_subscriptions
       SET resumes_used_in_period=resumes_used_in_period + 1,
           updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE user_id=$1`,
      [userId]
    );
    await logBillingEvent(userId, {
      eventType: 'usage-consumed',
      plan: row.plan,
      usageType,
      delta: 1,
      metadata: {},
    });
  } else {
    await db.query(
      `UPDATE user_subscriptions
       SET jd_analyses_used_in_period=jd_analyses_used_in_period + 1,
           updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE user_id=$1`,
      [userId]
    );
    await logBillingEvent(userId, {
      eventType: 'usage-consumed',
      plan: row.plan,
      usageType,
      delta: 1,
      metadata: {},
    });
  }
}

export async function assertCanUse(userId: string, usageType: UsageType) {
  const row = await ensureSubscriptionRow(userId);
  assertWithinLimit(row, usageType);
}

async function ensureSubscriptionRow(userId: string) {
  const period = getCurrentPeriodBounds();
  const {
    rows: [existingUser],
  } = await db.query<{ plan?: SubscriptionPlan }>('SELECT plan FROM users WHERE id=$1', [userId]);
  const initialPlan: SubscriptionPlan = existingUser?.plan === 'plus' ? 'plus' : 'free';

  await db.query(
    `INSERT INTO user_subscriptions (user_id, plan, period_start, period_end)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT(user_id) DO NOTHING`,
    [userId, initialPlan, period.start, period.end]
  );

  const {
    rows: [row],
  } = await db.query<SubscriptionRow>(
    `SELECT plan, period_start, period_end, resumes_used_in_period, jd_analyses_used_in_period
     FROM user_subscriptions
     WHERE user_id=$1`,
    [userId]
  );

  if (!row) {
    throw new HttpError(500, 'Failed to initialize subscription state.');
  }

  const now = Date.now();
  if (Date.parse(row.period_end) <= now) {
    await db.query(
      `UPDATE user_subscriptions
       SET period_start=$2,
           period_end=$3,
           resumes_used_in_period=0,
           jd_analyses_used_in_period=0,
           updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE user_id=$1`,
      [userId, period.start, period.end]
    );

    const {
      rows: [resetRow],
    } = await db.query<SubscriptionRow>(
      `SELECT plan, period_start, period_end, resumes_used_in_period, jd_analyses_used_in_period
       FROM user_subscriptions
       WHERE user_id=$1`,
      [userId]
    );
    if (!resetRow) {
      throw new HttpError(500, 'Failed to reset subscription period.');
    }
    await logBillingEvent(userId, {
      eventType: 'period-reset',
      plan: resetRow.plan,
      delta: 0,
      metadata: { periodStart: period.start, periodEnd: period.end },
    });
    return resetRow;
  }

  return row;
}

function getCurrentPeriodBounds() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1)).toISOString();
  const end = new Date(Date.UTC(year, month + 1, 1)).toISOString();
  return { start, end };
}

function assertWithinLimit(row: SubscriptionRow, usageType: UsageType) {
  const limits = PLAN_LIMITS[row.plan];
  if (usageType === 'resume' && row.resumes_used_in_period >= limits.resumesPerMonth) {
    throw new HttpError(403, `Plan limit reached: ${limits.resumesPerMonth} resume generations allowed this month.`);
  }
  if (usageType === 'jd-analysis' && row.jd_analyses_used_in_period >= limits.jdAnalysesPerMonth) {
    throw new HttpError(403, `Plan limit reached: ${limits.jdAnalysesPerMonth} JD analyses allowed this month.`);
  }
}

async function logBillingEvent(
  userId: string,
  input: {
    eventType: string;
    plan?: SubscriptionPlan;
    usageType?: UsageType;
    delta: number;
    metadata: Record<string, unknown>;
  }
) {
  await db.query(
    `INSERT INTO billing_events (user_id, event_type, plan, usage_type, delta, metadata)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [userId, input.eventType, input.plan ?? null, input.usageType ?? null, input.delta, JSON.stringify(input.metadata)]
  );
}

async function listBillingEvents(userId: string) {
  const result = await db.query<BillingEventRow>(
    `SELECT id, event_type, plan, usage_type, delta, metadata, created_at
     FROM billing_events
     WHERE user_id=$1
     ORDER BY created_at DESC
     LIMIT 30`,
    [userId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    eventType: row.event_type,
    plan: row.plan ?? undefined,
    usageType: row.usage_type ?? undefined,
    delta: row.delta,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }));
}

function toSnapshot(row: SubscriptionRow, events: Array<{
  id: string;
  eventType: string;
  plan?: SubscriptionPlan;
  usageType?: UsageType;
  delta: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}>, transactions: Array<{
  id: string;
  provider: string;
  referenceId: string;
  amountPaise: number;
  currency: string;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}>) {
  const limits = PLAN_LIMITS[row.plan];
  return {
    plan: row.plan,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    usage: {
      resumesUsed: row.resumes_used_in_period,
      jdAnalysesUsed: row.jd_analyses_used_in_period,
      resumesLimit: limits.resumesPerMonth,
      jdAnalysesLimit: limits.jdAnalysesPerMonth,
    },
    plans: {
      free: PLAN_LIMITS.free,
      plus: PLAN_LIMITS.plus,
    },
    events,
    transactions,
  };
}

async function listBillingTransactions(userId: string) {
  const result = await db.query<BillingTransactionRow>(
    `SELECT id, provider, provider_reference_id, amount_paise, currency, status, metadata, created_at
     FROM billing_transactions
     WHERE user_id=$1
     ORDER BY created_at DESC
     LIMIT 30`,
    [userId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    referenceId: row.provider_reference_id,
    amountPaise: row.amount_paise,
    currency: row.currency,
    status: row.status,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }));
}
