'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { api, type BillingSnapshot } from '@/lib/api';

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [billing, setBilling] = useState<BillingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingPlan, setUpdatingPlan] = useState<'free' | 'plus' | null>(null);

  useEffect(() => {
    api.billing
      .get()
      .then(setBilling)
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Failed to load billing details.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const paymentLinkId =
      searchParams.get('razorpay_payment_link_id') ||
      searchParams.get('payment_link_id') ||
      searchParams.get('paymentLinkId');
    if (!paymentLinkId) return;

    let active = true;
    api.billing
      .confirmPlusPayment(paymentLinkId)
      .then((updated) => {
        if (!active) return;
        setBilling(updated);
        toast.success('Payment received. Plus plan activated.');
        router.replace('/billing');
      })
      .catch((error) => {
        if (!active) return;
        toast.error(error instanceof Error ? error.message : 'Unable to verify payment status yet.');
      });

    return () => {
      active = false;
    };
  }, [router, searchParams]);

  const usageCards = useMemo(() => {
    if (!billing) return [];
    return [
      {
        label: 'Resume generation',
        used: billing.usage.resumesUsed,
        limit: billing.usage.resumesLimit,
      },
      {
        label: 'JD analysis',
        used: billing.usage.jdAnalysesUsed,
        limit: billing.usage.jdAnalysesLimit,
      },
    ];
  }, [billing]);

  async function handlePlanSwitch(plan: 'free' | 'plus') {
    if (plan === 'plus') {
      setUpdatingPlan('plus');
      try {
        const checkout = await api.billing.createPlusCheckout();
        window.location.href = checkout.checkoutUrl;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to open payment gateway.');
      } finally {
        setUpdatingPlan(null);
      }
      return;
    }

    setUpdatingPlan(plan);
    try {
      const updated = await api.billing.updatePlan(plan);
      setBilling(updated);
      toast.success('Switched to Free plan.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update plan.');
    } finally {
      setUpdatingPlan(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="app-panel p-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[var(--accent)]" />
        </div>
      </div>
    );
  }

  if (!billing) {
    return (
      <section className="app-panel p-8">
        <h2 className="app-subheading">Billing unavailable</h2>
        <p className="app-body mt-3">Unable to load your plan right now. Please retry in a moment.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="app-panel p-6 sm:p-7">
        <div className="app-badge">Billing & subscription</div>
        <h2 className="app-heading mt-4">Choose your workspace plan</h2>
        <p className="app-body mt-3 max-w-3xl">
          Limits apply only to resume generation and JD analysis. All other product capabilities remain unlimited across plans.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <PlanCard
          title="Free"
          active={billing.plan === 'free'}
          limits="1 resume generation / month · 1 JD analysis / month"
          onSelect={() => handlePlanSwitch('free')}
          loading={updatingPlan === 'free'}
          ctaLabel="Switch to Free"
        />
        <PlanCard
          title="Plus"
          active={billing.plan === 'plus'}
          limits="Rs 499/month · 20 resume generations / month · 30 JD analyses / month"
          onSelect={() => handlePlanSwitch('plus')}
          loading={updatingPlan === 'plus'}
          ctaLabel="Pay Rs 499 & Upgrade"
        />
      </section>

      <section className="app-panel p-6">
        <div className="app-eyebrow">Current cycle usage</div>
        <h3 className="app-subheading mt-2">
          {new Date(billing.periodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
          {new Date(billing.periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </h3>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {usageCards.map((item) => {
            const percent = item.limit > 0 ? Math.min(100, Math.round((item.used / item.limit) * 100)) : 0;
            return (
              <div key={item.label} className="app-panel-muted p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-[var(--text-primary)]">{item.label}</div>
                  <div className="text-sm font-semibold text-[var(--text-secondary)]">
                    {item.used} / {item.limit}
                  </div>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full border border-white/12 bg-white/12">
                  <div
                    className="h-full rounded-full"
                    style={{ background: 'var(--accent)', width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="app-panel p-6">
        <div className="app-eyebrow">Audit trail</div>
        <h3 className="app-subheading mt-2">Billing event history</h3>
        <div className="mt-5 space-y-3">
          {billing.events.length > 0 ? (
            billing.events.map((event) => (
              <div key={event.id} className="app-panel-muted px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-semibold text-[var(--text-primary)]">
                    {event.eventType === 'plan-changed'
                      ? `Plan changed to ${(event.plan || '').toUpperCase()}`
                      : event.eventType === 'usage-consumed'
                        ? `Usage consumed: ${event.usageType}`
                        : 'Billing period reset'}
                  </div>
                  <div className="text-xs text-[var(--text-dim)]">
                    {new Date(event.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="app-panel-muted px-4 py-3 text-sm text-[var(--text-secondary)]">
              No billing events yet.
            </div>
          )}
        </div>
      </section>

      <section className="app-panel p-6">
        <div className="app-eyebrow">Transactions</div>
        <h3 className="app-subheading mt-2">Payment history</h3>
        <div className="mt-5 space-y-3">
          {billing.transactions.length > 0 ? (
            billing.transactions.map((txn) => (
              <div key={txn.id} className="app-panel-muted px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-semibold text-[var(--text-primary)]">
                    {txn.currency} {(txn.amountPaise / 100).toFixed(2)}
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${txn.status === 'paid' ? 'app-score-high' : 'app-chip'}`}>
                    {txn.status}
                  </span>
                </div>
                <div className="mt-2 text-xs text-[var(--text-secondary)]">
                  {txn.provider.toUpperCase()} • Ref: {txn.referenceId}
                </div>
                <div className="mt-1 text-[11px] text-[var(--text-dim)]">
                  {new Date(txn.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </div>
              </div>
            ))
          ) : (
            <div className="app-panel-muted px-4 py-3 text-sm text-[var(--text-secondary)]">
              No transactions yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function PlanCard({
  title,
  limits,
  active,
  onSelect,
  loading,
  ctaLabel,
}: {
  title: string;
  limits: string;
  active: boolean;
  onSelect: () => void;
  loading: boolean;
  ctaLabel: string;
}) {
  return (
    <article
      className="app-panel p-6"
      style={{
        borderColor: active ? 'var(--border-strong)' : undefined,
        boxShadow: active ? '0 0 0 1px rgba(255,255,255,0.08) inset' : undefined,
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="app-subheading">{title}</h3>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${active ? 'app-score-high' : 'app-chip'}`}>
          {active ? 'Current plan' : 'Available'}
        </span>
      </div>
      <p className="app-body mt-4">{limits}</p>
      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
        All other features remain unlimited regardless of plan.
      </p>
      <button
        type="button"
        onClick={onSelect}
        disabled={active || loading}
        className="app-button-primary mt-5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {active ? 'Selected' : loading ? 'Processing...' : ctaLabel}
      </button>
    </article>
  );
}
