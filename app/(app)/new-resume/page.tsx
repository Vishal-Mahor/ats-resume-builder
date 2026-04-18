'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import ResumePreview from '@/components/resume/ResumePreview';
import {
  api,
  type BillingSnapshot,
  type FullProfile,
  type GenerateResult,
  type JDAnalysisResult,
  type ResumeTemplate,
  type UserSettings,
} from '@/lib/api';

const SOURCE_OPTIONS = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'indeed', label: 'Indeed' },
  { value: 'naukri', label: 'Naukri' },
  { value: 'manual', label: 'Manual' },
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
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [templates, setTemplates] = useState<ResumeTemplate[]>([]);
  const [analysis, setAnalysis] = useState<JDAnalysisResult | null>(null);
  const [billing, setBilling] = useState<BillingSnapshot | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationModalOpen, setGenerationModalOpen] = useState(false);
  const [generatedResume, setGeneratedResume] = useState<GenerateResult | null>(null);
  const [generationPreviewTab, setGenerationPreviewTab] = useState<'resume' | 'cover'>('resume');
  const [form, setForm] = useState({
    source_platform: 'linkedin' as 'linkedin' | 'indeed' | 'naukri' | 'manual',
    company_name: '',
    job_title: '',
    job_description: '',
    cover_letter_tone: 'modern' as 'formal' | 'modern' | 'aggressive',
    template: 'clarity',
  });

  useEffect(() => {
    Promise.all([api.profile.get(), api.templates.list(), api.settings.get(), api.billing.get()])
      .then(([profileResult, templateResult, settingsResult, billingResult]) => {
        setProfile(profileResult);
        setTemplates(templateResult);
        setBilling(billingResult);
        setSettings(settingsResult);
        const requestedTemplate = searchParams.get('template');
        const fallbackTemplate =
          templateResult.find((template) => template.id === settingsResult.exports.defaultTemplate)?.id ??
          templateResult[0]?.id ??
          'clarity';
        const nextTemplate = templateResult.some((template) => template.id === requestedTemplate)
          ? requestedTemplate!
          : fallbackTemplate;
        setForm((current) => ({
          ...current,
          source_platform: settingsResult.defaultSourcePlatform,
          template: nextTemplate,
        }));
      })
      .catch(() => toast.error('Failed to load your workspace setup.'));
  }, [searchParams]);

  useEffect(() => {
    if (!generationModalOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [generationModalOpen]);

  useEffect(() => {
    if (!generating) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [generating]);

  const templateOptions = useMemo(
    () =>
      templates.map((template) => ({
        id: template.id,
        name: template.name,
        note: template.note,
      })),
    [templates]
  );

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

  const profileMeta = useMemo(
    () => ({
      name: profile?.name?.trim() || 'Your Name',
      email: profile?.email?.trim() || 'you@example.com',
      phone: profile?.phone?.trim() || undefined,
      location: profile?.location?.trim() || undefined,
      linkedin: profile?.linkedin?.trim() || undefined,
      github: profile?.github?.trim() || undefined,
    }),
    [profile]
  );

  const resumeLimitReached = Boolean(
    billing && billing.plan === 'free' && billing.usage.resumesUsed >= billing.usage.resumesLimit
  );
  const jdLimitReached = Boolean(
    billing && billing.plan === 'free' && billing.usage.jdAnalysesUsed >= billing.usage.jdAnalysesLimit
  );

  async function handleAnalyze() {
    if (jdLimitReached) {
      toast.error('JD analysis limit reached for Free plan. Upgrade to Plus.');
      return;
    }
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
    if (resumeLimitReached) {
      toast.error('Resume generation limit reached for Free plan. Upgrade to Plus.');
      return;
    }
    if (!form.company_name.trim() || !form.job_title.trim()) {
      toast.error('Add both company name and job title before generating.');
      return;
    }

    if (form.job_description.trim().length < 50) {
      toast.error('Paste the full job description first.');
      return;
    }

    setGenerationModalOpen(true);
    setGeneratedResume(null);
    setGenerationPreviewTab('resume');
    setGenerating(true);

    try {
      const result = await api.generate({
        company_name: form.company_name.trim(),
        job_title: form.job_title.trim(),
        template_id: form.template,
        job_description: form.job_description.trim(),
        source_platform: form.source_platform,
        cover_letter_tone: form.cover_letter_tone,
      });

      setGeneratedResume(result);
      setBilling((current) =>
        current
          ? {
              ...current,
              usage: {
                ...current.usage,
                resumesUsed: current.usage.resumesUsed + 1,
              },
            }
          : current
      );
      toast.success('Resume generated successfully.');
    } catch (error) {
      setGenerationModalOpen(false);
      toast.error(error instanceof Error ? error.message : 'Resume generation failed.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleResumePdfDownload() {
    if (!generatedResume) return;

    try {
      await api.resumes.downloadPdf(generatedResume.resume_id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to download resume PDF.');
    }
  }

  async function handleCoverPdfDownload() {
    if (!generatedResume) return;

    try {
      await api.resumes.downloadCoverPdf(generatedResume.resume_id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to download cover letter PDF.');
    }
  }

  function handleCloseGenerationModal() {
    if (generating) {
      return;
    }
    setGenerationModalOpen(false);
  }

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_370px]">
        <section className="space-y-6">
          <div className="app-panel p-6 sm:p-7">
            {(resumeLimitReached || jdLimitReached) && (
              <div className="mb-5 rounded-2xl border border-amber-300/35 bg-amber-500/12 px-4 py-3 text-sm text-amber-100">
                Free plan limit reached{resumeLimitReached && jdLimitReached ? ' for resume generation and JD analysis' : resumeLimitReached ? ' for resume generation' : ' for JD analysis'}.
                <a href="/billing" className="ml-2 font-semibold underline underline-offset-4">Upgrade to Plus</a>.
              </div>
            )}

            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="app-eyebrow">Creation workflow</div>
                <h2 className="app-heading mt-2">Build a role-specific resume from one focused page</h2>
                <p className="app-body mt-3 max-w-2xl">
                  Paste the JD, choose the source, and generate a tailored resume using your saved profile data.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={analyzing || jdLimitReached || generating}
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
                  disabled={generating}
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
                  disabled={generating}
                >
                  {templateOptions.map((option) => (
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
                  disabled={generating}
                />
              </Field>

              <Field label="Job title">
                <input
                  value={form.job_title}
                  onChange={(event) => setForm((current) => ({ ...current, job_title: event.target.value }))}
                  placeholder="Data Analyst"
                  className="input-shell"
                  disabled={generating}
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
                    disabled={generating}
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
                      disabled={generating}
                      className={`rounded-2xl border px-4 py-3 text-sm font-semibold capitalize transition ${
                        form.cover_letter_tone === tone
                          ? 'border-[var(--border-strong)] bg-[var(--bg-hover)] text-[var(--text-primary)]'
                          : 'border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                      } disabled:cursor-not-allowed disabled:opacity-70`}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Selected template preview">
                <div className="app-panel-muted p-4">
                  <div className="text-lg font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                    {templateOptions.find((option) => option.id === form.template)?.name}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    {templateOptions.find((option) => option.id === form.template)?.note}
                  </div>
                </div>
              </Field>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={analyzing || jdLimitReached || generating}
                className="app-button-secondary disabled:cursor-not-allowed disabled:opacity-70"
              >
                {analyzing ? 'Analyzing JD...' : 'Analyze JD First'}
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating || resumeLimitReached}
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
            <h3 className="app-subheading mt-2">Reuse your information instead of rewriting it</h3>
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
            <h3 className="app-subheading mt-2">ATS signals before you generate</h3>

            {analysis ? (
              <div className="mt-5 space-y-4">
                <InsightRow label="Role fit" value={`${analysis.profileMatchLabel} • ${analysis.atsScore}%`} />
                <InsightRow label="Detected role" value={analysis.extractedRole} />
                <InsightRow label="Seniority" value={analysis.seniorityLevel} />
                <InsightRow label="Domain" value={analysis.domain} />
                <InsightRow label="Missing skills" value={analysis.missingSkills.slice(0, 4).join(', ') || 'No major gaps'} />
                <div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">Priority keywords</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {analysis.keywords.slice(0, 8).map((keyword) => (
                      <span key={keyword} className="app-chip">
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

      {generationModalOpen ? (
        <div className="resume-generation-modal">
          <div className="resume-generation-backdrop" onClick={handleCloseGenerationModal} />

          <div className="resume-generation-dialog">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
              <div>
                <div className="app-eyebrow">{generating ? 'Resume in progress' : 'Resume ready'}</div>
                <h3 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                  {generating ? 'Please stay on this screen while we build your resume.' : 'Preview and export before leaving this flow.'}
                </h3>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                  {generating
                    ? 'Navigation is temporarily locked. If you refresh or close the tab, your generation may be interrupted.'
                    : 'Your generated resume is now available in this popup. Download it, review the cover letter, or open the full editor when you are ready.'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseGenerationModal}
                disabled={generating}
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)] transition hover:bg-white/5 hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Close
              </button>
            </div>

            {generating || !generatedResume ? (
              <div className="flex min-h-[520px] flex-col items-center justify-center px-6 py-10 text-center">
                <div className="resume-generation-spinner">
                  <span className="resume-generation-ring resume-generation-ring-outer" />
                  <span className="resume-generation-ring resume-generation-ring-middle" />
                  <span className="resume-generation-ring resume-generation-ring-inner" />
                </div>
                <div className="mt-8 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                  Generating your tailored resume
                </div>
                <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--text-secondary)]">
                  We are combining your saved profile, the job description, ATS signals, and the selected template into a new draft. Please do not navigate away.
                </p>
                <div className="mt-8 grid w-full max-w-2xl gap-4 sm:grid-cols-3">
                  {[
                    'Reading job requirements',
                    'Tailoring experience bullets',
                    'Scoring ATS keyword fit',
                  ].map((step) => (
                    <div key={step} className="app-panel-muted p-4 text-sm font-medium text-[var(--text-secondary)]">
                      <div className="resume-generation-step mb-3" />
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setGenerationPreviewTab('resume')}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        generationPreviewTab === 'resume'
                          ? 'bg-[var(--accent)] text-[#06111d]'
                          : 'border border-white/10 text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Resume preview
                    </button>
                    <button
                      type="button"
                      onClick={() => setGenerationPreviewTab('cover')}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        generationPreviewTab === 'cover'
                          ? 'bg-[var(--accent)] text-[#06111d]'
                          : 'border border-white/10 text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Cover letter
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={handleResumePdfDownload} className="app-button-secondary">
                      Download resume PDF
                    </button>
                    <button type="button" onClick={handleCoverPdfDownload} className="app-button-secondary">
                      Download cover PDF
                    </button>
                    <Link href={`/resumes/${generatedResume.resume_id}`} className="app-button-primary">
                      Open full editor
                    </Link>
                  </div>
                </div>

                <div className="grid min-h-[560px] gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="max-h-[70vh] overflow-y-auto bg-[#ececee] p-5">
                    {generationPreviewTab === 'resume' ? (
                      <div className="mx-auto max-w-[760px] shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
                        <ResumePreview meta={profileMeta} content={generatedResume.resume_content} settings={settings?.resume} />
                      </div>
                    ) : (
                      <div className="mx-auto max-w-3xl rounded-[28px] border border-black/6 bg-white p-8 text-sm leading-8 text-slate-700 shadow-[0_20px_60px_rgba(0,0,0,0.12)] whitespace-pre-wrap">
                        {generatedResume.cover_letter}
                      </div>
                    )}
                  </div>

                  <aside className="border-l border-white/10 bg-[var(--bg-panel-strong)] p-6">
                    <div className="app-eyebrow">Generation summary</div>
                    <h4 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
                      {form.job_title} at {form.company_name}
                    </h4>

                    <div className="mt-5 space-y-4">
                      <InsightRow label="ATS score" value={`${generatedResume.ats_score}%`} />
                      <InsightRow label="Template" value={templateOptions.find((option) => option.id === form.template)?.name || form.template} />
                      <InsightRow label="Source" value={form.source_platform} />
                    </div>

                    <div className="mt-6">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">Matched keywords</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {generatedResume.matched_keywords.slice(0, 10).map((keyword) => (
                          <span key={keyword} className="app-chip">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">Missing keywords</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {generatedResume.missing_keywords.length > 0 ? (
                          generatedResume.missing_keywords.slice(0, 8).map((keyword) => (
                            <span key={keyword} className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
                              {keyword}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-[var(--text-secondary)]">No major gaps detected.</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">Top suggestions</div>
                      <div className="mt-3 space-y-3">
                        {generatedResume.suggestions.slice(0, 4).map((suggestion, index) => (
                          <div key={`${suggestion.action}-${index}`} className="app-panel-muted p-4">
                            <div className="text-sm font-semibold text-[var(--text-primary)]">{suggestion.action}</div>
                            <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{suggestion.reason}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </aside>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
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
