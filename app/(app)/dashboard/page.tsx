'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { api, type DashboardSummary } from '@/lib/api';

const WORKSPACE_COUNT = 1;

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.dashboard
      .summary()
      .then(setSummary)
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const recommendationCount = summary?.atsInsights.recommendations.length ?? 0;
  const nextSteps = useMemo(() => summary?.nextSteps ?? [], [summary]);
  const readinessPercent = useMemo(
    () => clampProgress(summary?.atsInsights.profileCompletion ?? 0),
    [summary?.atsInsights.profileCompletion]
  );
  const readinessColor = useMemo(
    () => getProgressColor(readinessPercent),
    [readinessPercent]
  );

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="app-panel p-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[var(--accent)]" />
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <section className="app-panel p-10">
        <h2 className="app-subheading">
          Dashboard unavailable
        </h2>
        <p className="app-body mt-2 max-w-xl">
          We couldn’t load your dashboard right now. Try again in a moment and your latest ATS insights should appear.
        </p>
      </section>
    );
  }

  const overviewCards = [
    {
      label: 'Templates available',
      value: summary.templateCount,
      helper: 'Ready-to-use ATS-friendly layouts',
    },
    {
      label: 'Resumes created',
      value: summary.stats[0]?.value ?? 0,
      helper: 'Generated drafts in this workspace',
    },
    {
      label: 'Workspaces',
      value: WORKSPACE_COUNT,
      helper: 'Current active resume workspace',
    },
    {
      label: 'Companies targeted',
      value: summary.stats[2]?.value ?? 0,
      helper: 'Distinct companies across your drafts',
    },
  ];

  return (
    <div className="space-y-6">
        <section className="app-panel-strong overflow-hidden p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <div className="app-badge">Dashboard overview</div>
              <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-[var(--text-primary)] sm:text-5xl">
                Your resume workspace at a glance
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
                Use this dashboard to see your templates, generated resumes, profile readiness, ATS movement, and the main pages available in the workspace.
              </p>
            </div>

            <div className="app-panel-muted min-w-[260px] p-5">
              <div className="app-caption">Profile readiness</div>
              <div className="app-stat-value mt-3" style={{ color: readinessColor }}>{readinessPercent}%</div>
              <div className="mt-3 app-chip">{summary.atsInsights.profileStrength}</div>
              <div className="mt-5 h-2.5 overflow-hidden rounded-full border border-white/12 bg-white/12">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ background: readinessColor, width: '100%', transform: `scaleX(${readinessPercent / 100})`, transformOrigin: 'left center' }}
                />
              </div>
              <div className="relative mt-2 h-7 text-[10px] font-semibold text-[var(--text-dim)]">
                <span className="absolute left-0">0%</span>
                <span className="absolute right-0">100%</span>
                <span className="absolute left-[85%] top-0 -translate-x-full whitespace-nowrap">90%</span>
                <span
                  className="absolute left-[90%] top-4 h-2 w-px bg-[var(--text-dim)]/60"
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {overviewCards.map((card) => (
            <article key={card.label} className="app-panel p-5">
              <div className="app-caption">{card.label}</div>
              <div className="app-stat-value mt-4">{card.value}</div>
              <div className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{card.helper}</div>
            </article>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.9fr)]">
          <article className="app-panel p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="app-eyebrow">Analytics</div>
                <h3 className="app-subheading mt-2">
                  ATS performance summary
                </h3>
              </div>
              <Link href="/analytics" className="text-sm font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]">
                Open analytics
              </Link>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {summary.stats.map((stat) => (
                <div key={stat.label} className="app-panel-muted p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="app-caption">{stat.label}</div>
                    <TrendBadge trend={stat.trend} />
                  </div>
                  <div className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                    {stat.value}
                  </div>
                  <div className="mt-2 text-sm font-medium text-[var(--accent-strong)]">{stat.delta}</div>
                  <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{stat.helper}</div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <div className="text-sm font-semibold text-[var(--text-primary)]">Recent score trend</div>
              <div className="mt-4 grid gap-4 md:grid-cols-6">
                {summary.trend.length > 0 ? (
                  summary.trend.map((point) => (
                    <div key={point.label} className="app-panel-muted p-4">
                      <div className="flex h-32 items-end justify-center rounded-[14px] px-4 pb-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <div
                          className="w-full rounded-full"
                          style={{ background: 'var(--accent)', height: `${Math.max(point.score, 12)}%` }}
                        />
                      </div>
                      <div className="mt-3 text-sm font-semibold text-[var(--text-primary)]">{point.score}%</div>
                      <div className="text-xs uppercase tracking-[0.22em] text-[var(--text-dim)]">{point.label}</div>
                    </div>
                  ))
                ) : (
                  <div className="app-panel-muted p-6 text-sm text-[var(--text-secondary)] md:col-span-6">
                    Generate a few resumes and your ATS score trend will appear here.
                  </div>
                )}
              </div>
            </div>
          </article>

          <div className="space-y-6">
            <article className="app-panel p-6">
              <div className="app-eyebrow">Workspace details</div>
              <h3 className="app-subheading mt-2">
                User and content snapshot
              </h3>
              <div className="mt-5 space-y-3">
                {[
                  ['Templates available', `${summary.templateCount}`],
                  ['Resumes created', `${summary.stats[0]?.value ?? 0}`],
                  ['Average keyword match', `${summary.atsInsights.averageKeywordMatch}%`],
                  ['Priority recommendations', `${recommendationCount}`],
                ].map(([label, value]) => (
                  <div key={label} className="app-panel-muted flex items-center justify-between gap-4 px-4 py-3">
                    <div className="text-sm text-[var(--text-secondary)]">{label}</div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{value}</div>
                  </div>
                ))}
              </div>
            </article>

            <article className="app-panel p-6">
              <div className="app-eyebrow">Missing keywords</div>
              <h3 className="app-subheading mt-2">
                Most common ATS gaps
              </h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {summary.atsInsights.topMissingKeywords.length > 0 ? (
                  summary.atsInsights.topMissingKeywords.map((keyword) => (
                    <span key={keyword} className="app-chip">
                      {keyword}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-[var(--text-secondary)]">No repeated gaps found yet.</span>
                )}
              </div>
            </article>

            <article className="app-panel-strong p-6">
              <div className="app-eyebrow">Next steps</div>
              <h3 className="app-subheading mt-2">
                Suggested actions
              </h3>
              <div className="mt-5 space-y-3">
                {nextSteps.length > 0 ? (
                  nextSteps.map((step, index) => (
                    <div key={step} className="app-panel-muted flex items-start gap-3 px-4 py-4">
                      <div className="mt-[-1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold" style={{ background: 'var(--accent-soft)', color: 'var(--accent-strong)' }}>
                        {index + 1}
                      </div>
                      <div className="text-sm leading-6 text-[var(--text-secondary)]">{step}</div>
                    </div>
                  ))
                ) : (
                  <div className="app-panel-muted px-4 py-4 text-sm text-[var(--text-secondary)]">
                    Create a resume or analyze a job description to unlock suggestions here.
                  </div>
                )}
              </div>
            </article>
          </div>
        </section>
    </div>
  );
}

function TrendBadge({ trend }: { trend: 'up' | 'steady' | 'down' }) {
  const content =
    trend === 'up' ? { label: 'Improving', className: 'app-score-high' } :
    trend === 'down' ? { label: 'Watch', className: 'app-score-medium' } :
    { label: 'Stable', className: 'app-chip' };

  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${content.className}`}>{content.label}</span>;
}

function getProgressColor(progress: number) {
  const clamped = Math.min(100, Math.max(0, progress));
  if (clamped < 30) return '#ef4444';
  if (clamped < 60) return '#f97316';
  if (clamped < 100) return '#eab308';
  return '#22c55e';
}

function clampProgress(progress: number) {
  return Math.min(100, Math.max(0, Number.isFinite(progress) ? progress : 0));
}
