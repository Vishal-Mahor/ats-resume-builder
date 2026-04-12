'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api, type FullProfile, type JDAnalysisResult } from '@/lib/api';

const SOURCE_OPTIONS = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'indeed', label: 'Indeed' },
  { value: 'naukri', label: 'Naukri' },
  { value: 'manual', label: 'Manual' },
] as const;

const TEMPLATE_OPTIONS = [
  { id: 'clarity', name: 'Clarity', note: 'Balanced, ATS-friendly structure' },
  { id: 'operator', name: 'Operator', note: 'Sharper emphasis on metrics and impact' },
  { id: 'signal', name: 'Signal', note: 'Clean modern style for product and tech roles' },
] as const;

export interface WizardData {
  company_name: string;
  job_title: string;
  job_description: string;
  experiences: Array<{
    job_title: string;
    company: string;
    location: string;
    start_date: string;
    end_date: string;
    is_current: boolean;
    bullets: string[];
  }>;
  skills: string[];
  education: Array<{ degree: string; institution: string; year: string; gpa: string }>;
  projects: Array<{ name: string; tech_stack: string; description: string; url: string }>;
  cover_letter_tone: 'formal' | 'modern' | 'aggressive';
  cover_letter_highlight: string;
}

export default function NewResumePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [analysis, setAnalysis] = useState<JDAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({
    source_platform: 'linkedin' as 'linkedin' | 'indeed' | 'naukri' | 'manual',
    company_name: '',
    job_title: '',
    job_description: '',
    cover_letter_tone: 'modern' as 'formal' | 'modern' | 'aggressive',
    template: 'clarity',
  });

  useEffect(() => {
    api.profile
      .get()
      .then(setProfile)
      .catch(() => toast.error('Failed to load your saved profile.'));
  }, []);

  const profileSummary = useMemo(() => {
    if (!profile) {
      return {
        completionText: 'Loading profile summary...',
        sections: [],
      };
    }

    const sections = [
      `${profile.skills.length} skills`,
      `${profile.experiences.length} experiences`,
      `${profile.projects.length} projects`,
      `${profile.education.length} education entries`,
    ];

    return {
      completionText:
        profile.summary && profile.skills.length && profile.experiences.length
          ? 'Your base profile is ready to power tailored resumes.'
          : 'Add more detail to your profile for stronger generated resumes.',
      sections,
    };
  }, [profile]);

  async function handleAnalyze() {
    if (form.job_description.trim().length < 50) {
      toast.error('Paste a longer job description so we can analyze it properly.');
      return;
    }

    setAnalyzing(true);
    try {
      const result = await api.jdAnalysis({ job_description: form.job_description });
      setAnalysis(result);
      toast.success('Job description analyzed.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to analyze job description.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleGenerate() {
    if (!form.company_name.trim() || !form.job_title.trim()) {
      toast.error('Add both company name and job title before generating.');
      return;
    }

    if (form.job_description.trim().length < 50) {
      toast.error('Paste the full job description first.');
      return;
    }

    setGenerating(true);
    try {
      const result = await api.generate({
        company_name: form.company_name.trim(),
        job_title: form.job_title.trim(),
        job_description: form.job_description.trim(),
        source_platform: form.source_platform,
        cover_letter_tone: form.cover_letter_tone,
      });

      toast.success('Resume generated successfully.');
      router.push(`/resumes/${result.resume_id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Resume generation failed.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_370px]">
      <section className="space-y-6">
        <div className="app-panel p-6 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="app-eyebrow">Creation workflow</div>
              <h2 className="app-heading mt-2">
                Build a role-specific resume from one focused page
              </h2>
              <p className="app-body mt-3 max-w-2xl">
                Paste the JD, choose the source, and generate a tailored resume using your saved profile data.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing}
              className="app-button-secondary disabled:cursor-not-allowed disabled:opacity-70"
            >
              {analyzing ? 'Analyzing...' : 'Analyze JD'}
            </button>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            <Field label="Source platform">
              <select
                value={form.source_platform}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    source_platform: event.target.value as typeof form.source_platform,
                  }))
                }
                className="input-shell"
              >
                {SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Resume template">
              <select
                value={form.template}
                onChange={(event) => setForm((current) => ({ ...current, template: event.target.value }))}
                className="input-shell"
              >
                {TEMPLATE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Company name">
              <input
                value={form.company_name}
                onChange={(event) => setForm((current) => ({ ...current, company_name: event.target.value }))}
                placeholder="Acme Labs"
                className="input-shell"
              />
            </Field>

            <Field label="Job title">
              <input
                value={form.job_title}
                onChange={(event) => setForm((current) => ({ ...current, job_title: event.target.value }))}
                placeholder="Data Analyst"
                className="input-shell"
              />
            </Field>

            <div className="md:col-span-2">
              <Field label="Job description">
                <textarea
                  rows={14}
                  value={form.job_description}
                  onChange={(event) => setForm((current) => ({ ...current, job_description: event.target.value }))}
                  placeholder="Paste the full job description here from LinkedIn, Indeed, Naukri, or manual input."
                  className="input-shell min-h-[260px] resize-y"
                />
              </Field>
            </div>

            <Field label="Cover letter tone">
              <div className="grid gap-3 sm:grid-cols-3">
                {(['formal', 'modern', 'aggressive'] as const).map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, cover_letter_tone: tone }))}
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold capitalize transition ${
                      form.cover_letter_tone === tone
                        ? 'border-[var(--border-strong)] bg-[var(--bg-hover)] text-[var(--text-primary)]'
                        : 'border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Selected template preview">
              <div className="app-panel-muted p-4">
                <div className="text-lg font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                  {TEMPLATE_OPTIONS.find((option) => option.id === form.template)?.name}
                </div>
                <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  {TEMPLATE_OPTIONS.find((option) => option.id === form.template)?.note}
                </div>
              </div>
            </Field>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing}
              className="app-button-secondary disabled:cursor-not-allowed disabled:opacity-70"
            >
              {analyzing ? 'Analyzing JD...' : 'Analyze JD First'}
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="app-button-primary disabled:cursor-not-allowed disabled:opacity-70"
            >
              {generating ? 'Generating resume...' : 'Generate Resume'}
            </button>
          </div>
        </div>
      </section>

      <aside className="space-y-6">
        <section className="app-panel p-6">
          <div className="app-eyebrow">Saved profile</div>
          <h3 className="app-subheading mt-2">
            Reuse your information instead of rewriting it
          </h3>
          <p className="app-body mt-3">{profileSummary.completionText}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {profileSummary.sections.map((section) => (
              <span key={section} className="app-chip">
                {section}
              </span>
            ))}
          </div>
        </section>

        <section className="app-panel p-6">
          <div className="app-eyebrow">Live analysis preview</div>
          <h3 className="app-subheading mt-2">
            ATS signals before you generate
          </h3>

          {analysis ? (
            <div className="mt-5 space-y-4">
              <InsightRow label="Role fit" value={`${analysis.profileMatchLabel} • ${analysis.atsScore}%`} />
              <InsightRow label="Detected role" value={analysis.extractedRole} />
              <InsightRow label="Seniority" value={analysis.seniorityLevel} />
              <InsightRow label="Domain" value={analysis.domain} />
              <InsightRow label="Missing skills" value={analysis.missingSkills.slice(0, 4).join(', ') || 'No major gaps'} />
              <div>
                <div className="text-sm font-semibold text-slate-700">Priority keywords</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {analysis.keywords.slice(0, 8).map((keyword) => (
                    <span key={keyword} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="app-panel-muted mt-5 p-5 text-sm leading-6 text-[var(--text-secondary)]">
              Paste the job description and run analysis to preview ATS keywords, skill gaps, and fit before generating.
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function InsightRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="app-panel-muted px-4 py-3">
      <div className="app-caption">{label}</div>
      <div className="mt-2 text-sm text-[var(--text-primary)]">{value}</div>
    </div>
  );
}
