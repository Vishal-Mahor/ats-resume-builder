'use client';

import { BotMessageSquare, CreditCard, FileText, Stars } from 'lucide-react';
import type React from 'react';
import type { BillingSnapshot } from '@/lib/api';

type TokenCardConfig = {
  title: string;
  description: string;
  used: number;
  limit: number;
  icon: React.ReactNode;
  tone: 'blue' | 'green' | 'orange' | 'purple';
};

const toneStyles = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-emerald-50 text-emerald-600',
  orange: 'bg-orange-50 text-orange-600',
  purple: 'bg-purple-50 text-purple-600',
};

export function BillingUsagePanel({
  billing,
  email,
  onUpgrade,
  upgrading,
  showIdentity = true,
}: {
  billing: BillingSnapshot;
  email?: string;
  onUpgrade: () => void;
  upgrading?: boolean;
  showIdentity?: boolean;
}) {
  const planLabel = billing.plan === 'plus' ? 'Pro Plan' : 'Free Plan';
  const analysisLimit = billing.usage.jdAnalysesLimit;
  const tailoringLimit = billing.usage.resumesLimit;
  const coverLetterLimit = billing.plan === 'plus' ? 100 : 3;
  const chatLimit = billing.plan === 'plus' ? 500 : 20;

  const tokenCards: TokenCardConfig[] = [
    {
      title: 'Analysis Tokens',
      description: 'Resume analysis & feedback',
      used: billing.usage.jdAnalysesUsed,
      limit: analysisLimit,
      icon: <TokenBarsIcon />,
      tone: 'blue',
    },
    {
      title: 'Tailoring Tokens',
      description: 'Job-specific customization',
      used: billing.usage.resumesUsed,
      limit: tailoringLimit,
      icon: <Stars className="h-5 w-5" strokeWidth={2} />,
      tone: 'green',
    },
    {
      title: 'Cover Letter Tokens',
      description: 'Cover letter generation',
      used: 0,
      limit: coverLetterLimit,
      icon: <FileText className="h-5 w-5" strokeWidth={2} />,
      tone: 'orange',
    },
    {
      title: 'Chat Tokens',
      description: 'AI chat messages',
      used: 0,
      limit: chatLimit,
      icon: <BotMessageSquare className="h-5 w-5" strokeWidth={2} />,
      tone: 'purple',
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1216px] space-y-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {showIdentity && (
            <h1 className="break-all text-2xl font-bold leading-tight text-[var(--text-primary)] sm:text-[26px]">
              {email || 'Account billing'}
            </h1>
          )}
          <span className="mt-2 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
            {planLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={onUpgrade}
          disabled={upgrading || billing.plan === 'plus'}
          className="inline-flex items-center justify-center gap-3 rounded-md bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white shadow-[0_8px_18px_rgba(37,99,235,0.22)] transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <CreditCard className="h-4 w-4" />
          {billing.plan === 'plus' ? 'Pro Active' : upgrading ? 'Opening...' : 'Upgrade to Pro'}
        </button>
      </section>

      <section className="space-y-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Token Usage This Month</h2>
          <div className="text-sm text-[var(--text-secondary)]">{planLabel} Limits</div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {tokenCards.map((card) => (
            <TokenUsageCard key={card.title} card={card} />
          ))}
        </div>
      </section>

      {billing.plan !== 'plus' && (
        <section className="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-emerald-50 px-6 py-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Need more tokens?</h2>
            <p className="mt-2 text-base leading-7 text-[var(--text-secondary)]">
              Upgrade to Pro for 100 analysis tokens, 100 tailoring tokens, 100 resume tokens, and 500 chat tokens per month.
            </p>
          </div>
          <button
            type="button"
            onClick={onUpgrade}
            disabled={upgrading}
            className="mt-5 inline-flex items-center justify-center rounded-md bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white shadow-[0_8px_18px_rgba(37,99,235,0.22)] transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60 sm:mt-0"
          >
            {upgrading ? 'Opening...' : 'Upgrade Now'}
          </button>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <article className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel-strong)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-sm font-semibold text-[var(--text-secondary)]">Current Plan</div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">{planLabel}</h2>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
              {billing.plan === 'plus' ? 'Active' : 'Free tier'}
            </span>
          </div>
          <div className="mt-5 space-y-3 text-sm text-[var(--text-secondary)]">
            <PlanInfoRow label="Billing cycle" value={`${formatDate(billing.periodStart)} - ${formatDate(billing.periodEnd)}`} />
            <PlanInfoRow label="Analysis limit" value={`${analysisLimit} tokens / month`} />
            <PlanInfoRow label="Tailoring limit" value={`${tailoringLimit} tokens / month`} />
          </div>
        </article>

        <article className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel-strong)] p-6 shadow-[var(--shadow-panel)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[var(--text-secondary)]">Transaction History</div>
              <h2 className="mt-2 text-xl font-bold text-[var(--text-primary)]">Payment history</h2>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {billing.transactions.length > 0 ? (
              billing.transactions.map((txn) => (
                <div key={txn.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel-muted)] px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">
                      {txn.currency} {(txn.amountPaise / 100).toFixed(2)}
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${txn.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {txn.status}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-[var(--text-secondary)]">
                    {txn.provider.toUpperCase()} · Ref: {txn.referenceId}
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-dim)]">{formatDateTime(txn.createdAt)}</div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel-muted)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                No transactions yet.
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel-strong)]">
        <div className="border-b border-[var(--border-subtle)] px-6 py-6">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Token Information</h2>
        </div>
        <div className="grid gap-8 px-6 py-6 md:grid-cols-2">
          <div>
            <h3 className="text-base font-medium text-[var(--text-primary)]">How Tokens Work</h3>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-6 text-[var(--text-secondary)]">
              <li>Analysis tokens are used for resume scanning and feedback</li>
              <li>Tailoring tokens are used for job-specific resume customization</li>
              <li>Resume tokens are used for resume generation and editing</li>
              <li>Chat tokens are used for AI chatbot interactions</li>
            </ul>
          </div>
          <div>
            <h3 className="text-base font-medium text-[var(--text-primary)]">Token Refresh</h3>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              {planLabel} tokens refresh monthly on the 1st of each month.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function PlanInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-3 last:border-b-0 last:pb-0">
      <span>{label}</span>
      <span className="text-right font-semibold text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

function TokenUsageCard({ card }: { card: TokenCardConfig }) {
  const remaining = Math.max(card.limit - card.used, 0);
  const remainingPercent = card.limit > 0 ? Math.max(0, Math.min(100, Math.round((remaining / card.limit) * 100))) : 0;

  return (
    <article className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel-strong)] p-6 shadow-[var(--shadow-panel)]">
      <div className="flex items-start gap-4">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneStyles[card.tone]}`}>
          {card.icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-bold leading-6 text-[var(--text-primary)]">{card.title}</h3>
          <p className="mt-2 text-sm leading-5 text-[var(--text-secondary)]">{card.description}</p>
        </div>
      </div>

      <div className="mt-7 flex items-end justify-between gap-4">
        <div className="text-3xl font-bold leading-none text-[var(--text-primary)]">
          {remaining}
          <span className="ml-2 text-lg font-medium text-[var(--text-secondary)]">/ {card.limit}</span>
        </div>
        <div className="text-sm font-medium text-[var(--text-secondary)]">{card.used} used</div>
      </div>

      <div className="mt-5 h-3 overflow-hidden rounded-full bg-[var(--bg-track)]">
        <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${remainingPercent}%` }} />
      </div>
      <div className="mt-2 text-xs text-[var(--text-secondary)]">{remainingPercent}% remaining</div>
    </article>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function TokenBarsIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 5v14h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 16v-5M13 16V8M17 16v-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
