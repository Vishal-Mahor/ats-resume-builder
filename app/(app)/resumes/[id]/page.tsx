'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import ResumePreview from '@/components/resume/ResumePreview';
import {
  api,
  type FullProfile,
  type Resume,
  type ResumeContent,
  type ResumeSkills,
  type Suggestion,
  type UserSettings,
} from '@/lib/api';
import {
  normalizeResumeSkills,
} from '@/lib/skill-taxonomy';
import { isLikelyTechSkill } from '@/lib/tech-skill-guardrails';

type SuggestionSource = 'missing' | 'profile' | 'suggestion';
type BuilderStepId =
  | 'template'
  | 'personal'
  | 'summary'
  | 'links'
  | 'experience'
  | 'projects'
  | 'education'
  | 'skills'
  | 'extras'
  | 'layout';
type SectionVisibilityKey = keyof NonNullable<ResumeContent['section_visibility']>;
type SkillGroupKey = string;
type SkillCategory = { id: string; label: string; skills: string[] };
type ResumeLinkStyle = NonNullable<UserSettings['resume']['formatting']['linkStyle']>;

type PlacementState = {
  item: string;
  source: SuggestionSource;
} | null;

type DragPayload =
  | { kind: 'skill'; value: string; sourceGroup: SkillGroupKey }
  | { kind: 'pending'; value: string; source: SuggestionSource }
  | { kind: 'category'; categoryId: string };

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
};

const BUILDER_STEPS: Array<{
  id: BuilderStepId;
  step: number;
  title: string;
  description: string;
}> = [
  { id: 'template', step: 1, title: 'Choose Template', description: 'Review the template, role, and export setup.' },
  { id: 'personal', step: 2, title: 'Personal Details', description: 'Name, email, phone, and location shown on the resume.' },
  { id: 'summary', step: 3, title: 'Write Summary', description: 'Strengthen the top summary for ATS and recruiters.' },
  { id: 'links', step: 4, title: 'Add Links', description: 'LinkedIn, GitHub, website, and profile links.' },
  { id: 'experience', step: 5, title: 'Employment History', description: 'Update bullets and measurable outcomes.' },
  { id: 'projects', step: 6, title: 'Projects', description: 'Keep strong project evidence visible and targeted.' },
  { id: 'education', step: 7, title: 'Education', description: 'Keep education clear and current.' },
  { id: 'skills', step: 8, title: 'Skills', description: 'Click-add missing keywords and keep skill groups clean.' },
  { id: 'extras', step: 9, title: 'Extra Sections', description: 'Languages, achievements, and additional strengths.' },
  { id: 'layout', step: 10, title: 'Review & Export', description: 'Review the live resume preview and export.' },
];

export default function ResumeEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [resume, setResume] = useState<Resume | null>(null);
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [content, setContent] = useState<ResumeContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeStep, setActiveStep] = useState<BuilderStepId>('template');
  const [atsScore, setAtsScore] = useState(0);
  const [matchedKeywords, setMatchedKeywords] = useState<string[]>([]);
  const [missingKeywords, setMissingKeywords] = useState<string[]>([]);
  const [atsSuggestions, setAtsSuggestions] = useState<Suggestion[]>([]);
  const [refreshingAts, setRefreshingAts] = useState(false);
  const [improvingWithAi, setImprovingWithAi] = useState(false);
  const [placementState, setPlacementState] = useState<PlacementState>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [savingLinkStyle, setSavingLinkStyle] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hi, I can help edit this resume. Try: "set summary: ...", "add skill React, TypeScript", "add experience", or "improve resume".',
    },
  ]);

  useEffect(() => {
    Promise.all([
      api.resumes.get(id),
      api.settings.get().catch(() => null),
      api.profile.get().catch(() => null),
    ])
      .then(([resumeData, settingsData, profileData]) => {
        setResume(resumeData);
        setContent(hydrateResumeContent(resumeData.resume_content, profileData ?? null));
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

  const skillCategories = useMemo<SkillCategory[]>(
    () => (content ? getSkillCategories(content.skills) : []),
    [content]
  );

  const profileSkillSuggestions = useMemo(() => {
    const existing = new Set<string>();

    skillCategories.forEach((category) => {
      category.skills.forEach((value) => existing.add(value.toLowerCase()));
    });

    return [
      ...(profile?.technicalSkills ?? []),
    ].filter((skill, index, list) => {
      const normalized = skill.trim().toLowerCase();
      return normalized && isLikelyTechSkill(skill) && !existing.has(normalized) && list.findIndex((item) => item.trim().toLowerCase() === normalized) === index;
    });
  }, [skillCategories, profile]);

  const skillInputSuggestions = useMemo(
    () =>
      uniqueLines([
        ...profileSkillSuggestions,
        ...missingKeywords,
        ...matchedKeywords,
        ...skillCategories.flatMap((category) => category.skills),
      ]),
    [matchedKeywords, missingKeywords, profileSkillSuggestions, skillCategories]
  );

  const previewMeta = useMemo(
    () => ({
      name: profile?.name?.trim() || 'Candidate Name',
      email: profile?.email?.trim() || 'candidate@example.com',
      phone: profile?.phone?.trim() || undefined,
      location: profile?.location?.trim() || undefined,
      linkedin: profile?.linkedin?.trim() || undefined,
      github: profile?.github?.trim() || undefined,
      website: profile?.website?.trim() || undefined,
    }),
    [profile]
  );

  const profileReadiness = useMemo(
    () => calculateProfileReadiness(profile, content, resume),
    [profile, content, resume]
  );

  async function save() {
    if (!content || !resume) return;

    setSaving(true);
    try {
      const [savedResume] = await Promise.all([
        api.resumes.update(id, {
          company_name: resume.company_name,
          job_title: resume.job_title,
          resume_content: content,
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
              achievements: content.achievements,
              languages: content.languages,
              hobbies: content.hobbies,
            })
          : Promise.resolve(null),
      ]);
      setResume(savedResume);
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

  function updateResumeField(field: 'company_name' | 'job_title', value: string) {
    setResume((current) => (current ? { ...current, [field]: value } : current));
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

    const categories = ensureSkillCategories(content.skills);
    const targetCategory = categories[0] ?? createSkillCategory('Skills');
    const nextSkills = setSkillCategories(content.skills, [
      ...categories.filter((category) => category.id !== targetCategory.id),
      {
        ...targetCategory,
        skills: uniqueLines([...targetCategory.skills, keyword]),
      },
    ]);
    const nextContent = { ...content, skills: nextSkills };
    setContent(nextContent);
    await refreshAts(nextContent);
  }

  function updateVisibility(section: SectionVisibilityKey, enabled: boolean) {
    if (!content) return;
    setContent({
      ...content,
      section_visibility: {
        ...getSectionVisibility(content),
        [section]: enabled,
      },
    });
  }

  function addItemToSpecificSkillGroup(item: string, group: SkillGroupKey) {
    if (!content || !item.trim()) return;
    const nextSkills = addSkillToCategory(content.skills, group, item);
    const nextContent = { ...content, skills: nextSkills };
    setContent(nextContent);
    void refreshAts(nextContent);
  }

  function moveSkillAcrossGroups(item: string, from: SkillGroupKey, to: SkillGroupKey) {
    if (!content || from === to) return;
    const removed = removeSkillFromCategory(content.skills, from, item);
    const added = addSkillToCategory(removed, to, item);
    const nextContent = { ...content, skills: added };
    setContent(nextContent);
    void refreshAts(nextContent);
  }

  function updateSkillCategories(categories: SkillCategory[]) {
    if (!content) return;
    const nextContent = { ...content, skills: setSkillCategories(content.skills, categories) };
    setContent(nextContent);
  }

  function addItemToExperience(index: number, item: string) {
    if (!content || !item.trim()) return;
    const next = [...content.experience];
    const bullets = uniqueLines([...(next[index].bullets || []), item.trim()]);
    next[index] = { ...next[index], bullets };
    const nextContent = { ...content, experience: next };
    setContent(nextContent);
    void refreshAts(nextContent);
  }

  function addItemToProject(index: number, item: string) {
    if (!content || !item.trim()) return;
    const next = [...content.projects];
    const bullets = uniqueLines([...(next[index].bullets || []), item.trim()]);
    next[index] = { ...next[index], bullets };
    const nextContent = { ...content, projects: next };
    setContent(nextContent);
    void refreshAts(nextContent);
  }

  function applyAutoPlacement(item: string) {
    if (!content) return;
    if (item.split(/\s+/).length > 4 && content.experience.length > 0) {
      addItemToExperience(0, item);
      return;
    }
    addItemToSpecificSkillGroup(item, classifyDropGroup(item));
  }

  function openPlacement(item: string, source: SuggestionSource) {
    setPlacementState({ item, source });
  }

  async function handleResumePdfDownload() {
    try {
      await api.resumes.downloadPdf(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to download resume PDF';
      toast.error(message);
    }
  }

  async function updateLinkStyle(linkStyle: ResumeLinkStyle) {
    if (!settings || settings.resume.formatting.linkStyle === linkStyle) return;

    const nextSettings: UserSettings = {
      ...settings,
      resume: {
        ...settings.resume,
        formatting: {
          ...settings.resume.formatting,
          linkStyle,
        },
      },
    };

    setSettings(nextSettings);
    setSavingLinkStyle(true);
    try {
      const saved = await api.settings.update(nextSettings);
      setSettings(saved);
      toast.success('Link display updated.');
    } catch (error) {
      setSettings(settings);
      toast.error(error instanceof Error ? error.message : 'Failed to update link display.');
    } finally {
      setSavingLinkStyle(false);
    }
  }

  async function handleAiImprove() {
    if (!content) return;

    setImprovingWithAi(true);
    try {
      const result = await api.resumes.aiImprove(id, {
        resume_content: content,
        focus_text: getAiFocusText(activeStep, content, profile),
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

  function goToStep(stepId: BuilderStepId) {
    setActiveStep(stepId);
    document.getElementById(`builder-step-${stepId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleChatSubmit() {
    const message = chatInput.trim();
    if (!message || !content || chatLoading) return;

    setChatInput('');
    setChatMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'user', text: message },
    ]);

    setChatLoading(true);
    try {
      const result = await api.resumes.chat(id, {
        message,
        resume_content: content,
      });

      if (result.allowed && result.resume_content) {
        setContent(hydrateResumeContent(result.resume_content, profile));
        setActiveStep(inferStepFromChat(message));
      }

      setChatMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'assistant', text: result.reply },
      ]);
    } catch (error) {
      setChatMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: error instanceof Error ? error.message : 'I could not update the resume right now.',
        },
      ]);
    } finally {
      setChatLoading(false);
    }
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
    <div className="space-y-4">
      <section className="app-panel-strong p-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(220px,0.9fr)_minmax(420px,1.4fr)_auto] xl:items-end">
          <div className="min-w-0">
            <div className="app-eyebrow">Resume builder</div>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">Edit resume</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <MiniMeta label="Template" value={resume.template_id || 'Default'} />
              <MiniMeta label="Status" value={resume.status} />
              <MiniMeta label="ATS" value={`${atsScore}%`} />
              {resume.status === 'tailored' && resume.base_resume_name ? <MiniMeta label="Base" value={resume.base_resume_name} /> : null}
              {resume.status === 'tailored' ? <MiniMeta label="Gaps" value={`${missingKeywords.length}`} /> : null}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <FieldGroup label="Company name">
              <BuilderInput
                value={resume.company_name}
                onChange={(event) => updateResumeField('company_name', event.target.value)}
                placeholder="Company or resume name"
                className="py-2"
              />
            </FieldGroup>
            <FieldGroup label="Target role">
              <BuilderInput
                value={resume.job_title}
                onChange={(event) => updateResumeField('job_title', event.target.value)}
                placeholder="Software Engineer"
                className="py-2"
              />
            </FieldGroup>
          </div>

          <div className="flex flex-col gap-2 xl:min-w-[220px]">
            <ProfileReadinessCard readiness={profileReadiness} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start">
        <aside className="hidden">
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
            step={1}
            title="Choose Template"
            description="Review the current resume setup before refining the content."
            onFocus={() => setActiveStep('template')}
          >
            <p className="text-sm leading-6 text-[var(--text-secondary)]">
              Template, company, role, export, and readiness controls now live in the header so you can keep them visible while editing the resume.
            </p>
          </BuilderSection>

          <BuilderSection
            id="personal"
            step={2}
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
                <LocationAutocompleteInput
                  value={profile?.location || ''}
                  onChange={(value) => updateProfileField('location', value)}
                  placeholder="Start typing city or country"
                />
              </FieldGroup>
            </div>
          </BuilderSection>

          <BuilderSection
            id="summary"
            step={3}
            title="Write Summary"
            description="Sharpen the headline summary for both ATS parsing and recruiter readability."
            onFocus={() => setActiveStep('summary')}
            enabled={getSectionVisibility(content).summary}
            onToggleEnabled={(enabled) => updateVisibility('summary', enabled)}
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
            step={4}
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
            step={5}
            title="Employment History"
            description="Keep the most relevant experience detailed, quantified, and easy to scan."
            onFocus={() => setActiveStep('experience')}
            enabled={getSectionVisibility(content).experience}
            onToggleEnabled={(enabled) => updateVisibility('experience', enabled)}
          >
            <div className="space-y-4">
              {content.experience.map((exp, index) => (
                <DropTargetCard
                  key={`experience-${index}`}
                  title={`Experience ${index + 1}`}
                  helper="Drop a missing item or suggestion here to add it as a bullet."
                  onDropItem={(item) => addItemToExperience(index, item)}
                >
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
                      <LocationAutocompleteInput
                        value={exp.location || ''}
                        onChange={(value) => updateExperience(content, updateSection, index, 'location', value)}
                        placeholder="Start typing city or country"
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
                </DropTargetCard>
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
            id="projects"
            step={6}
            title="Projects"
            description="Use projects to support missing requirements with truthful, concrete examples."
            onFocus={() => setActiveStep('projects')}
            enabled={getSectionVisibility(content).projects}
            onToggleEnabled={(enabled) => updateVisibility('projects', enabled)}
          >
            <div className="space-y-4">
              {content.projects.map((project, index) => (
                <DropTargetCard
                  key={`project-${index}`}
                  title={`Project ${index + 1}`}
                  helper="Drop a missing item or suggestion here to add it as a project bullet."
                  onDropItem={(item) => addItemToProject(index, item)}
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">Project {index + 1}</div>
                    {content.projects.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => updateSection('projects', content.projects.filter((_, itemIndex) => itemIndex !== index))}
                        className="text-xs font-semibold text-rose-200 transition hover:text-rose-100"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FieldGroup label="Project name">
                      <BuilderInput
                        value={project.name}
                        onChange={(event) => updateProject(content, updateSection, index, 'name', event.target.value)}
                      />
                    </FieldGroup>
                    <FieldGroup label="Tech stack">
                      <BuilderInput
                        value={project.tech_stack}
                        onChange={(event) => updateProject(content, updateSection, index, 'tech_stack', event.target.value)}
                      />
                    </FieldGroup>
                  </div>
                  <div className="mt-4">
                    <FieldGroup label="Project summary">
                      <BuilderTextarea
                        rows={3}
                        value={project.summary || ''}
                        onChange={(event) => updateProject(content, updateSection, index, 'summary', event.target.value)}
                        placeholder="Short context for the project."
                      />
                    </FieldGroup>
                  </div>
                  <div className="mt-4">
                    <FieldGroup label="Project bullets">
                      <BuilderTextarea
                        rows={4}
                        value={(project.bullets || []).join('\n')}
                        onChange={(event) => updateProject(content, updateSection, index, 'bullets', toBulletList(event.target.value))}
                        placeholder="One bullet per line."
                      />
                    </FieldGroup>
                  </div>
                </DropTargetCard>
              ))}
            </div>
            <button
              type="button"
              onClick={() => updateSection('projects', [...content.projects, { name: '', tech_stack: '', summary: '', bullets: [''], url: '' }])}
              className="app-button-secondary mt-4"
            >
              Add project
            </button>
          </BuilderSection>

          <BuilderSection
            id="education"
            step={7}
            title="Education"
            description="Keep education concise, but include GPA or highlights when they strengthen the profile."
            onFocus={() => setActiveStep('education')}
            enabled={getSectionVisibility(content).education}
            onToggleEnabled={(enabled) => updateVisibility('education', enabled)}
          >
            <div className="space-y-4">
              {content.education.map((edu, index) => (
                <div key={`education-${index}`} className="app-panel-muted p-4">
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
            step={7}
            title="Skills"
            description="Keep missing items separate, drag across buckets, and move skills between sections as needed."
            onFocus={() => setActiveStep('skills')}
            enabled={getSectionVisibility(content).skills}
            onToggleEnabled={(enabled) => updateVisibility('skills', enabled)}
          >
            <SkillsSectionEditor
              categories={skillCategories}
              suggestions={skillInputSuggestions}
              onChange={updateSkillCategories}
              onMove={moveSkillAcrossGroups}
            />
          </BuilderSection>

          <BuilderSection
            id="extras"
            step={8}
            title="Extra Sections"
            description="Keep supporting information nearby so you can decide what strengthens this version of the resume."
            onFocus={() => setActiveStep('extras')}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FieldGroup
                label="Languages"
                action={(
                  <SectionToggle
                    label="Keep in resume"
                    enabled={getSectionVisibility(content).languages}
                    onChange={(enabled) => updateVisibility('languages', enabled)}
                  />
                )}
              >
                <BuilderTextarea
                  rows={4}
                  value={(content.languages || []).join('\n')}
                  onChange={(event) => updateSection('languages', toBulletList(event.target.value))}
                  placeholder="English&#10;Hindi&#10;German"
                />
              </FieldGroup>
              <FieldGroup
                label="Achievements"
                action={(
                  <SectionToggle
                    label="Keep in resume"
                    enabled={getSectionVisibility(content).achievements}
                    onChange={(enabled) => updateVisibility('achievements', enabled)}
                  />
                )}
              >
                <BuilderTextarea
                  rows={4}
                  value={(content.achievements || []).join('\n')}
                  onChange={(event) => updateSection('achievements', toBulletList(event.target.value))}
                  placeholder="Top performer award&#10;Hackathon winner"
                />
              </FieldGroup>
            </div>
            <div className="mt-4">
              <FieldGroup
                label="Hobbies or interests"
                action={(
                  <SectionToggle
                    label="Keep in resume"
                    enabled={getSectionVisibility(content).hobbies}
                    onChange={(enabled) => updateVisibility('hobbies', enabled)}
                  />
                )}
              >
                <BuilderTextarea
                  rows={3}
                  value={(content.hobbies || []).join('\n')}
                  onChange={(event) => updateSection('hobbies', toBulletList(event.target.value))}
                  placeholder="Open-source contribution&#10;Mentoring&#10;Technical writing"
                />
              </FieldGroup>
            </div>
          </BuilderSection>

          <BuilderSection
            id="layout"
            step={9}
            title="Review & Export"
            description="Review the final resume appearance and export."
            onFocus={() => setActiveStep('layout')}
          >
            <LinkStyleControl
              value={settings?.resume.formatting.linkStyle ?? 'compact'}
              disabled={!settings || savingLinkStyle}
              onChange={(value) => void updateLinkStyle(value)}
            />
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button type="button" onClick={handleResumePdfDownload} className="app-button-secondary">
                Export resume PDF
              </button>
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

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <section className="app-panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">Live resume preview</div>
                <div className="mt-1 text-xs text-[var(--text-secondary)]">Updates as you edit the form.</div>
              </div>
            </div>

            <div className="max-h-[calc(100vh-9rem)] overflow-y-auto bg-slate-100 p-5">
              <div className="mx-auto max-w-[760px] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
                <ResumePreview meta={previewMeta} content={content} settings={settings?.resume} />
              </div>
            </div>
          </section>
        </aside>
      </div>

      <section className="hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Live preview</div>
            <div className="mt-1 text-sm text-[var(--text-secondary)]">See every change as you edit.</div>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-[16px] border border-[var(--border-subtle)] bg-[rgba(4,10,18,0.72)] p-4">
          <div className="mx-auto max-w-4xl rounded-[18px] border border-black/8 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
            <ResumePreview meta={previewMeta} content={content} settings={settings?.resume} />
          </div>
        </div>
      </section>

      {placementState ? (
        <PlacementModal
          item={placementState.item}
          onClose={() => setPlacementState(null)}
          onAuto={() => {
            applyAutoPlacement(placementState.item);
            setPlacementState(null);
          }}
          onPlaceInSkill={(group) => {
            addItemToSpecificSkillGroup(placementState.item, group);
            setPlacementState(null);
          }}
          onPlaceInExperience={(index) => {
            addItemToExperience(index, placementState.item);
            setPlacementState(null);
          }}
          onPlaceInProject={(index) => {
            addItemToProject(index, placementState.item);
            setPlacementState(null);
          }}
          experience={content.experience}
          projects={content.projects}
          skillCategories={skillCategories}
        />
      ) : null}

      <ChatAssistant
        open={chatOpen}
        messages={chatMessages}
        input={chatInput}
        loading={chatLoading}
        onOpenChange={setChatOpen}
        onInputChange={setChatInput}
        onSubmit={() => void handleChatSubmit()}
      />

    </div>
  );
}

function ChatAssistant({
  open,
  messages,
  input,
  loading,
  onOpenChange,
  onInputChange,
  onSubmit,
}: {
  open: boolean;
  messages: ChatMessage[];
  input: string;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <>
      {open ? (
        <div className="fixed bottom-24 right-6 z-[150] flex h-[560px] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[22px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-[0_28px_90px_rgba(15,23,42,0.35)]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">Resume Assistant</div>
              <div className="text-xs text-[var(--text-secondary)]">Chat to update fields</div>
            </div>
            <button type="button" onClick={() => onOpenChange(false)} className="app-button-secondary px-3 py-2 text-xs">
              Close
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-[var(--bg-panel-muted)] p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[88%] rounded-[16px] px-4 py-3 text-sm leading-6 ${
                  message.role === 'user'
                    ? 'ml-auto bg-[var(--accent)] text-[#06111d]'
                    : 'mr-auto border border-[var(--border-subtle)] bg-[var(--bg-panel)] text-[var(--text-primary)]'
                }`}
              >
                {message.text}
              </div>
            ))}
            {loading ? (
              <div className="mr-auto max-w-[88%] rounded-[16px] border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                Thinking...
              </div>
            ) : null}
          </div>

          <div className="border-t border-[var(--border-subtle)] p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(event) => onInputChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !loading) {
                    event.preventDefault();
                    onSubmit();
                  }
                }}
                className="input-shell"
                placeholder="Message..."
                disabled={loading}
              />
              <button type="button" onClick={onSubmit} disabled={loading} className="app-button-primary px-4 disabled:cursor-wait disabled:opacity-60">
                {loading ? '...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="fixed bottom-6 right-6 z-[151] inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-[#06111d] shadow-[0_18px_50px_rgba(59,130,246,0.35)] transition hover:scale-105"
        aria-label={open ? 'Hide resume assistant' : 'Open resume assistant'}
      >
        <AiSparkIcon className="h-5 w-5" />
      </button>
    </>
  );
}

function BuilderSection({
  id,
  step,
  title,
  description,
  children,
  onFocus,
  enabled,
  onToggleEnabled,
}: {
  id: BuilderStepId;
  step: number;
  title: string;
  description: string;
  children: React.ReactNode;
  onFocus: () => void;
  enabled?: boolean;
  onToggleEnabled?: (enabled: boolean) => void;
}) {
  return (
    <section id={`builder-step-${id}`} className="app-panel relative overflow-visible p-5 focus-within:z-[70]" onMouseEnter={onFocus}>
      <div className="flex items-start gap-4">
        <div className="inline-flex h-10 min-w-[40px] items-center justify-center rounded-[12px] bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent-strong)]">
          {step}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{title}</h2>
            {onToggleEnabled ? (
              <SectionToggle label="Keep in resume" enabled={enabled ?? true} onChange={onToggleEnabled} />
            ) : null}
          </div>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function LinkStyleControl({
  value,
  disabled,
  onChange,
}: {
  value: ResumeLinkStyle;
  disabled: boolean;
  onChange: (value: ResumeLinkStyle) => void;
}) {
  const options: Array<{ value: ResumeLinkStyle; label: string; description: string }> = [
    { value: 'compact', label: 'Key names', description: 'Email, Phone, Location, LinkedIn' },
    { value: 'icons', label: 'Icons + values', description: 'Icon with the actual value' },
    { value: 'full', label: 'Key + values', description: 'Show label with the full value' },
  ];

  return (
    <div className="rounded-[16px] border border-[var(--border-subtle)] bg-[var(--bg-panel-muted)] p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">Contact link display</div>
          <div className="mt-1 text-xs text-[var(--text-secondary)]">Choose how contact details and professional links appear in the resume header.</div>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={`rounded-[12px] border px-3 py-3 text-left transition disabled:cursor-wait disabled:opacity-60 ${
                active
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-panel)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">{option.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProfileReadinessCard({
  readiness,
}: {
  readiness: { score: number; completed: number; total: number; nextSteps: string[] };
}) {
  const tone = getScoreTone(readiness.score);
  const toneClass =
    tone === 'high'
      ? 'border-emerald-400/20 bg-emerald-400/10'
      : tone === 'medium'
        ? 'border-amber-400/20 bg-amber-400/10'
        : 'border-rose-400/20 bg-rose-400/10';

  return (
    <div className={`rounded-[12px] border px-3 py-2 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-[var(--text-primary)]">Profile readiness</div>
          <div className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{readiness.completed}/{readiness.total} complete</div>
        </div>
        <div className="text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{readiness.score}%</div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/30">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(readiness.score, 4)}%`, background: getScoreFill(readiness.score) }} />
      </div>
      {readiness.nextSteps.length > 0 ? (
        <div className="mt-1 truncate text-[11px] text-[var(--text-secondary)]">Next: {readiness.nextSteps[0]}</div>
      ) : (
        <p className="mt-1 text-[11px] text-[var(--text-secondary)]">Core profile is ready.</p>
      )}
    </div>
  );
}

function MiniMeta({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel-muted)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)]">
      <span className="font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">{label}</span>
      <span className="max-w-[120px] truncate font-medium text-[var(--text-primary)]">{value}</span>
    </span>
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

function FieldGroup({ label, children, action }: { label: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="relative z-[1] block focus-within:z-[80]">
      <span className="mb-2 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
        <span>{label}</span>
        {action}
      </span>
      {children}
    </div>
  );
}

function BuilderInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input-shell ${props.className || ''}`} />;
}

function LocationAutocompleteInput({
  value,
  onChange,
  placeholder = 'Start typing city or country',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [results, setResults] = useState<Array<{ id: string; label: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  const deferredQuery = useDeferredValue(value.trim());

  useEffect(() => {
    if (deferredQuery.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    let active = true;
    setSearching(true);

    fetch(`/api/location-search?q=${encodeURIComponent(deferredQuery)}`, {
      cache: 'no-store',
    })
      .then((response) => response.json())
      .then((data: { results?: Array<{ id: string; label: string }> }) => {
        if (active) setResults(data.results ?? []);
      })
      .catch(() => {
        if (active) setResults([]);
      })
      .finally(() => {
        if (active) setSearching(false);
      });

    return () => {
      active = false;
    };
  }, [deferredQuery]);

  return (
    <div className="relative z-[1] focus-within:z-[90]">
      <input
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="input-shell"
      />
      {focused && deferredQuery.length >= 2 && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[120] overflow-hidden rounded-[18px] border bg-[var(--bg-panel)] shadow-[var(--shadow-panel)]" style={{ borderColor: 'var(--border-subtle)' }}>
          {searching ? (
            <div className="px-4 py-3 text-sm text-[var(--text-secondary)]">Searching cities and countries...</div>
          ) : results.length ? (
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onChange(item.label);
                  setFocused(false);
                }}
                className="block w-full border-b px-4 py-3 text-left text-sm text-[var(--text-secondary)] transition last:border-b-0 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                {item.label}
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-[var(--text-secondary)]">No location found. Your typed value will still be used.</div>
          )}
        </div>
      )}
    </div>
  );
}

function BuilderTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`input-shell resize-y ${props.className || ''}`} />;
}

function SkillsSectionEditor({
  categories,
  suggestions,
  onChange,
  onMove,
}: {
  categories: SkillCategory[];
  suggestions: string[];
  onChange: (categories: SkillCategory[]) => void;
  onMove: (skill: string, from: SkillGroupKey, to: SkillGroupKey) => void;
}) {
  function updateCategory(categoryId: string, updates: Partial<SkillCategory>) {
    onChange(categories.map((category) => (category.id === categoryId ? { ...category, ...updates } : category)));
  }

  function addCategory() {
    onChange([...categories, createSkillCategory(`Category ${categories.length + 1}`)]);
  }

  function addSkill(categoryId: string, skill: string) {
    const clean = skill.trim();
    if (!clean) return;
    onChange(
      categories.map((category) =>
        category.id === categoryId ? { ...category, skills: uniqueLines([...category.skills, clean]) } : category
      )
    );
  }

  function removeSkill(categoryId: string, skill: string) {
    onChange(
      categories.map((category) =>
        category.id === categoryId
          ? { ...category, skills: category.skills.filter((item) => item.toLowerCase() !== skill.toLowerCase()) }
          : category
      )
    );
  }

  function moveCategory(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;

    const sourceIndex = categories.findIndex((category) => category.id === sourceId);
    const targetIndex = categories.findIndex((category) => category.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const next = [...categories];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    onChange(next);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-[var(--text-secondary)]">Create your own categories and add skills under each one.</div>
        <button type="button" onClick={addCategory} className="app-button-primary px-3 py-2 text-xs">
          Add category
        </button>
      </div>
      <div className="grid gap-3">
        {categories.map((category) => (
          <SkillDropZone
            key={category.id}
            category={category}
            suggestions={suggestions}
            onRename={(label) => updateCategory(category.id, { label })}
            onAddSkill={(skill) => addSkill(category.id, skill)}
            onMove={onMove}
            onRemoveSkill={(skill) => removeSkill(category.id, skill)}
            onMoveCategory={(sourceId) => moveCategory(sourceId, category.id)}
            onRemoveCategory={() => onChange(categories.filter((item) => item.id !== category.id))}
          />
        ))}
        {categories.length === 0 ? (
          <div className="app-panel-muted p-5 text-sm text-[var(--text-secondary)]">
            No skill categories yet. Add one like Backend, AI, Database, Cloud, or Tools.
          </div>
        ) : null}
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

function updateProject(
  content: ResumeContent,
  updateSection: <K extends keyof ResumeContent>(section: K, value: ResumeContent[K]) => void,
  index: number,
  field: keyof ResumeContent['projects'][number],
  value: string | string[]
) {
  const next = [...content.projects];
  next[index] = { ...next[index], [field]: value };
  updateSection('projects', next);
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

function calculateProfileReadiness(profile: FullProfile | null, content: ResumeContent | null, resume: Resume | null) {
  const normalizedProfile = normalizeProfile(profile);
  const checks: Array<{ label: string; done: boolean }> = [
    { label: 'Add company name', done: Boolean(resume?.company_name?.trim()) },
    { label: 'Add target role', done: Boolean(resume?.job_title?.trim()) },
    { label: 'Add full name', done: Boolean(normalizedProfile.name?.trim()) },
    { label: 'Add email', done: Boolean(normalizedProfile.email?.trim()) },
    { label: 'Add phone', done: Boolean(normalizedProfile.phone?.trim()) },
    { label: 'Add location', done: Boolean(normalizedProfile.location?.trim()) },
    { label: 'Add one professional link', done: [normalizedProfile.linkedin, normalizedProfile.github, normalizedProfile.website].some((item) => Boolean(item?.trim())) },
    { label: 'Write summary', done: Boolean(content?.summary?.trim()) },
    {
      label: 'Add work experience',
      done: Boolean(content?.experience?.some((item) => item.job_title?.trim() && item.company?.trim() && item.bullets?.some((bullet) => bullet.trim()))),
    },
    {
      label: 'Add skills',
      done: Boolean(content && getSkillCategories(content.skills).some((category) => category.label.trim() && category.skills.length > 0)),
    },
    {
      label: 'Add education',
      done: Boolean(content?.education?.some((item) => item.degree?.trim() || item.institution?.trim())),
    },
  ];
  const completed = checks.filter((check) => check.done).length;

  return {
    score: Math.round((completed / checks.length) * 100),
    completed,
    total: checks.length,
    nextSteps: checks.filter((check) => !check.done).slice(0, 3).map((check) => check.label),
  };
}

function inferStepFromChat(message: string): BuilderStepId {
  const lower = message.toLowerCase();
  if (lower.includes('summary')) return 'summary';
  if (lower.includes('skill') || lower.includes('keyword')) return 'skills';
  if (lower.includes('experience') || lower.includes('work')) return 'experience';
  if (lower.includes('project')) return 'projects';
  if (lower.includes('education') || lower.includes('degree')) return 'education';
  if (lower.includes('linkedin') || lower.includes('github') || lower.includes('portfolio') || lower.includes('website')) return 'links';
  if (lower.includes('name') || lower.includes('email') || lower.includes('phone') || lower.includes('location')) return 'personal';
  if (lower.includes('achievement') || lower.includes('language') || lower.includes('hobb')) return 'extras';
  return 'layout';
}

function getAiFocusText(
  step: BuilderStepId,
  content: ResumeContent,
  profile: FullProfile | null
) {
  if (step === 'summary') return content.summary || '';
  if (step === 'skills') return JSON.stringify(content.skills);
  if (step === 'experience') return content.experience.flatMap((item) => item.bullets).join('\n');
  if (step === 'education') return content.education.flatMap((item) => item.bullets || []).join('\n');
  if (step === 'links') return [profile?.linkedin, profile?.github, profile?.website].filter(Boolean).join('\n');

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

function hydrateResumeContent(content: ResumeContent, profile: FullProfile | null) {
  const normalizedProfile = normalizeProfile(profile);
  return {
    ...content,
    achievements: content.achievements ?? normalizedProfile.achievements ?? [],
    languages: content.languages ?? normalizedProfile.languages ?? [],
    hobbies: content.hobbies ?? normalizedProfile.hobbies ?? [],
    section_visibility: {
      ...defaultSectionVisibility(),
      ...(content.section_visibility || {}),
    },
  };
}

function defaultSectionVisibility() {
  return {
    summary: true,
    skills: true,
    experience: true,
    projects: true,
    achievements: true,
    education: true,
    languages: true,
    hobbies: true,
  };
}

function getSectionVisibility(content: ResumeContent) {
  return {
    ...defaultSectionVisibility(),
    ...(content.section_visibility || {}),
  };
}

function SectionToggle({
  label,
  enabled,
  onChange,
}: {
  label: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`inline-flex items-center gap-2 rounded-[10px] border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition ${
        enabled
          ? 'border-blue-500/35 bg-blue-50 text-blue-700'
          : 'border-white/10 bg-white/5 text-[var(--text-dim)]'
      }`}
    >
      <span>{label}</span>
    </button>
  );
}

function PendingChip({
  item,
  source,
  tone,
  onPlace,
}: {
  item: string;
  source: SuggestionSource;
  tone: 'rose' | 'cyan';
  onPlace: (item: string, source: SuggestionSource) => void;
}) {
  const chipClass =
    tone === 'rose'
      ? 'border-rose-400/20 bg-rose-400/10 text-rose-100'
      : 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100';

  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'pending', value: item, source } satisfies DragPayload));
      }}
      className={`inline-flex items-center gap-2 rounded-[10px] border px-2.5 py-1 text-[11px] font-medium ${chipClass}`}
    >
      <span>{item}</span>
      <button
        type="button"
        onClick={() => onPlace(item, source)}
        className="rounded-[8px] border border-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
      >
        Add
      </button>
    </div>
  );
}

function SkillDropZone({
  category,
  suggestions,
  onRename,
  onAddSkill,
  onMove,
  onRemoveSkill,
  onMoveCategory,
  onRemoveCategory,
}: {
  category: SkillCategory;
  suggestions: string[];
  onRename: (label: string) => void;
  onAddSkill: (skill: string) => void;
  onMove: (skill: string, from: SkillGroupKey, to: SkillGroupKey) => void;
  onRemoveSkill: (skill: string) => void;
  onMoveCategory: (sourceId: string) => void;
  onRemoveCategory: () => void;
}) {
  const [draftSkill, setDraftSkill] = useState('');
  const [skillInputFocused, setSkillInputFocused] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [remoteSkillSuggestions, setRemoteSkillSuggestions] = useState<string[]>([]);
  const [searchingSkills, setSearchingSkills] = useState(false);
  const deferredSkillQuery = useDeferredValue(draftSkill.trim());
  const skillSuggestions = useMemo(
    () => buildSkillInputSuggestions(deferredSkillQuery, remoteSkillSuggestions, suggestions, category.skills),
    [category.skills, deferredSkillQuery, remoteSkillSuggestions, suggestions]
  );

  useEffect(() => {
    if (deferredSkillQuery.length < 2) {
      setRemoteSkillSuggestions([]);
      setSearchingSkills(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setSearchingSkills(true);
      fetch(`/api/skill-suggestions?q=${encodeURIComponent(deferredSkillQuery)}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : { results: [] }))
        .then((data: { results?: string[] }) => {
          setRemoteSkillSuggestions(Array.isArray(data.results) ? data.results : []);
        })
        .catch((error) => {
          if (!(error instanceof DOMException && error.name === 'AbortError')) {
            setRemoteSkillSuggestions([]);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setSearchingSkills(false);
          }
        });
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [deferredSkillQuery]);

  function submitSkill() {
    const value = skillSuggestions[0] ?? draftSkill;
    if (!value.trim()) return;
    onAddSkill(value);
    setDraftSkill('');
    setSkillInputFocused(false);
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const payload = parseDragPayload(event);
        if (!payload) return;
        if (payload.kind === 'category') {
          onMoveCategory(payload.categoryId);
        } else if (payload.kind === 'skill') {
          onMove(payload.value, payload.sourceGroup, category.id);
        } else {
          onAddSkill(payload.value);
        }
      }}
      className={`relative grid grid-cols-[32px_minmax(0,1fr)] overflow-visible rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-panel-muted)] transition ${
        dragOver ? 'bg-[var(--accent-soft)]' : ''
      }`}
    >
      <button
        type="button"
        draggable
        aria-label={`Drag ${category.label || 'skill category'} category`}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'category', categoryId: category.id } satisfies DragPayload));
        }}
        className="flex min-h-full cursor-grab items-center justify-center text-[var(--text-dim)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--border-strong)] active:cursor-grabbing"
      >
        <DragHandleIcon />
      </button>
      <div className="min-w-0 p-4">
        <div className="mb-3 grid gap-2 lg:grid-cols-[minmax(160px,0.7fr)_minmax(220px,1fr)_auto] lg:items-center">
          <input
            value={category.label}
            onChange={(event) => onRename(event.target.value)}
            className="min-w-0 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] outline-none"
            placeholder="Category name"
          />
          <div className="relative z-[1] focus-within:z-[70]">
            <input
              value={draftSkill}
              onFocus={() => setSkillInputFocused(true)}
              onBlur={() => window.setTimeout(() => setSkillInputFocused(false), 120)}
              onChange={(event) => setDraftSkill(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submitSkill();
                }
              }}
              className="input-shell py-2"
              placeholder={`Add skill to ${category.label || 'category'}`}
            />
            {skillInputFocused && draftSkill.trim().length >= 2 && (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[90] overflow-hidden rounded-[14px] border bg-[var(--bg-panel)] shadow-[var(--shadow-panel)]" style={{ borderColor: 'var(--border-subtle)' }}>
                {searchingSkills && skillSuggestions.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-[var(--text-secondary)]">Searching skills...</div>
                ) : skillSuggestions.length ? (
                  skillSuggestions.map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => {
                        onAddSkill(skill);
                        setDraftSkill('');
                        setSkillInputFocused(false);
                      }}
                      className="block w-full border-b px-3 py-2 text-left text-xs font-medium text-[var(--text-secondary)] transition last:border-b-0 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      {skill}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-xs text-[var(--text-secondary)]">Press Enter to add "{draftSkill.trim()}".</div>
                )}
              </div>
            )}
          </div>
          <button type="button" onClick={onRemoveCategory} className="app-button-secondary px-3 py-2 text-xs">
            Remove
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {category.skills.length > 0 ? (
            category.skills.map((skill) => (
              <button
                key={`${category.id}-${skill}`}
                type="button"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'skill', value: skill, sourceGroup: category.id } satisfies DragPayload));
                }}
                onClick={() => onRemoveSkill(skill)}
                className="inline-flex items-center gap-1 rounded-[10px] border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-medium text-cyan-100 transition hover:border-rose-400/20 hover:bg-rose-400/10 hover:text-rose-100"
              >
                {skill}
                <span className="text-[10px] font-semibold">×</span>
              </button>
            ))
          ) : (
            <span className="text-[11px] text-[var(--text-dim)]">No items here yet.</span>
          )}
        </div>
      </div>
    </div>
  );
}

function DragHandleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="4" r="1" />
      <circle cx="5" cy="8" r="1" />
      <circle cx="5" cy="12" r="1" />
      <circle cx="11" cy="4" r="1" />
      <circle cx="11" cy="8" r="1" />
      <circle cx="11" cy="12" r="1" />
    </svg>
  );
}

function DropTargetCard({
  title,
  helper,
  onDropItem,
  children,
}: {
  title: string;
  helper: string;
  onDropItem: (item: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const payload = parseDragPayload(event);
        if (!payload || payload.kind === 'category') return;
        onDropItem(payload.value);
      }}
      className="app-panel-muted relative overflow-visible p-4"
    >
      <div className="mb-3 rounded-[10px] border border-dashed border-[var(--border-subtle)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-[11px] leading-5 text-[var(--text-dim)]">
        <span className="font-semibold text-[var(--text-secondary)]">{title} dropzone:</span> {helper}
      </div>
      {children}
    </div>
  );
}

function PlacementModal({
  item,
  experience,
  projects,
  skillCategories,
  onClose,
  onAuto,
  onPlaceInSkill,
  onPlaceInExperience,
  onPlaceInProject,
}: {
  item: string;
  experience: ResumeContent['experience'];
  projects: ResumeContent['projects'];
  skillCategories: SkillCategory[];
  onClose: () => void;
  onAuto: () => void;
  onPlaceInSkill: (group: SkillGroupKey) => void;
  onPlaceInExperience: (index: number) => void;
  onPlaceInProject: (index: number) => void;
}) {
  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="Close placement modal" />
      <div className="relative z-[1] w-full max-w-3xl rounded-[20px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 shadow-[var(--shadow-panel)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Place item</div>
            <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{item}</h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Choose exactly where this should go, or let the system decide.</p>
          </div>
          <button type="button" onClick={onClose} className="app-button-secondary px-3 py-2 text-xs">Close</button>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <div className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">Auto</div>
            <button type="button" onClick={onAuto} className="app-button-primary w-full justify-center text-xs">
              Decide yourself
            </button>
          </div>

          <div className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">Skills</div>
            <div className="space-y-2">
              {skillCategories.map((group) => (
                <button key={group.id} type="button" onClick={() => onPlaceInSkill(group.id)} className="app-button-secondary w-full justify-start px-3 py-2 text-xs">
                  {group.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">Experience</div>
              <div className="mt-2 space-y-2">
                {experience.map((entry, index) => (
                  <button key={`${entry.company}-${index}`} type="button" onClick={() => onPlaceInExperience(index)} className="app-button-secondary w-full justify-start px-3 py-2 text-xs">
                    {entry.job_title || `Experience ${index + 1}`} at {entry.company || 'Untitled company'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">Projects</div>
              <div className="mt-2 space-y-2">
                {projects.map((project, index) => (
                  <button key={`placement-project-${index}`} type="button" onClick={() => onPlaceInProject(index)} className="app-button-secondary w-full justify-start px-3 py-2 text-xs">
                    {project.name || `Project ${index + 1}`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function parseDragPayload(event: React.DragEvent<HTMLElement>): DragPayload | null {
  try {
    const raw = event.dataTransfer.getData('text/plain');
    if (!raw) return null;
    return JSON.parse(raw) as DragPayload;
  } catch {
    return null;
  }
}

function classifyDropGroup(item: string): SkillGroupKey {
  const lower = item.toLowerCase();
  if (lower.includes('team') || lower.includes('communication') || lower.includes('leadership') || lower.includes('stakeholder')) {
    return 'soft';
  }
  if (lower.includes('kafka') || lower.includes('sqs') || lower.includes('nats') || lower.includes('event')) {
    return 'streaming_messaging';
  }
  if (lower.includes('aws') || lower.includes('kubernetes') || lower.includes('docker') || lower.includes('terraform') || lower.includes('cloud')) {
    return 'cloud_infra';
  }
  if (lower.includes('postgres') || lower.includes('redis') || lower.includes('mongo') || lower.includes('db')) {
    return 'databases_storage';
  }
  if (lower.includes('langchain') || lower.includes('llm') || lower.includes('rag') || lower.includes('ai')) {
    return 'ai_genai';
  }
  if (lower.includes('java') || lower.includes('python') || lower.includes('typescript') || lower.includes('go')) {
    return 'languages';
  }
  if (lower.includes('react') || lower.includes('api') || lower.includes('microservice') || lower.includes('spring') || lower.includes('fastapi')) {
    return 'backend_frameworks';
  }
  if (lower.includes('git') || lower.includes('jira') || lower.includes('linux') || lower.includes('grafana')) {
    return 'tools_platforms';
  }
  return 'other';
}

function getSkillCategories(skills: ResumeSkills): SkillCategory[] {
  if (Object.prototype.hasOwnProperty.call(skills, 'categories')) {
    return (skills.categories ?? []).map((category) => ({
      id: category.id,
      label: category.label,
      skills: uniqueLines(category.skills || []),
    }));
  }

  const normalized = normalizeResumeSkills(skills);
  const legacyGroups: Array<{ label: string; skills: string[] }> = [
    { label: 'Languages', skills: normalized.technical.languages },
    { label: 'Backend', skills: normalized.technical.backend_frameworks },
    { label: 'AI', skills: normalized.technical.ai_genai },
    { label: 'Streaming / Messaging', skills: normalized.technical.streaming_messaging },
    { label: 'Database', skills: normalized.technical.databases_storage },
    { label: 'Cloud / Infra', skills: normalized.technical.cloud_infra },
    { label: 'Tools', skills: normalized.technical.tools_platforms },
    { label: 'Other', skills: normalized.technical.other },
    { label: 'Soft Skills', skills: normalized.soft },
  ];

  return legacyGroups
    .filter((group) => group.skills.length > 0)
    .map((group) => createSkillCategory(group.label, group.skills));
}

function ensureSkillCategories(skills: ResumeSkills) {
  const categories = getSkillCategories(skills);
  return categories;
}

function createSkillCategory(label: string, skills: string[] = []): SkillCategory {
  return {
    id: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    skills: uniqueLines(skills),
  };
}

function setSkillCategories(skills: ResumeSkills, categories: SkillCategory[]): ResumeSkills {
  return {
    ...skills,
    categories: categories.map((category) => ({
      id: category.id,
      label: category.label,
      skills: uniqueLines(category.skills),
    })),
  };
}

function addSkillToCategory(skills: ResumeSkills, categoryId: SkillGroupKey, item: string): ResumeSkills {
  const clean = item.trim();
  if (!clean) return skills;

  const categories = ensureSkillCategories(skills);
  const target = categories.find((category) => category.id === categoryId) ?? categories[0] ?? createSkillCategory('Skills');
  const nextCategories = categories.length ? categories : [target];
  return setSkillCategories(
    skills,
    nextCategories.map((category) =>
      category.id === target.id ? { ...category, skills: uniqueLines([...category.skills, clean]) } : category
    )
  );
}

function removeSkillFromCategory(skills: ResumeSkills, categoryId: SkillGroupKey, item: string): ResumeSkills {
  const categories = ensureSkillCategories(skills);
  return setSkillCategories(
    skills,
    categories.map((category) =>
      category.id === categoryId
        ? { ...category, skills: category.skills.filter((skill) => skill.toLowerCase() !== item.toLowerCase()) }
        : category
    )
  );
}

function moveItemIntoSkillGroup(skills: ResumeContent['skills'], item: string, group: SkillGroupKey): ResumeContent['skills'] {
  const clean = item.trim();
  if (!clean) return skills;
  return addSkillToCategory(skills, group, clean);
}

function uniqueLines(items: string[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const normalized = item.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function buildSkillInputSuggestions(query: string, remoteSuggestions: string[], localSuggestions: string[], currentSkills: string[]) {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length < 2) return [];

  const existing = new Set(currentSkills.map((skill) => skill.trim().toLowerCase()).filter(Boolean));
  const remoteMatches = rankSkillSuggestions(remoteSuggestions, normalizedQuery, existing);
  const localMatches = rankSkillSuggestions(localSuggestions, normalizedQuery, existing);

  return uniqueLines([...remoteMatches, ...localMatches]).slice(0, 5);
}

function rankSkillSuggestions(suggestions: string[], normalizedQuery: string, existing: Set<string>) {
  return uniqueLines(suggestions)
    .map((skill) => ({ skill, score: getSkillSuggestionScore(skill, normalizedQuery) }))
    .filter(({ skill, score }) => isLikelyTechSkill(skill) && !existing.has(skill.trim().toLowerCase()) && score < 100)
    .sort((left, right) => {
      if (left.score !== right.score) return left.score - right.score;
      return left.skill.length - right.skill.length;
    })
    .map(({ skill }) => skill);
}

function getSkillSuggestionScore(skill: string, normalizedQuery: string) {
  const normalizedSkill = skill.trim().toLowerCase();
  const compactSkill = normalizedSkill.replace(/[^a-z0-9]/g, '');
  const compactQuery = normalizedQuery.replace(/[^a-z0-9]/g, '');

  if (normalizedSkill === normalizedQuery) return 0;
  if (normalizedSkill.startsWith(normalizedQuery) || compactSkill.startsWith(compactQuery)) return 1;
  if (normalizedSkill.includes(normalizedQuery) || compactSkill.includes(compactQuery)) return 3;
  if (isSubsequence(compactQuery, compactSkill)) return 5;
  return 100;
}

function isSubsequence(query: string, value: string) {
  if (!query) return false;
  let queryIndex = 0;
  for (const character of value) {
    if (character === query[queryIndex]) queryIndex += 1;
    if (queryIndex === query.length) return true;
  }
  return false;
}
