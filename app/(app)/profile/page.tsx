'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { api, type FullProfile } from '@/lib/api';

export default function ProfilePage() {
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    phone: '',
    location: '',
    linkedin: '',
    github: '',
    website: '',
    summary: '',
  });

  useEffect(() => {
    api.profile
      .get()
      .then((result) => {
        setProfile(result);
        setForm({
          phone: result.phone || '',
          location: result.location || '',
          linkedin: result.linkedin || '',
          github: result.github || '',
          website: result.website || '',
          summary: result.summary || '',
        });
      })
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const completion = useMemo(() => {
    const checks = [
      Boolean(form.phone),
      Boolean(form.location),
      Boolean(form.linkedin),
      Boolean(form.summary),
      Boolean(profile?.skills.length),
      Boolean(profile?.experiences.length),
      Boolean(profile?.projects.length),
      Boolean(profile?.education.length),
    ];

    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [form, profile]);

  async function save() {
    setSaving(true);
    try {
      const updated = await api.profile.update(form);
      setProfile(updated);
      toast.success('Profile saved.');
    } catch {
      toast.error('Unable to save your profile right now.');
    } finally {
      setSaving(false);
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
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
      <section className="space-y-6">
        <div className="app-panel p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="app-eyebrow">Reusable profile</div>
              <h2 className="app-heading mt-2">
                Save your personal information once
              </h2>
              <p className="app-body mt-3 max-w-2xl">
                This profile is reused across resume generations so you can focus on each target role instead of re-entering the same details.
              </p>
            </div>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="app-button-primary disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            <Field label="Phone">
              <input
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                placeholder="+91 98765 43210"
                className="input-shell"
              />
            </Field>
            <Field label="Location">
              <input
                value={form.location}
                onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                placeholder="Bengaluru, India"
                className="input-shell"
              />
            </Field>
            <Field label="LinkedIn">
              <input
                value={form.linkedin}
                onChange={(event) => setForm((current) => ({ ...current, linkedin: event.target.value }))}
                placeholder="linkedin.com/in/you"
                className="input-shell"
              />
            </Field>
            <Field label="GitHub">
              <input
                value={form.github}
                onChange={(event) => setForm((current) => ({ ...current, github: event.target.value }))}
                placeholder="github.com/you"
                className="input-shell"
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Website / portfolio">
                <input
                  value={form.website}
                  onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))}
                  placeholder="yourportfolio.com"
                  className="input-shell"
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Professional summary">
                <textarea
                  rows={6}
                  value={form.summary}
                  onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
                  placeholder="Write a strong base summary about your background, strengths, and the kind of roles you target."
                  className="input-shell min-h-[150px] resize-y"
                />
              </Field>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <SummaryCard label="Skills" value={profile?.skills.length ?? 0} description="Reusable keywords and strengths" />
          <SummaryCard label="Experience" value={profile?.experiences.length ?? 0} description="Career history ready for tailoring" />
          <SummaryCard label="Projects" value={profile?.projects.length ?? 0} description="Project proof points saved" />
        </div>
      </section>

      <aside className="space-y-6">
        <div className="app-panel p-6">
          <div className="app-eyebrow">Completion</div>
          <h3 className="app-subheading mt-2">
            Profile readiness
          </h3>
          <div className="mt-5 text-5xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
            {completion}%
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/6">
            <div
              className="h-full rounded-full"
              style={{ background: 'var(--accent)', width: `${completion}%` }}
            />
          </div>
          <p className="app-body mt-4">
            Higher profile completion gives the AI more raw material to produce stronger, more role-specific resumes.
          </p>
        </div>

        <div className="app-panel p-6">
          <div className="app-eyebrow">Saved profile inventory</div>
          <div className="mt-4 space-y-3">
            {[
              { label: 'Skills', value: profile?.skills.length ?? 0 },
              { label: 'Experience entries', value: profile?.experiences.length ?? 0 },
              { label: 'Projects', value: profile?.projects.length ?? 0 },
              { label: 'Education items', value: profile?.education.length ?? 0 },
            ].map((item) => (
              <div key={item.label} className="app-panel-muted flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[var(--text-secondary)]">{item.label}</span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
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

function SummaryCard({ label, value, description }: { label: string; value: number; description: string }) {
  return (
    <div className="app-panel p-5">
      <div className="app-caption">{label}</div>
      <div className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
        {value}
      </div>
      <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{description}</div>
    </div>
  );
}
