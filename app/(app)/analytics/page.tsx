'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, type DashboardSummary } from '@/lib/api';

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    api.dashboard
      .summary()
      .then(setSummary)
      .catch(() => toast.error('Failed to load analytics'));
  }, []);

  return (
    <div className="space-y-6">
      <section className="app-panel p-6">
        <div className="app-eyebrow">Analytics</div>
        <h2 className="app-heading mt-2">
          Review ATS performance over time
        </h2>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="app-panel p-6">
          <h3 className="app-subheading">
            ATS score trend
          </h3>
          <div className="mt-6 grid gap-4 sm:grid-cols-5">
            {summary?.trend?.length ? summary.trend.map((point) => (
              <div key={point.label} className="app-panel-muted p-4">
                <div className="flex h-36 items-end justify-center rounded-[1.25rem] px-4 pb-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="w-full rounded-full" style={{ background: 'var(--accent)', height: `${Math.max(point.score, 12)}%` }} />
                </div>
                <div className="mt-3 text-sm font-semibold text-[var(--text-primary)]">{point.score}</div>
                <div className="text-xs uppercase tracking-[0.22em] text-[var(--text-dim)]">{point.label}</div>
              </div>
            )) : <p className="text-sm text-[var(--text-secondary)] sm:col-span-5">Generate resumes to populate analytics.</p>}
          </div>
        </article>

        <article className="app-panel p-6">
          <h3 className="app-subheading">
            Keyword improvement opportunities
          </h3>
          <div className="mt-5 flex flex-wrap gap-2">
            {summary?.atsInsights.topMissingKeywords?.length ? summary.atsInsights.topMissingKeywords.map((keyword) => (
              <span key={keyword} className="app-chip">
                {keyword}
              </span>
            )) : <span className="text-sm text-[var(--text-secondary)]">No keyword trend available yet.</span>}
          </div>
        </article>
      </section>
    </div>
  );
}
