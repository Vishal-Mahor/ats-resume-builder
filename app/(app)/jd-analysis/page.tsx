'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { api, type BillingSnapshot, type JDAnalysisResult } from '@/lib/api';
import { useEffect } from 'react';

export default function JDAnalysisPage() {
  const [jobDescription, setJobDescription] = useState('');
  const [analysis, setAnalysis] = useState<JDAnalysisResult | null>(null);
  const [billing, setBilling] = useState<BillingSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.billing
      .get()
      .then(setBilling)
      .catch(() => {
        // Ignore billing fetch errors here to keep analysis page usable.
      });
  }, []);

  const jdLimitReached = Boolean(
    billing && billing.plan === 'free' && billing.usage.jdAnalysesUsed >= billing.usage.jdAnalysesLimit
  );

  async function analyze() {
    if (jdLimitReached) {
      toast.error('JD analysis limit reached for Free plan. Upgrade to Plus.');
      return;
    }
    if (jobDescription.trim().length < 50) {
      toast.error('Paste a fuller job description first.');
      return;
    }

    setLoading(true);
    try {
      const result = await api.jdAnalysis({ job_description: jobDescription });
      setAnalysis(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to analyze the JD.');
    } finally {
      setLoading(false);
    }
  }

  const strategy = analysis ? getRoleStrategy(analysis) : null;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.9fr)]">
      <section className="app-panel-strong p-6 sm:p-7">
        {jdLimitReached && (
          <div className="mb-5 rounded-2xl border border-amber-300/35 bg-amber-500/12 px-4 py-3 text-sm text-amber-100">
            Free plan JD analysis limit reached.
            <a href="/billing" className="ml-2 font-semibold underline underline-offset-4">Upgrade to Plus</a>.
          </div>
        )}
        <div className="app-eyebrow">Target role analysis</div>
        <h2 className="app-heading mt-2">
          Decide whether this job is worth applying to
        </h2>
        <p className="app-body mt-3 max-w-2xl">
          Paste a job description to evaluate fit, missing proof points, seniority risk, and the best next move before creating application assets.
        </p>

        <textarea
          rows={16}
          value={jobDescription}
          onChange={(event) => setJobDescription(event.target.value)}
          placeholder="Paste the job description here."
          className="input-shell mt-6 min-h-[320px] resize-y"
        />

        <button
          type="button"
          onClick={analyze}
          disabled={loading || jdLimitReached}
          className="app-button-primary mt-5 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? 'Analyzing...' : 'Evaluate target role'}
        </button>
      </section>

      <aside className="space-y-6">
        <section className="app-panel-strong p-6">
          <div className="app-eyebrow">Application recommendation</div>
          {analysis ? (
            <>
              <div className={`mt-4 inline-flex rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] ${strategy?.className}`}>
                {strategy?.label}
              </div>
              <h3 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                {strategy?.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                {strategy?.body}
              </p>
              <div className="mt-5 app-panel-muted px-4 py-3">
                <div className="app-caption">Interview readiness</div>
                <div className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                  {analysis.atsScore}%
                </div>
                <div className="mt-2 text-sm font-semibold text-[var(--accent-strong)]">{analysis.profileMatchLabel}</div>
              </div>
              <div className="mt-5 space-y-3">
                <Metric label="Detected role" value={analysis.extractedRole} />
                <Metric label="Seniority" value={analysis.seniorityLevel} />
                <Metric label="Domain" value={analysis.domain} />
                <Metric label="Years experience" value={`${analysis.yearsExperience}+`} />
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">Run an evaluation to see whether to apply now, improve first, network first, or skip the role.</p>
          )}
        </section>

        <section className="app-panel p-6">
          <div className="app-eyebrow">Role signals</div>
          <h3 className="app-subheading mt-2">Keywords are evidence clues</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {analysis?.keywords?.length ? analysis.keywords.map((keyword) => (
              <span key={keyword} className="app-chip">
                {keyword}
              </span>
            )) : <span className="text-sm text-[var(--text-secondary)]">No keywords yet.</span>}
          </div>
        </section>
      </aside>

      {analysis && (
        <section className="xl:col-span-2 grid gap-6 lg:grid-cols-3">
          <Panel title="Must-have signals" items={analysis.requiredSkills} />
          <Panel title="Missing evidence" items={analysis.missingSkills} tone="amber" />
          <Panel title="Daily work in this role" items={analysis.responsibilities} />
          <Panel title="Your current strengths" items={analysis.strengths} />
          <Panel title="Risks before applying" items={analysis.gaps} tone="rose" />
          <Panel title="Next best moves" items={analysis.suggestions.map((item) => `${item.action} - ${item.reason}`)} />
        </section>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="app-panel-muted px-4 py-3">
      <div className="app-caption">{label}</div>
      <div className="mt-2 text-sm text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

function Panel({ title, items, tone = 'slate' }: { title: string; items: string[]; tone?: 'slate' | 'amber' | 'rose' }) {
  const toneClass =
    tone === 'amber'
      ? 'border border-amber-300/50 bg-amber-500/10 text-[var(--warning)]'
      : tone === 'rose'
        ? 'border border-rose-300/50 bg-rose-500/10 text-[var(--danger)]'
        : 'border border-white/10 bg-white/[0.04] text-[var(--text-secondary)]';

  return (
    <section className="app-panel p-6">
      <h3 className="app-subheading">
        {title}
      </h3>
      <div className="mt-4 space-y-3">
        {items.length ? items.map((item) => (
          <div key={item} className={`rounded-xl px-4 py-3 text-sm leading-7 ${toneClass}`}>
            {item}
          </div>
        )) : <span className="text-sm text-[var(--text-secondary)]">Nothing to show yet.</span>}
      </div>
    </section>
  );
}

function getRoleStrategy(analysis: JDAnalysisResult) {
  const score = analysis.atsScore;
  const missingCount = analysis.missingSkills.length + analysis.gaps.length;

  if (score >= 80 && missingCount <= 3) {
    return {
      label: 'Apply now',
      title: 'Strong enough to move',
      body: 'Create the tailored resume, then spend effort on referral outreach and follow-up. Do not over-optimize the document.',
      className: 'app-score-high',
    };
  }

  if (score >= 65) {
    return {
      label: 'Improve first',
      title: 'Promising, but close the obvious gaps',
      body: 'You likely have a viable angle, but the missing evidence can reduce callbacks. Add proof points or reframe projects before applying.',
      className: 'app-score-medium',
    };
  }

  return {
    label: 'Be selective',
    title: 'High-risk application',
    body: 'This role may need stronger evidence, a referral, or a different positioning strategy. Consider skipping unless you can credibly cover the must-haves.',
    className: 'app-score-low',
  };
}
