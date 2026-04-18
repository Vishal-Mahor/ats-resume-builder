'use client';

import Link from 'next/link';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { api, type ResumeTemplate, type UserSettings } from '@/lib/api';

type SettingsTab = 'general' | 'notifications' | 'exports' | 'privacy' | 'resume';

const SETTINGS_TABS: Array<{ id: SettingsTab; label: string; description: string }> = [
  { id: 'general', label: 'General', description: 'Workspace identity and default behavior' },
  { id: 'notifications', label: 'Notifications', description: 'Email and workflow alerts' },
  { id: 'exports', label: 'Exports', description: 'PDF naming and template defaults' },
  { id: 'privacy', label: 'Privacy', description: 'Data retention and verification status' },
  { id: 'resume', label: 'Resume', description: 'Formatting, structure, and prompt templates' },
];

function createPromptDefaults() {
  return {
    jdParsing: { label: 'JD parsing', description: 'Parse the job description.', defaultTemplate: 'Default JD parsing prompt.', customTemplate: '', activeMode: 'default' as const },
    candidateEvidence: { label: 'Candidate evidence', description: 'Extract evidence from profile.', defaultTemplate: 'Default candidate evidence prompt.', customTemplate: '', activeMode: 'default' as const },
    relevanceMapping: { label: 'Relevance mapping', description: 'Map JD to evidence.', defaultTemplate: 'Default relevance mapping prompt.', customTemplate: '', activeMode: 'default' as const },
    experienceRewrite: { label: 'Experience rewrite', description: 'Rewrite experience and project bullets.', defaultTemplate: 'Default experience rewrite prompt.', customTemplate: '', activeMode: 'default' as const },
    summaryGeneration: { label: 'Summary generation', description: 'Generate the summary.', defaultTemplate: 'Default summary generation prompt.', customTemplate: '', activeMode: 'default' as const },
    atsEvaluation: { label: 'ATS evaluation', description: 'Score ATS alignment.', defaultTemplate: 'Default ATS evaluation prompt.', customTemplate: '', activeMode: 'default' as const },
    finalAssembly: { label: 'Final assembly', description: 'Assemble the final resume.', defaultTemplate: 'Default final assembly prompt.', customTemplate: '', activeMode: 'default' as const },
    coverLetter: { label: 'Cover letter', description: 'Generate the cover letter.', defaultTemplate: 'Default cover letter prompt.', customTemplate: '', activeMode: 'default' as const },
  };
}

const DEFAULT_SETTINGS: UserSettings = {
  workspaceName: 'ATS Resume Builder Workspace',
  defaultSourcePlatform: 'manual',
  defaultRegion: 'India',
  verificationRequirement: 'optional-before-generation',
  notifications: {
    productUpdates: true,
    resumeReady: true,
    atsAlerts: true,
    verificationAlerts: true,
  },
  exports: {
    defaultTemplate: 'clarity',
    fileStyle: 'role-company-date',
    includeCoverLetter: true,
  },
  privacy: {
    keepResumeHistory: true,
    allowAiReuse: true,
    requireVerificationBeforeExport: false,
  },
  resume: {
    formatting: {
      summaryMaxWords: 25,
      maxBulletsPerSection: 5,
      skillsSeparator: 'comma',
      linkStyle: 'compact',
      pageSize: 'A4',
      repeatSectionHeadingsOnNewPage: true,
      showPageNumbers: true,
    },
    structure: {
      sectionOrder: ['summary', 'skills', 'experience', 'projects', 'achievements', 'education', 'languages', 'hobbies'],
      defaultSectionVisibility: {
        summary: true,
        skills: true,
        experience: true,
        projects: true,
        achievements: true,
        education: true,
        languages: true,
        hobbies: true,
      },
      maxProjects: 4,
      maxEducationItems: 3,
    },
    prompts: createPromptDefaults(),
  },
};

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab = useMemo<SettingsTab>(() => {
    if (requestedTab && SETTINGS_TABS.some((tab) => tab.id === requestedTab)) {
      return requestedTab as SettingsTab;
    }
    return 'general';
  }, [requestedTab]);

  const [templates, setTemplates] = useState<ResumeTemplate[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.settings.get(), api.templates.list()])
      .then(([settingsResult, templateResult]) => {
        const normalizedSettings = {
          ...settingsResult,
          exports: {
            ...settingsResult.exports,
            defaultTemplate:
              templateResult.find((template) => template.id === settingsResult.exports.defaultTemplate)?.id ??
              templateResult[0]?.id ??
              settingsResult.exports.defaultTemplate,
          },
        };
        setSettings(normalizedSettings);
        setSavedSettings(normalizedSettings);
        setTemplates(templateResult);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Failed to load settings.'))
      .finally(() => setLoading(false));
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(savedSettings),
    [savedSettings, settings]
  );

  async function handleSave() {
    setSaving(true);
    try {
      const nextSettings = await api.settings.update(settings);
      setSettings(nextSettings);
      setSavedSettings(nextSettings);
      window.dispatchEvent(new CustomEvent('workspace-settings-updated', { detail: nextSettings }));
      toast.success('Settings saved.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  function resetChanges() {
    setSettings(savedSettings);
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

  return (
    <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
      <aside className="space-y-4">
        <div className="app-panel p-5">
          <div className="app-eyebrow">Settings map</div>
          <h2 className="app-subheading mt-2">
            Workspace controls
          </h2>
          <div className="mt-4 space-y-2">
            {SETTINGS_TABS.map((tab) => {
              const active = tab.id === activeTab;
              return (
                <Link
                  key={tab.id}
                  href={tab.id === 'general' ? '/settings' : `/settings?tab=${tab.id}`}
                  className="block rounded-[18px] border px-4 py-4 transition hover:bg-[var(--bg-hover)]"
                  style={{
                    borderColor: active ? 'var(--border-strong)' : 'var(--border-subtle)',
                    background: active ? 'rgba(255,255,255,0.04)' : 'transparent',
                  }}
                >
                  <div className="text-sm font-semibold text-[var(--text-primary)]">{tab.label}</div>
                  <div className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{tab.description}</div>
                </Link>
              );
            })}
          </div>
        </div>
      </aside>

      <section className="space-y-6">
        <div className="app-panel-strong p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="app-badge">Settings</div>
              <h2 className="app-heading mt-4">
                Configure how your resume workspace behaves
              </h2>
              <p className="app-body mt-3 max-w-2xl">
                These settings are saved per user, not globally. Your notification rules, export defaults, privacy controls, and workspace preferences stay tied to your own account.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={resetChanges}
                disabled={!isDirty || saving}
                className="app-button-secondary disabled:cursor-not-allowed disabled:opacity-60"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!isDirty || saving}
                className="app-button-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save settings'}
              </button>
            </div>
          </div>
        </div>

        {activeTab === 'general' && (
          <SectionCard
            eyebrow="General settings"
            title="Workspace identity and defaults"
            description="Baseline preferences that shape the rest of your personal app experience."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <SelectCard
                label="Default source platform"
                value={settings.defaultSourcePlatform}
                options={[
                  { value: 'manual', label: 'Manual' },
                  { value: 'linkedin', label: 'LinkedIn' },
                  { value: 'indeed', label: 'Indeed' },
                  { value: 'naukri', label: 'Naukri' },
                ]}
                onChange={(value) =>
                  setSettings((current) => ({
                    ...current,
                    defaultSourcePlatform: value as UserSettings['defaultSourcePlatform'],
                  }))
                }
              />
              <CountryAutocompleteInput
                label="Default region"
                value={settings.defaultRegion}
                onChange={(value) => setSettings((current) => ({ ...current, defaultRegion: value }))}
                placeholder="India"
              />
            </div>
          </SectionCard>
        )}

        {activeTab === 'notifications' && (
          <SectionCard
            eyebrow="Notifications"
            title="Choose which updates should reach you"
            description="These switches are saved for your account only."
          >
            <div className="space-y-3">
              <ToggleRow
                label="Product updates"
                description="Receive occasional product and feature announcements."
                checked={settings.notifications.productUpdates}
                onChange={(checked) =>
                  setSettings((current) => ({
                    ...current,
                    notifications: { ...current.notifications, productUpdates: checked },
                  }))
                }
              />
              <ToggleRow
                label="Resume ready alerts"
                description="Get notified when a generated resume or cover letter is ready."
                checked={settings.notifications.resumeReady}
                onChange={(checked) =>
                  setSettings((current) => ({
                    ...current,
                    notifications: { ...current.notifications, resumeReady: checked },
                  }))
                }
              />
              <ToggleRow
                label="ATS improvement alerts"
                description="Highlight missing keywords and stronger match opportunities."
                checked={settings.notifications.atsAlerts}
                onChange={(checked) =>
                  setSettings((current) => ({
                    ...current,
                    notifications: { ...current.notifications, atsAlerts: checked },
                  }))
                }
              />
              <ToggleRow
                label="Verification alerts"
                description="Remind you when email or phone details still need verification."
                checked={settings.notifications.verificationAlerts}
                onChange={(checked) =>
                  setSettings((current) => ({
                    ...current,
                    notifications: { ...current.notifications, verificationAlerts: checked },
                  }))
                }
              />
            </div>
          </SectionCard>
        )}

        {activeTab === 'exports' && (
          <SectionCard
            eyebrow="Export defaults"
            title="Control how downloads are packaged"
            description="Choose the template and file style your account should use by default."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <SelectCard
                label="Default template"
                value={settings.exports.defaultTemplate}
                options={templates.map((template) => ({ value: template.id, label: template.name }))}
                onChange={(value) =>
                  setSettings((current) => ({
                    ...current,
                    exports: { ...current.exports, defaultTemplate: value },
                  }))
                }
              />
              <SelectCard
                label="File naming"
                value={settings.exports.fileStyle}
                options={[
                  { value: 'role-company-date', label: 'Role · Company · Date' },
                  { value: 'company-role', label: 'Company · Role' },
                  { value: 'candidate-role', label: 'Candidate · Role' },
                ]}
                onChange={(value) =>
                  setSettings((current) => ({
                    ...current,
                    exports: {
                      ...current.exports,
                      fileStyle: value as UserSettings['exports']['fileStyle'],
                    },
                  }))
                }
              />
            </div>
            <div className="mt-4">
              <ToggleRow
                label="Include cover letter on export"
                description="Bundle the generated cover letter into your normal export flow."
                checked={settings.exports.includeCoverLetter}
                onChange={(checked) =>
                  setSettings((current) => ({
                    ...current,
                    exports: { ...current.exports, includeCoverLetter: checked },
                  }))
                }
              />
            </div>
          </SectionCard>
        )}

        {activeTab === 'privacy' && (
          <SectionCard
            eyebrow="Privacy"
            title="Control data retention and sensitive actions"
            description="These privacy controls are personal account preferences."
          >
            <div className="space-y-3">
              <ToggleRow
                label="Keep resume history"
                description="Store past generated resumes for comparison and future editing."
                checked={settings.privacy.keepResumeHistory}
                onChange={(checked) =>
                  setSettings((current) => ({
                    ...current,
                    privacy: { ...current.privacy, keepResumeHistory: checked },
                  }))
                }
              />
              <ToggleRow
                label="Allow AI reuse of saved profile data"
                description="Use your saved profile as reusable context for future resume generation."
                checked={settings.privacy.allowAiReuse}
                onChange={(checked) =>
                  setSettings((current) => ({
                    ...current,
                    privacy: { ...current.privacy, allowAiReuse: checked },
                  }))
                }
              />
              <ToggleRow
                label="Require verification before export"
                description="Block final exports until the core contact details are verified."
                checked={settings.privacy.requireVerificationBeforeExport}
                onChange={(checked) =>
                  setSettings((current) => ({
                    ...current,
                    privacy: { ...current.privacy, requireVerificationBeforeExport: checked },
                  }))
                }
              />
            </div>
          </SectionCard>
        )}

        {activeTab === 'resume' && (
          <div className="space-y-6">
            <SectionCard
              eyebrow="Resume formatting"
              title="Control how resumes are generated and rendered"
              description="These values are saved to your account and used by generation, preview, and export."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <InputCard
                  label="Summary max words"
                  value={String(settings.resume.formatting.summaryMaxWords)}
                  onChange={(value) =>
                    setSettings((current) => ({
                      ...current,
                      resume: {
                        ...current.resume,
                        formatting: {
                          ...current.resume.formatting,
                          summaryMaxWords: clampNumber(value, current.resume.formatting.summaryMaxWords, 10, 80),
                        },
                      },
                    }))
                  }
                />
                <InputCard
                  label="Max bullets per section"
                  value={String(settings.resume.formatting.maxBulletsPerSection)}
                  onChange={(value) =>
                    setSettings((current) => ({
                      ...current,
                      resume: {
                        ...current.resume,
                        formatting: {
                          ...current.resume.formatting,
                          maxBulletsPerSection: clampNumber(value, current.resume.formatting.maxBulletsPerSection, 1, 10),
                        },
                      },
                    }))
                  }
                />
                <SelectCard
                  label="Skills separator"
                  value={settings.resume.formatting.skillsSeparator}
                  options={[
                    { value: 'comma', label: 'Comma separated' },
                    { value: 'bullet', label: 'Bullet separator' },
                  ]}
                  onChange={(value) =>
                    setSettings((current) => ({
                      ...current,
                      resume: {
                        ...current.resume,
                        formatting: { ...current.resume.formatting, skillsSeparator: value as UserSettings['resume']['formatting']['skillsSeparator'] },
                      },
                    }))
                  }
                />
                <SelectCard
                  label="Link display"
                  value={settings.resume.formatting.linkStyle}
                  options={[
                    { value: 'compact', label: 'Compact labels' },
                    { value: 'full', label: 'Full links' },
                  ]}
                  onChange={(value) =>
                    setSettings((current) => ({
                      ...current,
                      resume: {
                        ...current.resume,
                        formatting: { ...current.resume.formatting, linkStyle: value as UserSettings['resume']['formatting']['linkStyle'] },
                      },
                    }))
                  }
                />
                <SelectCard
                  label="Page size"
                  value={settings.resume.formatting.pageSize}
                  options={[
                    { value: 'A4', label: 'A4' },
                    { value: 'Letter', label: 'Letter' },
                  ]}
                  onChange={(value) =>
                    setSettings((current) => ({
                      ...current,
                      resume: {
                        ...current.resume,
                        formatting: { ...current.resume.formatting, pageSize: value as UserSettings['resume']['formatting']['pageSize'] },
                      },
                    }))
                  }
                />
              </div>
              <div className="mt-4 space-y-3">
                <ToggleRow
                  label="Repeat headings on continued pages"
                  description="If a section continues on page 2 or later, print the section heading again."
                  checked={settings.resume.formatting.repeatSectionHeadingsOnNewPage}
                  onChange={(checked) =>
                    setSettings((current) => ({
                      ...current,
                      resume: {
                        ...current.resume,
                        formatting: { ...current.resume.formatting, repeatSectionHeadingsOnNewPage: checked },
                      },
                    }))
                  }
                />
                <ToggleRow
                  label="Show page numbers"
                  description="Add page numbers when the resume flows to multiple pages."
                  checked={settings.resume.formatting.showPageNumbers}
                  onChange={(checked) =>
                    setSettings((current) => ({
                      ...current,
                      resume: {
                        ...current.resume,
                        formatting: { ...current.resume.formatting, showPageNumbers: checked },
                      },
                    }))
                  }
                />
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Resume structure"
              title="Choose section defaults and layout limits"
              description="These defaults guide new resume generation and the default structure in the editor."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <InputCard
                  label="Max projects"
                  value={String(settings.resume.structure.maxProjects)}
                  onChange={(value) =>
                    setSettings((current) => ({
                      ...current,
                      resume: {
                        ...current.resume,
                        structure: {
                          ...current.resume.structure,
                          maxProjects: clampNumber(value, current.resume.structure.maxProjects, 1, 8),
                        },
                      },
                    }))
                  }
                />
                <InputCard
                  label="Max education items"
                  value={String(settings.resume.structure.maxEducationItems)}
                  onChange={(value) =>
                    setSettings((current) => ({
                      ...current,
                      resume: {
                        ...current.resume,
                        structure: {
                          ...current.resume.structure,
                          maxEducationItems: clampNumber(value, current.resume.structure.maxEducationItems, 1, 6),
                        },
                      },
                    }))
                  }
                />
              </div>
              <div className="mt-5">
                <div className="text-sm font-semibold text-[var(--text-primary)]">Section order</div>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Use a comma-separated list from: summary, skills, experience, projects, achievements, education, languages, hobbies
                </p>
                <textarea
                  value={settings.resume.structure.sectionOrder.join(', ')}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      resume: {
                        ...current.resume,
                        structure: {
                          ...current.resume.structure,
                          sectionOrder: normalizeSectionOrder(event.target.value, current.resume.structure.sectionOrder),
                        },
                      },
                    }))
                  }
                  className="input-shell mt-3 min-h-[88px] w-full"
                />
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {Object.entries(settings.resume.structure.defaultSectionVisibility).map(([key, checked]) => (
                  <ToggleRow
                    key={key}
                    label={`Keep ${formatSectionLabel(key)} by default`}
                    description={`New resumes and default previews start with ${formatSectionLabel(key).toLowerCase()} ${checked ? 'enabled' : 'disabled'}.`}
                    checked={checked}
                    onChange={(nextChecked) =>
                      setSettings((current) => ({
                        ...current,
                        resume: {
                          ...current.resume,
                          structure: {
                            ...current.resume.structure,
                            defaultSectionVisibility: {
                              ...current.resume.structure.defaultSectionVisibility,
                              [key]: nextChecked,
                            },
                          },
                        },
                      }))
                    }
                  />
                ))}
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Prompt templates"
              title="Choose the active prompt per resume stage"
              description="If a custom prompt is marked active, only that prompt is used for that section. If not, the visible default prompt runs."
            >
              <div className="space-y-5">
                {Object.entries(settings.resume.prompts).map(([key, prompt]) => (
                  <div key={key} className="app-panel-muted p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--text-primary)]">{prompt.label}</div>
                        <div className="mt-1 text-sm text-[var(--text-secondary)]">{prompt.description}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setSettings((current) => ({
                              ...current,
                              resume: {
                                ...current.resume,
                                prompts: {
                                  ...current.resume.prompts,
                                  [key]: { ...current.resume.prompts[key as keyof UserSettings['resume']['prompts']], activeMode: 'default' },
                                },
                              },
                            }))
                          }
                          className={prompt.activeMode === 'default' ? 'app-button-primary px-3 py-2 text-xs' : 'app-button-secondary px-3 py-2 text-xs'}
                        >
                          Use default
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSettings((current) => ({
                              ...current,
                              resume: {
                                ...current.resume,
                                prompts: {
                                  ...current.resume.prompts,
                                  [key]: { ...current.resume.prompts[key as keyof UserSettings['resume']['prompts']], activeMode: 'custom' },
                                },
                              },
                            }))
                          }
                          className={prompt.activeMode === 'custom' ? 'app-button-primary px-3 py-2 text-xs' : 'app-button-secondary px-3 py-2 text-xs'}
                        >
                          Use custom
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 xl:grid-cols-2">
                      <label className="block">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Default template</div>
                        <textarea value={prompt.defaultTemplate} readOnly className="input-shell mt-3 min-h-[240px] w-full opacity-80" />
                      </label>
                      <label className="block">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Custom template</div>
                        <textarea
                          value={prompt.customTemplate}
                          onChange={(event) =>
                            setSettings((current) => ({
                              ...current,
                              resume: {
                                ...current.resume,
                                prompts: {
                                  ...current.resume.prompts,
                                  [key]: {
                                    ...current.resume.prompts[key as keyof UserSettings['resume']['prompts']],
                                    customTemplate: event.target.value,
                                  },
                                },
                              },
                            }))
                          }
                          placeholder={`Write the custom ${prompt.label.toLowerCase()} prompt here. Use the visible default as the base if you want full control.`}
                          className="input-shell mt-3 min-h-[240px] w-full"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

      </section>

      <aside className="space-y-6">
        <div className="app-panel p-6">
          <div className="app-eyebrow">Saved for you</div>
          <h3 className="app-subheading mt-2">
            Personal settings profile
          </h3>
          <p className="app-body mt-3">
            These controls are stored per signed-in user, so one user’s preferences do not affect another user’s workspace.
          </p>
          <div className="mt-5 space-y-3">
            <MiniMetric label="Workspace name" value={settings.workspaceName} />
            <MiniMetric label="Default source" value={settings.defaultSourcePlatform} />
            <MiniMetric label="Default template" value={templateLabel(settings.exports.defaultTemplate, templates)} />
          </div>
        </div>

        <div className="app-panel p-6">
          <div className="app-eyebrow">Save status</div>
          <h3 className="app-subheading mt-2">
            {isDirty ? 'Unsaved changes' : 'All changes saved'}
          </h3>
          <p className="app-body mt-3">
            {isDirty
              ? 'You have personal settings changes waiting to be written to the database.'
              : 'Your settings page is synced with the current values stored for your account.'}
          </p>
        </div>
      </aside>
    </div>
  );
}

function SectionCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="app-panel p-6">
      <div className="app-eyebrow">{eyebrow}</div>
      <h3 className="app-subheading mt-2">{title}</h3>
      <p className="app-body mt-3 max-w-2xl">{description}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="app-panel-muted flex items-center justify-between gap-4 px-4 py-4">
      <div>
        <div className="text-sm font-semibold text-[var(--text-primary)]">{label}</div>
        <div className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{description}</div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="relative h-7 w-14 rounded-full transition"
        style={{ background: checked ? 'var(--accent)' : 'rgba(255,255,255,0.08)' }}
        aria-pressed={checked}
      >
        <span
          className="absolute top-1 h-5 w-5 rounded-full bg-white transition"
          style={{ left: checked ? 'calc(100% - 24px)' : '4px' }}
        />
      </button>
    </div>
  );
}

function SelectCard({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="app-panel-muted block p-4">
      <div className="text-sm font-semibold text-[var(--text-primary)]">{label}</div>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="input-shell mt-4">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function InputCard({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="app-panel-muted block p-4">
      <div className="text-sm font-semibold text-[var(--text-primary)]">{label}</div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="input-shell mt-4"
      />
    </label>
  );
}

function CountryAutocompleteInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
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

    fetch(`/api/location-search?q=${encodeURIComponent(deferredQuery)}&scope=country`, {
      cache: 'no-store',
    })
      .then((response) => response.json())
      .then((data: { results?: Array<{ id: string; label: string }> }) => {
        if (!active) return;
        setResults(data.results ?? []);
      })
      .catch(() => {
        if (!active) return;
        setResults([]);
      })
      .finally(() => {
        if (active) {
          setSearching(false);
        }
      });

    return () => {
      active = false;
    };
  }, [deferredQuery]);

  return (
    <label className="app-panel-muted block p-4">
      <div className="text-sm font-semibold text-[var(--text-primary)]">{label}</div>
      <div className="relative mt-4">
        <input
          value={value}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            window.setTimeout(() => setFocused(false), 120);
          }}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="input-shell"
        />
        {focused && (results.length > 0 || searching) && (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-[18px] border bg-[var(--bg-panel)] shadow-[var(--shadow-panel)]" style={{ borderColor: 'var(--border-subtle)' }}>
            {searching ? (
              <div className="px-4 py-3 text-sm text-[var(--text-secondary)]">Searching countries...</div>
            ) : (
              results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onChange(item.label);
                    setFocused(false);
                  }}
                  className="block w-full border-b px-4 py-3 text-left text-sm text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] last:border-b-0"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  {item.label}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </label>
  );
}

function clampNumber(raw: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function normalizeSectionOrder(
  raw: string,
  fallback: UserSettings['resume']['structure']['sectionOrder']
): UserSettings['resume']['structure']['sectionOrder'] {
  const allowed = new Set(['summary', 'skills', 'experience', 'projects', 'achievements', 'education', 'languages', 'hobbies']);
  const requested = raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is UserSettings['resume']['structure']['sectionOrder'][number] => allowed.has(item));
  const unique = Array.from(new Set(requested));
  if (unique.length < 5) return fallback;
  return unique;
}

function formatSectionLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="app-panel-muted flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      <span className="text-right text-sm font-semibold text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

function templateLabel(templateId: string, templates: ResumeTemplate[]) {
  return templates.find((template) => template.id === templateId)?.name ?? templateId;
}
