'use client';

import Link from 'next/link';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { api, type ResumeTemplate, type UserSettings } from '@/lib/api';

type SettingsTab = 'general' | 'notifications' | 'exports' | 'privacy' | 'billing';

const SETTINGS_TABS: Array<{ id: SettingsTab; label: string; description: string }> = [
  { id: 'general', label: 'General', description: 'Workspace identity and default behavior' },
  { id: 'notifications', label: 'Notifications', description: 'Email and workflow alerts' },
  { id: 'exports', label: 'Exports', description: 'PDF naming and template defaults' },
  { id: 'privacy', label: 'Privacy', description: 'Data retention and verification status' },
  { id: 'billing', label: 'Billing', description: 'Plan, limits, and upgrade path' },
];

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

        {activeTab === 'billing' && (
          <SectionCard
            eyebrow="Billing"
            title="Current plan and usage posture"
            description="This section remains informational for now, while your actual settings persist separately per user."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <MetricTile label="Plan" value="Free" helper="Base workspace access" />
              <MetricTile label="Premium templates" value={`${templates.length}`} helper="Currently available in the workspace" />
              <MetricTile label="Monthly generation cap" value="Flexible" helper="No hard cap configured yet" />
              <MetricTile label="Upgrade path" value="Ready" helper="Billing hooks can plug in here later" />
            </div>
          </SectionCard>
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

function MetricTile({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="app-panel-muted p-4">
      <div className="app-caption">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{value}</div>
      <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{helper}</div>
    </div>
  );
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
