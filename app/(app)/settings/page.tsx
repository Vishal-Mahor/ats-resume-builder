'use client';

import Link from 'next/link';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { BillingUsagePanel } from '@/components/billing/BillingUsagePanel';
import { api, setAuthToken, type BillingSnapshot, type FullProfile, type User, type UserSettings } from '@/lib/api';

type SettingsTab = 'profile' | 'billing' | 'notifications' | 'privacy';
type VerificationChannel = 'email' | 'phone';

const SETTINGS_TABS: Array<{ id: SettingsTab; label: string; description: string }> = [
  { id: 'profile', label: 'Profile', description: 'Account details' },
  { id: 'billing', label: 'Billing', description: 'Plan and usage' },
  { id: 'notifications', label: 'Notifications', description: 'Alerts' },
  { id: 'privacy', label: 'Privacy', description: 'Data controls' },
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab = useMemo<SettingsTab>(() => {
    if (requestedTab && SETTINGS_TABS.some((tab) => tab.id === requestedTab)) {
      return requestedTab as SettingsTab;
    }
    return 'profile';
  }, [requestedTab]);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [billing, setBilling] = useState<BillingSnapshot | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [profileForm, setProfileForm] = useState({ name: '', email: '', phone: '' });
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' });
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [verificationModal, setVerificationModal] = useState<VerificationChannel | null>(null);
  const [pendingVerificationChannels, setPendingVerificationChannels] = useState<VerificationChannel[]>([]);
  const [emailOtp, setEmailOtp] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false);
  const [confirmingEmailOtp, setConfirmingEmailOtp] = useState(false);
  const [confirmingPhoneOtp, setConfirmingPhoneOtp] = useState(false);

  useEffect(() => {
    Promise.all([api.auth.me(), api.profile.get(), api.billing.get(), api.settings.get()])
      .then(([userResult, profileResult, billingResult, settingsResult]) => {
        setUser(userResult);
        setProfile(profileResult);
        setBilling(billingResult);
        setProfileForm({
          name: profileResult.name ?? userResult.name ?? '',
          email: profileResult.email ?? userResult.email ?? '',
          phone: profileResult.phone ?? '',
        });
        setSettings(settingsResult);
        setSavedSettings(settingsResult);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Failed to load settings.'))
      .finally(() => setLoading(false));
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(savedSettings),
    [savedSettings, settings]
  );
  const emailVerifiedForCurrentValue = Boolean(
    profileForm.email.trim() &&
    profile?.email_verified_at &&
    profileForm.email.trim() === (profile?.email || '').trim()
  );
  const phoneVerifiedForCurrentValue = Boolean(
    profileForm.phone.trim() &&
    profile?.phone_verified_at &&
    profileForm.phone.trim() === (profile?.phone || '').trim()
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

  async function handleProfileSave() {
    setSavingProfile(true);
    try {
      const updated = await api.profile.update({
        name: profileForm.name.trim(),
        email: profileForm.email.trim(),
        phone: profileForm.phone.trim(),
      });
      setProfile(updated);
      setProfileForm((current) => ({
        ...current,
        name: updated.name ?? current.name,
        email: updated.email ?? current.email,
        phone: updated.phone ?? current.phone,
      }));
      toast.success('Profile saved.');

      const channels: VerificationChannel[] = [];
      if (updated.email && !updated.email_verified_at) channels.push('email');
      if (updated.phone && !updated.phone_verified_at) channels.push('phone');
      if (channels.length > 0) {
        setPendingVerificationChannels(channels);
        await openVerificationModal(channels[0]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function openVerificationModal(channel: VerificationChannel) {
    setVerificationModal(channel);
    if (channel === 'email') {
      setEmailOtp('');
      await sendEmailOtp();
    } else {
      setPhoneOtp('');
      await sendPhoneOtp();
    }
  }

  async function sendEmailOtp() {
    setSendingEmailOtp(true);
    try {
      await api.profile.sendEmailOtp();
      toast.success('Email OTP sent.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to send email OTP right now.');
    } finally {
      setSendingEmailOtp(false);
    }
  }

  async function sendPhoneOtp() {
    setSendingPhoneOtp(true);
    try {
      await api.profile.sendPhoneOtp();
      toast.success('Phone OTP sent.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to send phone OTP right now.');
    } finally {
      setSendingPhoneOtp(false);
    }
  }

  async function confirmEmailOtp() {
    setConfirmingEmailOtp(true);
    try {
      const updated = await api.profile.confirmEmailOtp(emailOtp.trim());
      setProfile(updated);
      setProfileForm((current) => ({ ...current, email: updated.email ?? current.email }));
      setEmailOtp('');
      toast.success('Email verified.');
      await continuePendingVerification('email');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to confirm email OTP.');
    } finally {
      setConfirmingEmailOtp(false);
    }
  }

  async function confirmPhoneOtp() {
    setConfirmingPhoneOtp(true);
    try {
      const updated = await api.profile.confirmPhoneOtp(phoneOtp.trim());
      setProfile(updated);
      setProfileForm((current) => ({ ...current, phone: updated.phone ?? current.phone }));
      setPhoneOtp('');
      toast.success('Phone verified.');
      await continuePendingVerification('phone');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to confirm phone OTP.');
    } finally {
      setConfirmingPhoneOtp(false);
    }
  }

  async function continuePendingVerification(completedChannel: VerificationChannel) {
    const remainingChannels = pendingVerificationChannels.filter((channel) => channel !== completedChannel);
    setPendingVerificationChannels(remainingChannels);

    if (remainingChannels.length > 0) {
      await openVerificationModal(remainingChannels[0]);
      return;
    }

    setVerificationModal(null);
  }

  async function handlePasswordSave() {
    if (passwordForm.password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    if (passwordForm.password !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await api.auth.changePassword(passwordForm.password);
      setPasswordForm({ password: '', confirmPassword: '' });
      toast.success('Password updated.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update password.');
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmation !== 'DELETE') {
      toast.error('Type DELETE to confirm account deletion.');
      return;
    }

    setDeletingAccount(true);
    try {
      await api.auth.deleteAccount(deleteConfirmation);
      setAuthToken(null);
      toast.success('Account deleted.');
      router.replace('/auth/signin');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete account.');
    } finally {
      setDeletingAccount(false);
    }
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
    <>
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="app-panel-strong p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="app-badge">Settings</div>
              <h2 className="app-heading mt-3">
                Account and workspace settings
              </h2>
              <p className="app-body mt-2 max-w-2xl">
                Keep profile, billing, notifications, and privacy controls in one place.
              </p>
            </div>
          </div>

        <div className="mt-6 overflow-x-auto">
          <nav className="flex min-w-max gap-2" aria-label="Settings sections">
            {SETTINGS_TABS.map((tab) => {
              const active = tab.id === activeTab;
              return (
                <Link
                  key={tab.id}
                  href={tab.id === 'profile' ? '/settings' : `/settings?tab=${tab.id}`}
                  className={`rounded-xl border px-4 py-3 text-left transition hover:bg-[var(--bg-hover)] ${
                    active ? 'border-[var(--border-strong)] bg-[var(--accent-soft)]' : 'border-[var(--border-subtle)] bg-[var(--bg-panel)]'
                  }`}
                >
                  <div className="text-sm font-semibold text-[var(--text-primary)]">{tab.label}</div>
                  <div className="mt-0.5 text-xs text-[var(--text-secondary)]">{tab.description}</div>
                </Link>
              );
            })}
          </nav>
        </div>
      </section>

      <section className="space-y-6">

        {activeTab === 'profile' && (
          <div className="space-y-6">
            <SectionCard
              eyebrow="Profile"
              title="Profile information"
              description="Basic account details used across the workspace."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <InputCard
                  label="Full name"
                  value={profileForm.name}
                  onChange={(value) => setProfileForm((current) => ({ ...current, name: value }))}
                  placeholder="Your full name"
                />
                <InputCard
                  label="Email"
                  value={profileForm.email}
                  onChange={(value) => setProfileForm((current) => ({ ...current, email: value }))}
                  placeholder="you@example.com"
                  verified={emailVerifiedForCurrentValue}
                />
                <InputCard
                  label="Phone"
                  value={profileForm.phone}
                  onChange={(value) => setProfileForm((current) => ({ ...current, phone: value }))}
                  placeholder="+91 98765 43210"
                  verified={phoneVerifiedForCurrentValue}
                />
                <ReadOnlyCard label="Account created" value={formatDate(user?.created_at)} />
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleProfileSave}
                  disabled={savingProfile}
                  className="app-button-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingProfile ? 'Saving...' : 'Save profile'}
                </button>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Security"
              title="Change password"
              description="Set a new password for email sign-in."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <InputCard
                  label="New password"
                  type="password"
                  value={passwordForm.password}
                  onChange={(value) => setPasswordForm((current) => ({ ...current, password: value }))}
                  placeholder="At least 8 characters"
                />
                <InputCard
                  label="Confirm new password"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(value) => setPasswordForm((current) => ({ ...current, confirmPassword: value }))}
                  placeholder="Repeat password"
                />
              </div>
              <button
                type="button"
                onClick={handlePasswordSave}
                disabled={savingPassword || !passwordForm.password || !passwordForm.confirmPassword}
                className="app-button-primary mt-5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingPassword ? 'Updating...' : 'Update password'}
              </button>
            </SectionCard>

            <SectionCard
              eyebrow="Danger zone"
              title="Delete account"
              description="This removes your account and associated workspace data. Type DELETE to confirm."
              variant="danger"
            >
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                <div className="text-sm font-semibold text-rose-950">Permanent account deletion</div>
                <p className="mt-2 text-sm leading-6 text-rose-700">
                  This action cannot be undone. Your profile, resumes, history, and workspace settings will be removed.
                </p>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <label className="block">
                  <div className="text-sm font-semibold text-rose-950">Confirmation</div>
                  <input
                    type="text"
                    value={deleteConfirmation}
                    onChange={(event) => setDeleteConfirmation(event.target.value)}
                    placeholder="Type DELETE"
                    className="mt-3 w-full rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-950 outline-none transition placeholder:text-rose-300 focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount || deleteConfirmation !== 'DELETE'}
                  className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(225,29,72,0.24)] transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingAccount ? 'Deleting...' : 'Delete account'}
                </button>
              </div>
            </SectionCard>
          </div>
        )}

        {activeTab === 'billing' && (
          <BillingSettings billing={billing} />
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

        {(activeTab === 'notifications' || activeTab === 'privacy') && isDirty && (
          <div className="app-panel-muted flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">Unsaved changes</div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">
                Save your notification and privacy changes to apply them to your account.
              </div>
            </div>
            <button type="button" onClick={handleSave} disabled={saving} className="app-button-primary px-3 py-2 text-xs disabled:opacity-60">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </section>
    </div>
    {verificationModal && (
      <ContactVerificationModal
        channel={verificationModal}
        value={verificationModal === 'email' ? profileForm.email : profileForm.phone}
        otpValue={verificationModal === 'email' ? emailOtp : phoneOtp}
        onOtpChange={verificationModal === 'email' ? setEmailOtp : setPhoneOtp}
        onResend={verificationModal === 'email' ? sendEmailOtp : sendPhoneOtp}
        onConfirm={verificationModal === 'email' ? confirmEmailOtp : confirmPhoneOtp}
        onClose={() => setVerificationModal(null)}
        sending={verificationModal === 'email' ? sendingEmailOtp : sendingPhoneOtp}
        confirming={verificationModal === 'email' ? confirmingEmailOtp : confirmingPhoneOtp}
      />
    )}
    </>
  );
}

function SectionCard({
  eyebrow,
  title,
  description,
  children,
  variant = 'default',
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  variant?: 'default' | 'danger';
}) {
  const isDanger = variant === 'danger';

  return (
    <div className={`p-6 ${isDanger ? 'rounded-[var(--radius-panel)] border border-rose-200 bg-rose-50/70 shadow-[var(--shadow-panel)]' : 'app-panel'}`}>
      <div className={isDanger ? 'text-[11px] font-semibold uppercase tracking-[0.28em] text-rose-600' : 'app-eyebrow'}>{eyebrow}</div>
      <h3 className={`mt-2 text-xl font-semibold ${isDanger ? 'text-rose-950' : 'text-[var(--text-primary)]'}`}>{title}</h3>
      <p className={`mt-3 max-w-2xl text-sm leading-6 ${isDanger ? 'text-rose-700' : 'text-[var(--text-secondary)]'}`}>{description}</p>
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
        className={`relative h-7 w-14 rounded-full border transition ${
          checked
            ? 'border-[var(--accent)] bg-[var(--accent)]'
            : 'border-slate-300 bg-slate-200 shadow-inner'
        }`}
        aria-pressed={checked}
      >
        <span
          className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition"
          style={{ left: checked ? 'calc(100% - 24px)' : '4px' }}
        />
      </button>
    </div>
  );
}

function ReadOnlyCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="app-panel-muted p-4">
      <div className="text-sm font-semibold text-[var(--text-primary)]">{label}</div>
      <div className="mt-4 min-h-[46px] rounded-xl border px-4 py-3 text-sm text-[var(--text-secondary)]" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-input)' }}>
        {value}
      </div>
    </div>
  );
}

function BillingSettings({ billing }: { billing: BillingSnapshot | null }) {
  const [upgrading, setUpgrading] = useState(false);

  async function handleUpgrade() {
    if (billing?.plan === 'plus') return;

    setUpgrading(true);
    try {
      const checkout = await api.billing.createPlusCheckout();
      window.location.href = checkout.checkoutUrl;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to open payment gateway.');
      setUpgrading(false);
    }
  }

  if (!billing) {
    return (
      <SectionCard eyebrow="Billing" title="Billing unavailable" description="Unable to load billing details right now.">
        <div className="text-sm text-[var(--text-secondary)]">Please retry in a moment.</div>
      </SectionCard>
    );
  }

  return (
    <BillingUsagePanel
      billing={billing}
      onUpgrade={handleUpgrade}
      upgrading={upgrading}
      showIdentity={false}
    />
  );
}

function InputCard({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  verified,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  verified?: boolean;
}) {
  return (
    <label className="app-panel-muted block p-4">
      <div className="text-sm font-semibold text-[var(--text-primary)]">{label}</div>
      <div className="relative mt-4">
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`input-shell ${verified === undefined ? '' : 'pr-12'}`}
        />
        {verified !== undefined && <ContactStatusIcon verified={verified} />}
      </div>
    </label>
  );
}

function ContactStatusIcon({ verified }: { verified: boolean }) {
  const Icon = verified ? CheckCircle2 : XCircle;

  return (
    <span
      className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 ${
        verified ? 'text-emerald-600' : 'text-rose-600'
      }`}
      aria-hidden="true"
    >
      <Icon className="h-5 w-5" strokeWidth={2.4} />
    </span>
  );
}

function ContactVerificationModal({
  channel,
  value,
  otpValue,
  onOtpChange,
  onResend,
  onConfirm,
  onClose,
  sending,
  confirming,
}: {
  channel: VerificationChannel;
  value: string;
  otpValue: string;
  onOtpChange: (value: string) => void;
  onResend: () => void;
  onConfirm: () => void;
  onClose: () => void;
  sending: boolean;
  confirming: boolean;
}) {
  const label = channel === 'email' ? 'email address' : 'phone number';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button
        type="button"
        className="absolute inset-0 bg-[var(--bg-overlay)]"
        onClick={onClose}
        aria-label="Close verification popup"
      />
      <div className="relative w-full max-w-md rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--bg-panel-strong)] p-6 shadow-[var(--shadow-panel)]">
        <div className="app-eyebrow">Verification required</div>
        <h3 className="app-subheading mt-2">Verify your {label}</h3>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
          We sent a 6-digit OTP to <span className="font-semibold text-[var(--text-primary)]">{value}</span>. Enter it below to finish updating your profile.
        </p>

        <label className="mt-5 block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">OTP code</span>
          <input
            value={otpValue}
            onChange={(event) => onOtpChange(event.target.value)}
            placeholder="Enter 6-digit OTP"
            inputMode="numeric"
            maxLength={6}
            className="input-shell"
          />
        </label>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onResend}
            disabled={sending}
            className="app-button-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? 'Sending...' : 'Resend OTP'}
          </button>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="app-button-secondary">
              Later
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!otpValue.trim() || confirming}
              className="app-button-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {confirming ? 'Verifying...' : 'Verify'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return 'Not available';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
