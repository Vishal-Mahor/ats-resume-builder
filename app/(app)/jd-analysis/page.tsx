'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { api, type JDAnalysisResult } from '@/lib/api';

export default function JDAnalysisPage() {
  const [jobDescription, setJobDescription] = useState('');
  const [analysis, setAnalysis] = useState<JDAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function analyze() {
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

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.9fr)]">
      <section className="app-panel p-6">
        <div className="app-eyebrow">JD analysis</div>
        <h2 className="app-heading mt-2">
          Break down the role before you generate
        </h2>
        <p className="app-body mt-3 max-w-2xl">
          Surface ATS keywords, required skills, experience level, and profile gaps from a pasted job description.
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
          disabled={loading}
          className="app-button-primary mt-5 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? 'Analyzing...' : 'Analyze job description'}
        </button>
      </section>

      <aside className="space-y-6">
        <section className="app-panel p-6">
          <div className="app-eyebrow">Match summary</div>
          {analysis ? (
            <>
              <div className="mt-3 text-5xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                {analysis.atsScore}%
              </div>
              <div className="mt-2 text-sm font-semibold text-[var(--accent-strong)]">{analysis.profileMatchLabel}</div>
              <div className="mt-5 space-y-3">
                <Metric label="Detected role" value={analysis.extractedRole} />
                <Metric label="Seniority" value={analysis.seniorityLevel} />
                <Metric label="Domain" value={analysis.domain} />
                <Metric label="Years experience" value={`${analysis.yearsExperience}+`} />
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">Run an analysis to see fit, seniority, and domain signals here.</p>
          )}
        </section>

        <section className="app-panel p-6">
          <div className="app-eyebrow">ATS keywords</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {analysis?.keywords?.length ? analysis.keywords.map((keyword) => (
              <span key={keyword} className="app-chip">
                {keyword}
              </span>
            )) : <span className="text-sm text-slate-500">No keywords yet.</span>}
          </div>
        </section>
      </aside>

      {analysis && (
        <section className="xl:col-span-2 grid gap-6 lg:grid-cols-3">
          <Panel title="Required skills" items={analysis.requiredSkills} />
          <Panel title="Missing skills" items={analysis.missingSkills} tone="amber" />
          <Panel title="Top responsibilities" items={analysis.responsibilities} />
          <Panel title="Strengths" items={analysis.strengths} />
          <Panel title="Gaps" items={analysis.gaps} tone="rose" />
          <Panel title="Recommendations" items={analysis.suggestions.map((item) => `${item.action} — ${item.reason}`)} />
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
  const toneClass = tone === 'amber' ? 'app-score-medium' : tone === 'rose' ? 'app-score-low' : 'app-chip';

  return (
    <section className="app-panel p-6">
      <h3 className="app-subheading">
        {title}
      </h3>
      <div className="mt-4 flex flex-wrap gap-2">
        {items.length ? items.map((item) => (
          <span key={item} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${toneClass}`}>
            {item}
          </span>
        )) : <span className="text-sm text-slate-500">Nothing to show yet.</span>}
      </div>
    </section>
  );
}
