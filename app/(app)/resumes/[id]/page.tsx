'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import ResumePreview from '@/components/resume/ResumePreview';
import {
  api,
  type FullProfile,
  type Resume,
  type ResumeContent,
  type Suggestion,
  type UserSettings,
} from '@/lib/api';
import {
  addSkillToResumeSkills,
  normalizeResumeSkills,
  removeSkillFromResumeSkills,
  type NormalizedResumeSkills,
} from '@/lib/skill-taxonomy';

type PreviewTab = 'resume' | 'cover';
type BuilderStepId =
  | 'template'
  | 'personal'
  | 'summary'
  | 'links'
  | 'experience'
  | 'education'
  | 'skills'
  | 'extras'
  | 'layout';

const BUILDER_STEPS: Array<{
  id: BuilderStepId;
  step: number;
  title: string;
  description: string;
}> = [
  { id: 'template', step: 2, title: 'Choose Template', description: 'Review the template, role, and export setup.' },
  { id: 'personal', step: 3, title: 'Personal Details', description: 'Name, email, phone, and location shown on the resume.' },
  { id: 'summary', step: 4, title: 'Write Summary', description: 'Strengthen the top summary for ATS and recruiters.' },
  { id: 'links', step: 5, title: 'Add Links', description: 'LinkedIn, GitHub, website, and profile links.' },
  { id: 'experience', step: 6, title: 'Employment History', description: 'Update bullets and measurable outcomes.' },
  { id: 'education', step: 7, title: 'Education', description: 'Keep education clear and current.' },
  { id: 'skills', step: 8, title: 'Skills', description: 'Click-add missing keywords and keep skill groups clean.' },
  { id: 'extras', step: 9, title: 'Extra Sections', description: 'Languages, achievements, and additional strengths.' },
  { id: 'layout', step: 10, title: 'Edit Layout', description: 'Switch preview, review the cover letter, and export.' },
];

export default function ResumeEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [resume, setResume] = useState<Resume | null>(null);
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [content, setContent] = useState<ResumeContent | null>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewTab, setPreviewTab] = useState<PreviewTab>('resume');
  const [activeStep, setActiveStep] = useState<BuilderStepId>('template');
  const [atsScore, setAtsScore] = useState(0);
  const [matchedKeywords, setMatchedKeywords] = useState<string[]>([]);
  const [missingKeywords, setMissingKeywords] = useState<string[]>([]);
  const [atsSuggestions, setAtsSuggestions] = useState<Suggestion[]>([]);
  const [refreshingAts, setRefreshingAts] = useState(false);
  const [improvingWithAi, setImprovingWithAi] = useState(false);

  useEffect(() => {
    Promise.all([
      api.resumes.get(id),
      api.settings.get().catch(() => null),
      api.profile.get().catch(() => null),
    ])
      .then(([resumeData, settingsData, profileData]) => {
        setResume(resumeData);
        setContent(resumeData.resume_content);
        setCoverLetter(resumeData.cover_letter);
        setAtsScore(resumeData.ats_score);
        setMatchedKeywords(resumeData.matched_keywords);
        setMissingKeywords(resumeData.missing_keywords);
        setAtsSuggestions(resumeData.suggestions);
        setSettings(settingsData);
        setProfile(profileData ? normalizeProfile(profileData) : createEmptyProfile());
      })
      .catch(() => toast.error('Failed to load resume builder'))
      .finally(() => setLoading(false));
  }, [id]);

  const normalizedSkills = useMemo<NormalizedResumeSkills | null>(
    () => (content ? normalizeResumeSkills(content.skills) : null),
    [content]
  );

  const profileSkillSuggestions = useMemo(() => {
    const existing = new Set<string>();

    if (normalizedSkills) {
      Object.values(normalizedSkills.technical).forEach((values) => {
        values.forEach((value) => existing.add(value.toLowerCase()));
      });
      normalizedSkills.soft.forEach((value) => existing.add(value.toLowerCase()));
    }

    return [
      ...(profile?.technicalSkills ?? []),
      ...(profile?.softSkills ?? []),
    ].filter((skill, index, list) => {
      const normalized = skill.trim().toLowerCase();
      return normalized && !existing.has(normalized) && list.findIndex((item) => item.trim().toLowerCase() === normalized) === index;
    });
  }, [normalizedSkills, profile]);

  const previewMeta = useMemo(
    () => ({
      name: profile?.name?.trim() || 'Candidate Name',
      email: profile?.email?.trim() || 'candidate@example.com',
      phone: profile?.phone?.trim() || undefined,
      location: profile?.location?.trim() || undefined,
      linkedin: profile?.linkedin?.trim() || undefined,
      github: profile?.github?.trim() || undefined,
    }),
    [profile]
  );

  async function save() {
    if (!content) return;

    setSaving(true);
    try {
      await Promise.all([
        api.resumes.update(id, {
          resume_content: content,
          cover_letter: coverLetter,
          ats_score: atsScore,
          matched_keywords: matchedKeywords,
          missing_keywords: missingKeywords,
          suggestions: atsSuggestions,
        }),
        profile
          ? api.profile.update({
              name: profile.name,
              email: profile.email,
              phone: profile.phone,
              location: profile.location,
              linkedin: profile.linkedin,
              github: profile.github,
              website: profile.website,
              achievements: profile.achievements,
              languages: profile.languages,
              hobbies: profile.hobbies,
            })
          : Promise.resolve(null),
      ]);
      toast.success('Resume builder changes saved');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Save failed';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  function updateSection<K extends keyof ResumeContent>(section: K, value: ResumeContent[K]) {
    if (!content) return;
    setContent({ ...content, [section]: value });
  }

  function updateProfileField<K extends keyof FullProfile>(field: K, value: FullProfile[K]) {
    setProfile((current) => ({ ...normalizeProfile(current), [field]: value }));
  }

  async function refreshAts(nextContent?: ResumeContent) {
    const contentToCheck = nextContent || content;
    if (!contentToCheck) return;

    setRefreshingAts(true);
    try {
      const result = await api.resumes.refreshAts(id, contentToCheck);
      setAtsScore(result.atsScore);
      setMatchedKeywords(result.matchedKeywords);
      setMissingKeywords(result.missingKeywords);
      setAtsSuggestions(result.suggestions);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh ATS score';
      toast.error(message);
    } finally {
      setRefreshingAts(false);
    }
  }

  async function handleAddKeyword(keyword: string) {
    if (!content) return;

    const nextSkills = addSkillToResumeSkills(content.skills, keyword);
    const nextContent = { ...content, skills: nextSkills };
    setContent(nextContent);
    await refreshAts(nextContent);
  }

  async function handleResumePdfDownload() {
    try {
      await api.resumes.downloadPdf(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to download resume PDF';
      toast.error(message);
    }
  }

  async function handleAiImprove() {
    if (!content) return;

    setImprovingWithAi(true);
    try {
      const result = await api.resumes.aiImprove(id, {
        resume_content: content,
        focus_text: getAiFocusText(activeStep, content, profile, coverLetter),
      });
      setContent(result.resume_content);
      setAtsScore(result.ats_score);
      setMatchedKeywords(result.matched_keywords);
      setMissingKeywords(result.missing_keywords);
      setAtsSuggestions(result.suggestions);
      toast.success('AI improved your resume fields for better ATS alignment');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI improvement failed';
      toast.error(message);
    } finally {
      setImprovingWithAi(false);
    }
  }

  async function handleCoverPdfDownload() {
    try {
      await api.resumes.downloadCoverPdf(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to download cover letter PDF';
      toast.error(message);
    }
  }

  function goToStep(stepId: BuilderStepId) {
    setActiveStep(stepId);
    document.getElementById(`builder-step-${stepId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (loading || !resume || !content) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="app-panel p-3">
          <div className="h-8 w-8 animate-spin rounded-[10px] border-2 border-white/10 border-t-[var(--accent)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="app-panel-strong p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="app-eyebrow">Resume builder</div>
            <h1 className="app-heading mt-2">Edit with live preview and ATS guidance</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">
              Work through the builder steps, keep the ATS score visible, and watch the resume preview update in real time as you edit.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatPill label="Company" value={resume.company_name} />
            <StatPill label="Role" value={resume.job_title} />
            <StatPill label="ATS score" value={`${atsScore}%`} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_330px]">
        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <section className="app-panel p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">ATS tracker</div>
                <div className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{atsScore}%</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleAiImprove()}
                  disabled={improvingWithAi}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] text-[var(--accent)] transition hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                  title="AI improve fields"
                  aria-label="AI improve fields"
                >
                  <AiSparkIcon className={improvingWithAi ? 'animate-pulse' : ''} />
                </button>
                <button type="button" onClick={() => void refreshAts()} disabled={refreshingAts} className="app-button-secondary px-3 py-2 text-xs">
                  {refreshingAts ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-[999px] bg-white/10">
              <div
                className="h-full rounded-[999px] transition-all duration-500"
                style={{ width: `${Math.max(Math.min(atsScore, 100), 6)}%`, background: getScoreFill(atsScore) }}
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">
              {getAtsMessage(atsScore)}
            </p>
            <div className="mt-4 grid gap-2 xl:grid-cols-1">
              <SmallInfoCard label="Matched keywords" value={`${matchedKeywords.length}`} />
              <SmallInfoCard label="Still missing" value={`${missingKeywords.length}`} />
            </div>
          </section>

          <section className="app-panel p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Builder flow</div>
            <div className="mt-4 space-y-2">
              {BUILDER_STEPS.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => goToStep(step.id)}
                  className={`w-full rounded-[14px] border px-3 py-3 text-left transition ${
                    activeStep === step.id
                      ? 'border-[var(--border-strong)] bg-[var(--bg-hover)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-panel-muted)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex min-w-[34px] items-center justify-center rounded-[10px] bg-[var(--accent-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--accent-strong)]">
                      {step.step}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{step.title}</div>
                      <div className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{step.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <main className="space-y-5">
          <BuilderSection
            id="template"
            step={2}
            title="Choose Template"
            description="Review the current resume setup before refining the content."
            onFocus={() => setActiveStep('template')}
          >
            <div className="grid gap-4 md:grid-cols-3">
              <InfoTile label="Template" value={resume.template_id || 'Default ATS template'} />
              <InfoTile label="Platform" value={formatPlatform(resume.source_platform)} />
              <InfoTile label="Status" value={resume.status} />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={handleResumePdfDownload} className="app-button-primary">
                Download resume PDF
              </button>
              <button
                type="button"
                onClick={handleCoverPdfDownload}
                disabled={!settings?.exports.includeCoverLetter}
                className="app-button-secondary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {settings?.exports.includeCoverLetter ? 'Download cover letter PDF' : 'Cover letter export disabled'}
              </button>
            </div>
          </BuilderSection>

          <BuilderSection
            id="personal"
            step={3}
            title="Personal Details"
            description="Everything here appears in the live resume preview immediately."
            onFocus={() => setActiveStep('personal')}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FieldGroup label="Full name">
                <BuilderInput value={profile?.name || ''} onChange={(event) => updateProfileField('name', event.target.value)} placeholder="Your full name" />
              </FieldGroup>
              <FieldGroup label="Email">
                <BuilderInput value={profile?.email || ''} onChange={(event) => updateProfileField('email', event.target.value)} placeholder="you@example.com" />
              </FieldGroup>
              <FieldGroup label="Phone">
                <BuilderInput value={profile?.phone || ''} onChange={(event) => updateProfileField('phone', event.target.value)} placeholder="+91 98765 43210" />
              </FieldGroup>
              <FieldGroup label="Location">
                <BuilderInput value={profile?.location || ''} onChange={(event) => updateProfileField('location', event.target.value)} placeholder="Bengaluru, India" />
              </FieldGroup>
            </div>
          </BuilderSection>

          <BuilderSection
            id="summary"
            step={4}
            title="Write Summary"
            description="Sharpen the headline summary for both ATS parsing and recruiter readability."
            onFocus={() => setActiveStep('summary')}
          >
            <FieldGroup label="Professional summary">
              <BuilderTextarea
                rows={5}
                value={content.summary}
                onChange={(event) => updateSection('summary', event.target.value)}
                placeholder="Summarize your experience, strengths, and role fit in 2-3 sharp sentences."
              />
            </FieldGroup>
            <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">
              Tip: lead with years of experience, strongest domain, and measurable impact instead of generic traits.
            </p>
          </BuilderSection>

          <BuilderSection
            id="links"
            step={5}
            title="Add Links"
            description="Professional links help recruiters validate your work quickly."
            onFocus={() => setActiveStep('links')}
          >
            <div className="grid gap-4 md:grid-cols-3">
              <FieldGroup label="LinkedIn">
                <BuilderInput value={profile?.linkedin || ''} onChange={(event) => updateProfileField('linkedin', event.target.value)} placeholder="linkedin.com/in/your-profile" />
              </FieldGroup>
              <FieldGroup label="GitHub">
                <BuilderInput value={profile?.github || ''} onChange={(event) => updateProfileField('github', event.target.value)} placeholder="github.com/your-handle" />
              </FieldGroup>
              <FieldGroup label="Website">
                <BuilderInput value={profile?.website || ''} onChange={(event) => updateProfileField('website', event.target.value)} placeholder="yourportfolio.com" />
              </FieldGroup>
            </div>
          </BuilderSection>

          <BuilderSection
            id="experience"
            step={6}
            title="Employment History"
            description="Keep the most relevant experience detailed, quantified, and easy to scan."
            onFocus={() => setActiveStep('experience')}
          >
            <div className="space-y-4">
              {content.experience.map((exp, index) => (
                <div key={`${exp.company}-${index}`} className="app-panel-muted p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">Experience {index + 1}</div>
                    {content.experience.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => updateSection('experience', content.experience.filter((_, itemIndex) => itemIndex !== index))}
                        className="text-xs font-semibold text-rose-200 transition hover:text-rose-100"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FieldGroup label="Job title">
                      <BuilderInput
                        value={exp.job_title}
                        onChange={(event) => updateExperience(content, updateSection, index, 'job_title', event.target.value)}
                      />
                    </FieldGroup>
                    <FieldGroup label="Company">
                      <BuilderInput
                        value={exp.company}
                        onChange={(event) => updateExperience(content, updateSection, index, 'company', event.target.value)}
                      />
                    </FieldGroup>
                    <FieldGroup label="Location">
                      <BuilderInput
                        value={exp.location || ''}
                        onChange={(event) => updateExperience(content, updateSection, index, 'location', event.target.value)}
                      />
                    </FieldGroup>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FieldGroup label="Start date">
                        <BuilderInput
                          value={exp.start_date}
                          onChange={(event) => updateExperience(content, updateSection, index, 'start_date', event.target.value)}
                          placeholder="2023-01"
                        />
                      </FieldGroup>
                      <FieldGroup label="End date">
                        <BuilderInput
                          value={exp.end_date || ''}
                          onChange={(event) => updateExperience(content, updateSection, index, 'end_date', event.target.value)}
                          placeholder={exp.is_current ? 'Present' : '2025-04'}
                        />
                      </FieldGroup>
                    </div>
                  </div>
                  <div className="mt-4">
                    <FieldGroup label="Bullets">
                      <BuilderTextarea
                        rows={5}
                        value={exp.bullets.join('\n')}
                        onChange={(event) => updateExperience(content, updateSection, index, 'bullets', toBulletList(event.target.value))}
                        placeholder="One bullet per line. Lead with action + impact + metric."
                      />
                    </FieldGroup>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                updateSection('experience', [
                  ...content.experience,
                  { job_title: '', company: '', location: '', start_date: '', end_date: '', is_current: false, bullets: [''] },
                ])
              }
              className="app-button-secondary mt-4"
            >
              Add experience
            </button>
          </BuilderSection>

          <BuilderSection
            id="education"
            step={7}
            title="Education"
            description="Keep education concise, but include GPA or highlights when they strengthen the profile."
            onFocus={() => setActiveStep('education')}
          >
            <div className="space-y-4">
              {content.education.map((edu, index) => (
                <div key={`${edu.institution}-${index}`} className="app-panel-muted p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">Education {index + 1}</div>
                    {content.education.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => updateSection('education', content.education.filter((_, itemIndex) => itemIndex !== index))}
                        className="text-xs font-semibold text-rose-200 transition hover:text-rose-100"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FieldGroup label="Degree">
                      <BuilderInput
                        value={edu.degree}
                        onChange={(event) => updateEducation(content, updateSection, index, 'degree', event.target.value)}
                      />
                    </FieldGroup>
                    <FieldGroup label="Institution">
                      <BuilderInput
                        value={edu.institution}
                        onChange={(event) => updateEducation(content, updateSection, index, 'institution', event.target.value)}
                      />
                    </FieldGroup>
                    <FieldGroup label="Year">
                      <BuilderInput
                        value={edu.year}
                        onChange={(event) => updateEducation(content, updateSection, index, 'year', event.target.value)}
                      />
                    </FieldGroup>
                    <FieldGroup label="GPA">
                      <BuilderInput
                        value={edu.gpa || ''}
                        onChange={(event) => updateEducation(content, updateSection, index, 'gpa', event.target.value)}
                        placeholder="8.7/10"
                      />
                    </FieldGroup>
                  </div>
                  <div className="mt-4">
                    <FieldGroup label="Education bullets">
                      <BuilderTextarea
                        rows={3}
                        value={(edu.bullets || []).join('\n')}
                        onChange={(event) => updateEducation(content, updateSection, index, 'bullets', toBulletList(event.target.value))}
                        placeholder="Scholarships, honors, coursework, or leadership highlights."
                      />
                    </FieldGroup>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => updateSection('education', [...content.education, { degree: '', institution: '', year: '', gpa: '', bullets: [''] }])}
              className="app-button-secondary mt-4"
            >
              Add education
            </button>
          </BuilderSection>

          <BuilderSection
            id="skills"
            step={8}
            title="Skills"
            description="Use one-click additions from ATS gaps and profile data instead of manually typing everything."
            onFocus={() => setActiveStep('skills')}
          >
            {normalizedSkills ? (
              <SkillsSectionEditor
                skills={normalizedSkills}
                missingKeywords={missingKeywords}
                profileSuggestions={profileSkillSuggestions}
                onAdd={handleAddKeyword}
                onRemove={(skill, group) => {
                  const nextSkills = removeSkillFromResumeSkills(content.skills, skill, group);
                  const nextContent = { ...content, skills: nextSkills };
                  setContent(nextContent);
                  void refreshAts(nextContent);
                }}
              />
            ) : null}
          </BuilderSection>

          <BuilderSection
            id="extras"
            step={9}
            title="Extra Sections"
            description="Keep supporting information nearby so you can decide what strengthens this version of the resume."
            onFocus={() => setActiveStep('extras')}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FieldGroup label="Languages">
                <BuilderTextarea
                  rows={4}
                  value={(profile?.languages || []).join('\n')}
                  onChange={(event) => updateProfileField('languages', toBulletList(event.target.value))}
                  placeholder="English&#10;Hindi&#10;German"
                />
              </FieldGroup>
              <FieldGroup label="Achievements">
                <BuilderTextarea
                  rows={4}
                  value={(profile?.achievements || []).join('\n')}
                  onChange={(event) => updateProfileField('achievements', toBulletList(event.target.value))}
                  placeholder="Top performer award&#10;Hackathon winner"
                />
              </FieldGroup>
            </div>
            <div className="mt-4">
              <FieldGroup label="Hobbies or interests">
                <BuilderTextarea
                  rows={3}
                  value={(profile?.hobbies || []).join('\n')}
                  onChange={(event) => updateProfileField('hobbies', toBulletList(event.target.value))}
                  placeholder="Open-source contribution&#10;Mentoring&#10;Technical writing"
                />
              </FieldGroup>
            </div>
          </BuilderSection>

          <BuilderSection
            id="layout"
            step={10}
            title="Edit Layout"
            description="Review the final appearance, switch to cover letter preview, and export."
            onFocus={() => setActiveStep('layout')}
          >
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setPreviewTab('resume')}
                className={previewTab === 'resume' ? 'app-button-primary' : 'app-button-secondary'}
              >
                Resume preview
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('cover')}
                className={previewTab === 'cover' ? 'app-button-primary' : 'app-button-secondary'}
              >
                Cover letter preview
              </button>
              <button type="button" onClick={handleResumePdfDownload} className="app-button-secondary">
                Export resume PDF
              </button>
              <button
                type="button"
                onClick={handleCoverPdfDownload}
                disabled={!settings?.exports.includeCoverLetter}
                className="app-button-secondary disabled:cursor-not-allowed disabled:opacity-60"
              >
                Export cover PDF
              </button>
            </div>
            <div className="mt-4">
              <FieldGroup label="Cover letter content">
                <BuilderTextarea
                  rows={10}
                  value={coverLetter}
                  onChange={(event) => setCoverLetter(event.target.value)}
                  placeholder="Edit the generated cover letter here."
                />
              </FieldGroup>
            </div>
          </BuilderSection>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => void handleAiImprove()}
              disabled={improvingWithAi}
              className="app-button-secondary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="inline-flex items-center gap-2">
                <AiSparkIcon />
                {improvingWithAi ? 'AI improving...' : 'AI improve fields'}
              </span>
            </button>
            <button type="button" onClick={() => void refreshAts()} disabled={refreshingAts} className="app-button-secondary">
              {refreshingAts ? 'Refreshing ATS...' : 'Recheck ATS'}
            </button>
            <button type="button" onClick={save} disabled={saving} className="app-button-primary">
              {saving ? 'Saving changes...' : 'Save changes'}
            </button>
          </div>
        </main>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <section className="app-panel p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Recommended to improve score</div>
            <div className="mt-4 max-h-[calc(100vh-8.5rem)] space-y-3 overflow-y-auto pr-1">
              {atsSuggestions.length > 0 ? (
                atsSuggestions.map((suggestion, index) => (
                  <div key={`${suggestion.action}-${index}`} className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-panel-muted)] px-3 py-3">
                    <div className="text-xs font-semibold text-[var(--accent-strong)]">+{suggestion.impact_pct}% potential</div>
                    <div className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{suggestion.action}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-panel-muted)] px-3 py-3 text-sm text-[var(--text-secondary)]">
                  No extra recommendations right now. Refresh ATS after content changes to get new guidance.
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      <section className="app-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Live preview</div>
            <div className="mt-1 text-sm text-[var(--text-secondary)]">See every change as you edit.</div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPreviewTab('resume')}
              className={previewTab === 'resume' ? 'app-button-primary px-3 py-2 text-xs' : 'app-button-secondary px-3 py-2 text-xs'}
            >
              Resume
            </button>
            <button
              type="button"
              onClick={() => setPreviewTab('cover')}
              className={previewTab === 'cover' ? 'app-button-primary px-3 py-2 text-xs' : 'app-button-secondary px-3 py-2 text-xs'}
            >
              Cover
            </button>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-[16px] border border-[var(--border-subtle)] bg-[rgba(4,10,18,0.72)] p-4">
          {previewTab === 'resume' ? (
            <div className="mx-auto max-w-4xl rounded-[18px] border border-black/8 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
              <ResumePreview meta={previewMeta} content={content} />
            </div>
          ) : (
            <div className="mx-auto max-w-4xl rounded-[18px] border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-8 text-sm leading-7 text-[var(--text-primary)] shadow-[var(--shadow-panel)] whitespace-pre-wrap">
              {coverLetter}
            </div>
          )}
        </div>
      </section>

    </div>
  );
}

function BuilderSection({
  id,
  step,
  title,
  description,
  children,
  onFocus,
}: {
  id: BuilderStepId;
  step: number;
  title: string;
  description: string;
  children: React.ReactNode;
  onFocus: () => void;
}) {
  return (
    <section id={`builder-step-${id}`} className="app-panel p-5" onMouseEnter={onFocus}>
      <div className="flex items-start gap-4">
        <div className="inline-flex h-10 min-w-[40px] items-center justify-center rounded-[12px] bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent-strong)]">
          {step}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function StatPill({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'high' | 'medium' | 'low' }) {
  const toneClass =
    tone === 'high'
      ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
      : tone === 'medium'
        ? 'border-amber-400/20 bg-amber-400/10 text-amber-100'
        : tone === 'low'
          ? 'border-rose-400/20 bg-rose-400/10 text-rose-100'
          : 'border-[var(--border-subtle)] bg-[var(--bg-panel)] text-[var(--text-primary)]';

  return (
    <div className={`rounded-[14px] border px-4 py-3 ${toneClass}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">{label}</div>
      <div className="mt-2 text-sm font-semibold">{value}</div>
    </div>
  );
}

function SmallInfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-panel-muted)] px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">{label}</div>
      <div className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-panel-muted)] px-4 py-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">{label}</div>
      <div className="mt-2 text-sm font-semibold capitalize text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">{label}</span>
      {children}
    </label>
  );
}

function BuilderInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input-shell ${props.className || ''}`} />;
}

function BuilderTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`input-shell resize-y ${props.className || ''}`} />;
}

function SkillsSectionEditor({
  skills,
  missingKeywords,
  profileSuggestions,
  onAdd,
  onRemove,
}: {
  skills: NormalizedResumeSkills;
  missingKeywords: string[];
  profileSuggestions: string[];
  onAdd: (skill: string) => void | Promise<void>;
  onRemove: (skill: string, group: keyof NormalizedResumeSkills['technical'] | 'soft') => void;
}) {
  const groups: Array<{ label: string; key: keyof NormalizedResumeSkills['technical'] | 'soft'; values: string[] }> = [
    { label: 'Languages', key: 'languages', values: skills.technical.languages },
    { label: 'Backend / Frameworks', key: 'backend_frameworks', values: skills.technical.backend_frameworks },
    { label: 'AI / GenAI', key: 'ai_genai', values: skills.technical.ai_genai },
    { label: 'Streaming / Messaging', key: 'streaming_messaging', values: skills.technical.streaming_messaging },
    { label: 'Databases / Storage', key: 'databases_storage', values: skills.technical.databases_storage },
    { label: 'Cloud / Infra', key: 'cloud_infra', values: skills.technical.cloud_infra },
    { label: 'Tools / Platforms', key: 'tools_platforms', values: skills.technical.tools_platforms },
    { label: 'Other Technical', key: 'other', values: skills.technical.other },
    { label: 'Soft Skills', key: 'soft', values: skills.soft },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <SuggestionCard
          title="Add missing ATS keywords"
          helper="Click a chip to place it into the right skill bucket automatically."
          emptyState="No ATS skill gaps detected right now."
          items={missingKeywords}
          onAdd={onAdd}
          tone="rose"
        />
        <SuggestionCard
          title="Pulled from your profile"
          helper="These came from your stored profile and are ready to add back if needed."
          emptyState="No extra profile skills available to add."
          items={profileSuggestions}
          onAdd={onAdd}
          tone="cyan"
        />
      </div>

      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group.key} className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-panel-muted)] p-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">{group.label}</div>
            <div className="flex flex-wrap gap-2">
              {group.values.length > 0 ? (
                group.values.map((skill) => (
                  <button
                    key={`${group.key}-${skill}`}
                    type="button"
                    onClick={() => onRemove(skill, group.key)}
                    className="inline-flex items-center gap-1 rounded-[10px] border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-medium text-cyan-100 transition hover:border-rose-400/20 hover:bg-rose-400/10 hover:text-rose-100"
                  >
                    {skill}
                    <span className="text-[10px] font-semibold">×</span>
                  </button>
                ))
              ) : (
                <span className="text-[11px] text-[var(--text-dim)]">No skills added yet.</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SuggestionCard({
  title,
  helper,
  emptyState,
  items,
  onAdd,
  tone,
}: {
  title: string;
  helper: string;
  emptyState: string;
  items: string[];
  onAdd: (skill: string) => void | Promise<void>;
  tone: 'rose' | 'cyan';
}) {
  const chipClass =
    tone === 'rose'
      ? 'border-rose-400/20 bg-rose-400/10 text-rose-100 hover:bg-rose-400/20'
      : 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20';

  return (
    <div className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-panel-muted)] p-4">
      <div className="text-sm font-semibold text-[var(--text-primary)]">{title}</div>
      <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{helper}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.length > 0 ? (
          items.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => void onAdd(item)}
              className={`inline-flex items-center gap-1 rounded-[10px] border px-2.5 py-1 text-[11px] font-medium transition ${chipClass}`}
            >
              {item}
              <span className="text-[10px] font-semibold">+</span>
            </button>
          ))
        ) : (
          <span className="text-[11px] text-[var(--text-dim)]">{emptyState}</span>
        )}
      </div>
    </div>
  );
}

function updateExperience(
  content: ResumeContent,
  updateSection: <K extends keyof ResumeContent>(section: K, value: ResumeContent[K]) => void,
  index: number,
  field: keyof ResumeContent['experience'][number],
  value: string | boolean | string[]
) {
  const next = [...content.experience];
  next[index] = { ...next[index], [field]: value };
  updateSection('experience', next);
}

function updateEducation(
  content: ResumeContent,
  updateSection: <K extends keyof ResumeContent>(section: K, value: ResumeContent[K]) => void,
  index: number,
  field: keyof ResumeContent['education'][number],
  value: string | string[]
) {
  const next = [...content.education];
  next[index] = { ...next[index], [field]: value };
  updateSection('education', next);
}

function toBulletList(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatPlatform(platform?: string) {
  const value = platform ?? 'manual';
  return value === 'linkedin' ? 'LinkedIn' : value === 'indeed' ? 'Indeed' : value === 'naukri' ? 'Naukri' : 'Manual';
}

function getAiFocusText(
  step: BuilderStepId,
  content: ResumeContent,
  profile: FullProfile | null,
  coverLetter: string
) {
  if (step === 'summary') return content.summary || '';
  if (step === 'skills') return JSON.stringify(content.skills);
  if (step === 'experience') return content.experience.flatMap((item) => item.bullets).join('\n');
  if (step === 'education') return content.education.flatMap((item) => item.bullets || []).join('\n');
  if (step === 'links') return [profile?.linkedin, profile?.github, profile?.website].filter(Boolean).join('\n');
  if (step === 'layout') return coverLetter || '';

  return [
    content.summary,
    content.experience.flatMap((item) => item.bullets).join('\n'),
    content.projects.flatMap((item) => item.bullets || [item.summary || item.description || '']).join('\n'),
  ]
    .filter(Boolean)
    .join('\n');
}

function AiSparkIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path
        d="M8 1l1.6 3.9L13.5 6.5 9.6 8 8 12 6.4 8 2.5 6.5l3.9-1.6L8 1zm4.5 8.5l.8 1.9 1.7.7-1.7.7-.8 1.9-.8-1.9-1.7-.7 1.7-.7.8-1.9z"
        fill="currentColor"
      />
    </svg>
  );
}

function getScoreTone(score: number): 'high' | 'medium' | 'low' {
  if (score >= 80) return 'high';
  if (score >= 65) return 'medium';
  return 'low';
}

function getScoreFill(score: number) {
  if (score >= 80) return 'linear-gradient(90deg, #22c55e, #34d399)';
  if (score >= 65) return 'linear-gradient(90deg, #f59e0b, #facc15)';
  return 'linear-gradient(90deg, #fb7185, #f43f5e)';
}

function getAtsMessage(score: number) {
  if (score >= 90) return 'This version is already very strong. Focus on precision and recruiter readability.';
  if (score >= 80) return 'You are in a strong range. Closing the remaining keyword gaps can push this even higher.';
  if (score >= 65) return 'This is competitive, but the missing keywords and sharper bullets can still lift it a lot.';
  return 'This version still needs targeted alignment. Start with missing keywords, quantified bullets, and summary refinement.';
}

function createEmptyProfile(): FullProfile {
  return {
    name: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    github: '',
    website: '',
    summary: '',
    achievements: [],
    languages: [],
    hobbies: [],
    technicalSkills: [],
    softSkills: [],
    skills: [],
    experiences: [],
    projects: [],
    education: [],
  };
}

function normalizeProfile(profile: FullProfile | null | undefined): FullProfile {
  return {
    ...createEmptyProfile(),
    ...(profile ?? {}),
    achievements: profile?.achievements ?? [],
    languages: profile?.languages ?? [],
    hobbies: profile?.hobbies ?? [],
    technicalSkills: profile?.technicalSkills ?? [],
    softSkills: profile?.softSkills ?? [],
    skills: profile?.skills ?? [],
    experiences: profile?.experiences ?? [],
    projects: profile?.projects ?? [],
    education: profile?.education ?? [],
  };
}
