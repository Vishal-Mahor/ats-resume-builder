'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { api, type Education, type Experience, type FullProfile, type Project } from '@/lib/api';

type ProfileForm = {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  website: string;
  summary: string;
  technicalSkills: string;
  softSkills: string;
  achievements: string;
  languages: string;
  hobbies: string;
  education: Education[];
  projects: Project[];
  experiences: Experience[];
};

const EMPTY_EDUCATION: Education = {
  degree: '',
  institution: '',
  field: '',
  year: '',
  gpa: '',
  sort_order: 0,
};

const EMPTY_PROJECT: Project = {
  name: '',
  tech_stack: '',
  url: '',
  description: '',
  sort_order: 0,
};

const EMPTY_EXPERIENCE: Experience = {
  job_title: '',
  company: '',
  location: '',
  start_date: '',
  end_date: '',
  is_current: false,
  bullets: [''],
  sort_order: 0,
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false);
  const [confirmingEmailOtp, setConfirmingEmailOtp] = useState(false);
  const [confirmingPhoneOtp, setConfirmingPhoneOtp] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [form, setForm] = useState<ProfileForm>({
    name: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    github: '',
    website: '',
    summary: '',
    technicalSkills: '',
    softSkills: '',
    achievements: '',
    languages: '',
    hobbies: '',
    education: [],
    projects: [],
    experiences: [],
  });

  useEffect(() => {
    api.profile
      .get()
      .then((result) => {
        setProfile(result);
        setForm({
          name: result.name || '',
          email: result.email || '',
          phone: result.phone || '',
          location: result.location || '',
          linkedin: result.linkedin || '',
          github: result.github || '',
          website: result.website || '',
          summary: result.summary || '',
          technicalSkills: joinList(result.technicalSkills ?? []),
          softSkills: joinList(result.softSkills ?? []),
          achievements: joinList(result.achievements ?? []),
          languages: joinList(result.languages ?? []),
          hobbies: joinList(result.hobbies ?? []),
          education: result.education.length ? result.education : [{ ...EMPTY_EDUCATION }],
          projects: result.projects.length ? result.projects : [{ ...EMPTY_PROJECT }],
          experiences: result.experiences.length ? result.experiences : [{ ...EMPTY_EXPERIENCE }],
        });
      })
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const completion = useMemo(() => {
    const checks = [
      Boolean(form.name.trim()),
      Boolean(form.email.trim()),
      Boolean(form.phone.trim()),
      Boolean(form.location.trim()),
      Boolean(form.linkedin.trim()),
      Boolean(form.summary.trim()),
      splitList(form.technicalSkills).length > 0,
      form.experiences.some((item) => item.job_title.trim() && item.company.trim()),
      form.projects.some((item) => item.name.trim()),
      form.education.some((item) => item.degree.trim() && item.institution.trim()),
    ];

    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [form]);
  const completionPercent = useMemo(() => clampProgress(completion), [completion]);
  const completionColor = useMemo(() => getProgressColor(completionPercent), [completionPercent]);

  async function save() {
    setSaving(true);
    try {
      const normalizedLocation = normalizeCityCountry(form.location);
      if (!isCityCountryFormat(normalizedLocation)) {
        throw new Error('Please choose a valid location in "City, Country" format.');
      }

      const updated = await api.profile.update({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        location: normalizedLocation,
        linkedin: form.linkedin.trim(),
        github: form.github.trim(),
        website: form.website.trim(),
        summary: form.summary.trim(),
        technicalSkills: splitList(form.technicalSkills),
        softSkills: splitList(form.softSkills),
        achievements: splitList(form.achievements),
        languages: splitList(form.languages),
        hobbies: splitList(form.hobbies),
        education: form.education
          .filter((item) => item.degree?.trim() || item.institution?.trim() || item.year?.trim())
          .map((item, index) => ({
            ...item,
            degree: item.degree.trim(),
            institution: item.institution.trim(),
            field: item.field?.trim(),
            year: item.year.trim(),
            gpa: item.gpa?.trim(),
            sort_order: index,
          })),
        projects: form.projects
          .filter((item) => item.name?.trim() || item.description?.trim())
          .map((item, index) => ({
            ...item,
            name: item.name.trim(),
            tech_stack: item.tech_stack?.trim(),
            url: item.url?.trim(),
            description: item.description.trim(),
            sort_order: index,
          })),
        experiences: form.experiences
          .filter((item) => item.job_title?.trim() || item.company?.trim())
          .map((item, index) => ({
            ...item,
            job_title: item.job_title.trim(),
            company: item.company.trim(),
            location: item.location?.trim(),
            start_date: item.start_date.trim(),
            end_date: item.is_current ? getTodayDateValue() : item.end_date?.trim(),
            bullets: item.bullets.map((bullet) => bullet.trim()).filter(Boolean),
            sort_order: index,
          })),
      });

      setProfile(updated);
      setForm((current) => ({
        ...current,
        name: updated.name || '',
        email: updated.email || '',
      }));
      toast.success('Profile saved.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save your profile right now.');
    } finally {
      setSaving(false);
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

  async function confirmEmailOtp() {
    setConfirmingEmailOtp(true);
    try {
      const updated = await api.profile.confirmEmailOtp(emailOtp.trim());
      setProfile(updated);
      setForm((current) => ({
        ...current,
        email: updated.email || current.email,
      }));
      setEmailOtp('');
      toast.success('Email verified.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to confirm email OTP.');
    } finally {
      setConfirmingEmailOtp(false);
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

  async function confirmPhoneOtp() {
    setConfirmingPhoneOtp(true);
    try {
      const updated = await api.profile.confirmPhoneOtp(phoneOtp.trim());
      setProfile(updated);
      setPhoneOtp('');
      toast.success('Phone verified.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to confirm phone OTP.');
    } finally {
      setConfirmingPhoneOtp(false);
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
                Complete the candidate profile that powers every resume
              </h2>
              <p className="app-body mt-3 max-w-2xl">
                Add contact details, categorized skills, education, projects, work history, and personal context once so every tailored resume starts from a stronger base.
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

          <div className="mt-7 space-y-8">
            <Section title="Identity" description="Core identity and verification-aware fields.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Name">
                  <input
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Vishal Mahor"
                    className="input-shell"
                  />
                </Field>
                <Field label="Email">
                  <input
                    value={form.email}
                    readOnly={Boolean(profile?.email_verified_at)}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    className={`input-shell ${profile?.email_verified_at ? 'cursor-not-allowed opacity-80' : ''}`}
                  />
                  <FieldNote>
                    {profile?.email_verified_at
                      ? `Verified on ${formatTimestamp(profile.email_verified_at)}`
                      : 'Email is unverified, so you can still edit it before verification.'}
                  </FieldNote>
                </Field>
                <Field label="Phone">
                  <input
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="+91 98765 43210"
                    className="input-shell"
                  />
                  <FieldNote>
                    {profile?.phone_verified_at ? `Verified on ${formatTimestamp(profile.phone_verified_at)}` : 'Phone needs verification after any update.'}
                  </FieldNote>
                </Field>
                <Field label="Location">
                  <LocationAutocompleteInput value={form.location} onChange={(value) => setForm((current) => ({ ...current, location: value }))} />
                  <FieldNote>
                    {profile?.location_verified_at
                      ? `Verified on ${formatTimestamp(profile.location_verified_at)}`
                      : 'Choose from suggestions in "City, Country" format. Verification is required after any update.'}
                  </FieldNote>
                </Field>
              </div>
            </Section>

            <Section title="Professional links" description="Public profiles recruiters can open directly.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="LinkedIn">
                  <input
                    value={form.linkedin}
                    onChange={(event) => setForm((current) => ({ ...current, linkedin: event.target.value }))}
                    placeholder="https://linkedin.com/in/you"
                    className="input-shell"
                  />
                </Field>
                <Field label="GitHub">
                  <input
                    value={form.github}
                    onChange={(event) => setForm((current) => ({ ...current, github: event.target.value }))}
                    placeholder="https://github.com/you"
                    className="input-shell"
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Website / portfolio">
                    <input
                      value={form.website}
                      onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))}
                      placeholder="https://yourportfolio.com"
                      className="input-shell"
                    />
                  </Field>
                </div>
              </div>
            </Section>

            <Section title="Summary and strengths" description="High-level pitch and reusable signals for better ATS matching.">
              <div className="grid gap-4">
                <Field label="Professional summary">
                  <textarea
                    rows={6}
                    value={form.summary}
                    onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
                    placeholder="Write a strong base summary about your background, strengths, and the kind of roles you target."
                    className="input-shell min-h-[150px] resize-y"
                  />
                </Field>
                <Field label="Achievements">
                  <textarea
                    rows={3}
                    value={form.achievements}
                    onChange={(event) => setForm((current) => ({ ...current, achievements: event.target.value }))}
                    placeholder="Promotion in 18 months, Reduced API latency by 37%, Built analytics dashboard used by 20K users"
                    className="input-shell min-h-[110px] resize-y"
                  />
                  <FieldNote>Use comma-separated achievements so they can be stored as structured items.</FieldNote>
                </Field>
              </div>
            </Section>

            <Section title="Skills" description="Split skills into technical and soft categories for cleaner targeting.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Technical skills">
                  <textarea
                    rows={5}
                    value={form.technicalSkills}
                    onChange={(event) => setForm((current) => ({ ...current, technicalSkills: event.target.value }))}
                    placeholder="React, Next.js, TypeScript, Node.js, SQL, AWS"
                    className="input-shell min-h-[130px] resize-y"
                  />
                  <FieldNote>Use comma-separated technical skills so they can be stored as structured items.</FieldNote>
                </Field>
                <Field label="Soft skills">
                  <textarea
                    rows={5}
                    value={form.softSkills}
                    onChange={(event) => setForm((current) => ({ ...current, softSkills: event.target.value }))}
                    placeholder="Communication, Stakeholder management, Leadership, Mentoring"
                    className="input-shell min-h-[130px] resize-y"
                  />
                  <FieldNote>Use comma-separated soft skills so they can be stored as structured items.</FieldNote>
                </Field>
              </div>
            </Section>

            <Section title="Languages and hobbies" description="Optional profile details that still help personalize summaries and cover letters.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Languages">
                  <textarea
                    rows={3}
                    value={form.languages}
                    onChange={(event) => setForm((current) => ({ ...current, languages: event.target.value }))}
                    placeholder="English, Hindi"
                    className="input-shell min-h-[96px] resize-y"
                  />
                  <FieldNote>Use comma-separated languages so they can be stored as structured items.</FieldNote>
                </Field>
                <Field label="Hobbies">
                  <textarea
                    rows={3}
                    value={form.hobbies}
                    onChange={(event) => setForm((current) => ({ ...current, hobbies: event.target.value }))}
                    placeholder="Writing, Running, Open-source"
                    className="input-shell min-h-[96px] resize-y"
                  />
                  <FieldNote>Use comma-separated hobbies so they can be stored as structured items.</FieldNote>
                </Field>
              </div>
            </Section>

            <Section title="Education" description="Academic background and formal credentials.">
              <div className="space-y-4">
                {form.education.map((item, index) => (
                  <div key={`education-${index}`} className="app-panel-muted p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">Education {index + 1}</div>
                      <button type="button" onClick={() => removeItem('education', index)} className="text-sm text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]">
                        Remove
                      </button>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <Field label="Degree">
                        <input value={item.degree} onChange={(event) => updateEducation(index, 'degree', event.target.value)} className="input-shell" />
                      </Field>
                      <Field label="Institution">
                        <input value={item.institution} onChange={(event) => updateEducation(index, 'institution', event.target.value)} className="input-shell" />
                      </Field>
                      <Field label="Field">
                        <input value={item.field || ''} onChange={(event) => updateEducation(index, 'field', event.target.value)} className="input-shell" />
                      </Field>
                      <Field label="Year">
                        <input value={item.year} onChange={(event) => updateEducation(index, 'year', event.target.value)} className="input-shell" />
                      </Field>
                      <Field label="GPA">
                        <input value={item.gpa || ''} onChange={(event) => updateEducation(index, 'gpa', event.target.value)} className="input-shell" />
                      </Field>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => setForm((current) => ({ ...current, education: [...current.education, { ...EMPTY_EDUCATION }] }))} className="app-button-secondary">
                  Add education
                </button>
              </div>
            </Section>

            <Section title="Projects" description="Portfolio-ready work with measurable outcomes or strong technical proof.">
              <div className="space-y-4">
                {form.projects.map((item, index) => (
                  <div key={`project-${index}`} className="app-panel-muted p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">Project {index + 1}</div>
                      <button type="button" onClick={() => removeItem('projects', index)} className="text-sm text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]">
                        Remove
                      </button>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <Field label="Project name">
                        <input value={item.name} onChange={(event) => updateProject(index, 'name', event.target.value)} className="input-shell" />
                      </Field>
                      <Field label="Tech stack">
                        <input value={item.tech_stack || ''} onChange={(event) => updateProject(index, 'tech_stack', event.target.value)} className="input-shell" />
                        <FieldNote>Use comma-separated technologies for cleaner project stack parsing.</FieldNote>
                      </Field>
                      <div className="md:col-span-2">
                        <Field label="URL">
                          <input value={item.url || ''} onChange={(event) => updateProject(index, 'url', event.target.value)} className="input-shell" />
                        </Field>
                      </div>
                      <div className="md:col-span-2">
                        <Field label="Description">
                          <textarea value={item.description} rows={4} onChange={(event) => updateProject(index, 'description', event.target.value)} className="input-shell min-h-[120px] resize-y" />
                        </Field>
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => setForm((current) => ({ ...current, projects: [...current.projects, { ...EMPTY_PROJECT }] }))} className="app-button-secondary">
                  Add project
                </button>
              </div>
            </Section>

            <Section title="Work experience" description="Reusable experience entries that AI can tailor for specific jobs.">
              <div className="space-y-4">
                {form.experiences.map((item, index) => (
                  <div key={`experience-${index}`} className="app-panel-muted p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">Experience {index + 1}</div>
                      <button type="button" onClick={() => removeItem('experiences', index)} className="text-sm text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]">
                        Remove
                      </button>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <Field label="Job title">
                        <input value={item.job_title} onChange={(event) => updateExperience(index, 'job_title', event.target.value)} className="input-shell" />
                      </Field>
                      <Field label="Company">
                        <input value={item.company} onChange={(event) => updateExperience(index, 'company', event.target.value)} className="input-shell" />
                      </Field>
                      <Field label="Location">
                        <LocationAutocompleteInput value={item.location || ''} onChange={(value) => updateExperience(index, 'location', value)} />
                      </Field>
                      <Field label="Start date">
                        <input
                          type="date"
                          value={toDateInputValue(item.start_date)}
                          onClick={(event) => openNativeDatePicker(event.currentTarget)}
                          onKeyDown={(event) => {
                            if (event.key !== 'Tab') {
                              event.preventDefault();
                            }
                          }}
                          onPaste={(event) => event.preventDefault()}
                          onChange={(event) => updateExperience(index, 'start_date', event.target.value)}
                          className="input-shell"
                        />
                      </Field>
                      <Field label="End date">
                        <input
                          type="date"
                          value={toDateInputValue(item.end_date || '')}
                          onClick={(event) => openNativeDatePicker(event.currentTarget)}
                          onKeyDown={(event) => {
                            if (event.key !== 'Tab') {
                              event.preventDefault();
                            }
                          }}
                          onPaste={(event) => event.preventDefault()}
                          disabled={item.is_current}
                          onChange={(event) => updateExperience(index, 'end_date', event.target.value)}
                          className="input-shell disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </Field>
                      <label className="flex items-center gap-3 pt-8 text-sm text-[var(--text-secondary)]">
                        <input
                          type="checkbox"
                          checked={item.is_current}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            updateExperience(index, 'is_current', checked);
                            if (checked) {
                              updateExperience(index, 'end_date', getTodayDateValue());
                            }
                          }}
                        />
                        I'm Current Working Here
                      </label>
                      <div className="md:col-span-2">
                        <Field label="Bullets">
                          <div className="space-y-3">
                            {item.bullets.map((bullet, bulletIndex) => (
                              <div key={`bullet-${index}-${bulletIndex}`} className="flex gap-3">
                                <textarea
                                  rows={2}
                                  value={bullet}
                                  onChange={(event) => updateBullet(index, bulletIndex, event.target.value)}
                                  className="input-shell min-h-[84px] resize-y"
                                />
                                <button type="button" onClick={() => removeBullet(index, bulletIndex)} className="app-button-secondary self-start px-3 py-2">
                                  Remove
                                </button>
                              </div>
                            ))}
                            <button type="button" onClick={() => addBullet(index)} className="app-button-secondary">
                              Add bullet
                            </button>
                          </div>
                        </Field>
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => setForm((current) => ({ ...current, experiences: [...current.experiences, { ...EMPTY_EXPERIENCE }] }))} className="app-button-secondary">
                  Add experience
                </button>
              </div>
            </Section>
          </div>
        </div>
      </section>

      <aside className="space-y-6">
        <div className="app-panel p-6">
          <div className="app-eyebrow">Completion</div>
          <h3 className="app-subheading mt-2">
            Profile readiness
          </h3>
          <div className="mt-5 text-5xl font-semibold tracking-[-0.04em]" style={{ color: completionColor }}>
            {completionPercent}%
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full border border-white/12 bg-white/12">
            <div
              className="h-full rounded-full"
              style={{ background: completionColor, width: '100%', transform: `scaleX(${completionPercent / 100})`, transformOrigin: 'left center' }}
            />
          </div>
          <div className="relative mt-2 h-7 text-[10px] font-semibold text-[var(--text-dim)]">
            <span className="absolute left-0">0%</span>
            <span className="absolute right-0">100%</span>
            <span className="absolute left-[85%] top-0 -translate-x-full whitespace-nowrap">90%</span>
            <span
              className="absolute left-[90%] top-4 h-2 w-px bg-[var(--text-dim)]/60"
              aria-hidden="true"
            />
          </div>
          <p className="app-body mt-4">
            Higher profile completion gives the AI more raw material to produce stronger, more role-specific resumes.
          </p>
        </div>

        <div className="app-panel p-6">
          <div className="app-eyebrow">Verification inbox</div>
          <h3 className="app-subheading mt-2">
            Verify contact details after updates
          </h3>
          <div className="mt-4 space-y-4">
            <VerificationRow
              label="Email"
              value={form.email || 'No email added'}
              verifiedAt={profile?.email_verified_at}
              otpValue={emailOtp}
              onOtpChange={setEmailOtp}
              sendLabel={sendingEmailOtp ? 'Sending...' : 'Send OTP'}
              confirmLabel={confirmingEmailOtp ? 'Verifying...' : 'Confirm'}
              sendDisabled={!form.email.trim() || Boolean(profile?.email_verified_at) || sendingEmailOtp}
              confirmDisabled={!emailOtp.trim() || Boolean(profile?.email_verified_at) || confirmingEmailOtp}
              onSend={sendEmailOtp}
              onConfirm={confirmEmailOtp}
            />
            <VerificationRow
              label="Phone"
              value={form.phone || 'No phone number added'}
              verifiedAt={profile?.phone_verified_at}
              otpValue={phoneOtp}
              onOtpChange={setPhoneOtp}
              sendLabel={sendingPhoneOtp ? 'Sending...' : 'Send OTP'}
              confirmLabel={confirmingPhoneOtp ? 'Verifying...' : 'Confirm'}
              sendDisabled={!form.phone.trim() || Boolean(profile?.phone_verified_at) || sendingPhoneOtp}
              confirmDisabled={!phoneOtp.trim() || Boolean(profile?.phone_verified_at) || confirmingPhoneOtp}
              onSend={sendPhoneOtp}
              onConfirm={confirmPhoneOtp}
            />
          </div>
          <p className="mt-4 text-xs leading-5 text-[var(--text-dim)]">
            Save profile changes first, then use these inbox actions to verify the latest email and phone values.
          </p>
        </div>

        <div className="app-panel p-6">
          <div className="app-eyebrow">Saved profile inventory</div>
          <div className="mt-4 space-y-3">
            {[
              { label: 'Technical skills', value: splitList(form.technicalSkills).length },
              { label: 'Soft skills', value: splitList(form.softSkills).length },
              { label: 'Experience entries', value: form.experiences.filter((item) => item.job_title || item.company).length },
              { label: 'Projects', value: form.projects.filter((item) => item.name).length },
              { label: 'Education items', value: form.education.filter((item) => item.degree || item.institution).length },
              { label: 'Languages', value: splitList(form.languages).length },
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

  function updateEducation(index: number, field: keyof Education, value: string) {
    setForm((current) => {
      const education = [...current.education];
      education[index] = { ...education[index], [field]: value };
      return { ...current, education };
    });
  }

  function updateProject(index: number, field: keyof Project, value: string) {
    setForm((current) => {
      const projects = [...current.projects];
      projects[index] = { ...projects[index], [field]: value };
      return { ...current, projects };
    });
  }

  function updateExperience(index: number, field: keyof Experience, value: string | boolean) {
    setForm((current) => {
      const experiences = [...current.experiences];
      experiences[index] = { ...experiences[index], [field]: value } as Experience;
      return { ...current, experiences };
    });
  }

  function removeItem(key: 'education' | 'projects' | 'experiences', index: number) {
    setForm((current) => ({
      ...current,
      [key]: current[key].filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function updateBullet(experienceIndex: number, bulletIndex: number, value: string) {
    setForm((current) => {
      const experiences = [...current.experiences];
      const bullets = [...experiences[experienceIndex].bullets];
      bullets[bulletIndex] = value;
      experiences[experienceIndex] = { ...experiences[experienceIndex], bullets };
      return { ...current, experiences };
    });
  }

  function addBullet(experienceIndex: number) {
    setForm((current) => {
      const experiences = [...current.experiences];
      experiences[experienceIndex] = {
        ...experiences[experienceIndex],
        bullets: [...experiences[experienceIndex].bullets, ''],
      };
      return { ...current, experiences };
    });
  }

  function removeBullet(experienceIndex: number, bulletIndex: number) {
    setForm((current) => {
      const experiences = [...current.experiences];
      experiences[experienceIndex] = {
        ...experiences[experienceIndex],
        bullets: experiences[experienceIndex].bullets.filter((_, index) => index !== bulletIndex),
      };
      return { ...current, experiences };
    });
  }
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-[var(--border-subtle)] pt-6 first:border-t-0 first:pt-0">
      <div>
        <h3 className="text-lg font-semibold tracking-[-0.02em] text-[var(--text-primary)]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
      </div>
      <div className="mt-5">{children}</div>
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

function FieldNote({ children }: { children: React.ReactNode }) {
  return <div className="mt-2 text-xs leading-5 text-[var(--text-dim)]">{children}</div>;
}

function VerificationRow({
  label,
  value,
  verifiedAt,
  otpValue,
  onOtpChange,
  sendLabel,
  confirmLabel,
  sendDisabled,
  confirmDisabled,
  onSend,
  onConfirm,
}: {
  label: string;
  value: string;
  verifiedAt?: string | null;
  otpValue: string;
  onOtpChange: (value: string) => void;
  sendLabel: string;
  confirmLabel: string;
  sendDisabled: boolean;
  confirmDisabled: boolean;
  onSend: () => void;
  onConfirm: () => void;
}) {
  const verified = Boolean(verifiedAt);

  return (
    <div className="app-panel-muted px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--text-primary)]">{label}</div>
          <div className="mt-1 break-words text-sm leading-6 text-[var(--text-secondary)]">{value}</div>
          <div className="mt-2 text-xs text-[var(--text-dim)]">
            {verified ? `Verified on ${formatTimestamp(verifiedAt as string)}` : 'Pending verification'}
          </div>
        </div>
        <span
          className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
          style={
            verified
              ? { background: 'rgba(34, 197, 94, 0.14)', color: '#7ee787', border: '1px solid rgba(34, 197, 94, 0.24)' }
              : { background: 'rgba(245, 158, 11, 0.12)', color: '#f6c36b', border: '1px solid rgba(245, 158, 11, 0.18)' }
          }
        >
          {verified ? 'Verified' : 'Pending'}
        </span>
      </div>
      {!verified && (
        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={onSend}
            disabled={sendDisabled}
            className="app-button-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sendLabel}
          </button>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={otpValue}
              onChange={(event) => onOtpChange(event.target.value)}
              placeholder="Enter 6-digit OTP"
              className="input-shell"
            />
            <button
              type="button"
              onClick={onConfirm}
              disabled={confirmDisabled}
              className="app-button-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LocationAutocompleteInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
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
    <div className="relative">
      <input
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          window.setTimeout(() => setFocused(false), 120);
        }}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Start typing city or country"
        className="input-shell"
      />
      {focused && (results.length > 0 || searching) && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-[18px] border bg-[var(--bg-panel)] shadow-[var(--shadow-panel)]" style={{ borderColor: 'var(--border-subtle)' }}>
          {searching ? (
            <div className="px-4 py-3 text-sm text-[var(--text-secondary)]">Searching cities and countries...</div>
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
  );
}

function splitList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinList(values: string[]) {
  return values.join(', ');
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function normalizeCityCountry(value: string) {
  const [city = '', country = '', ...rest] = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (!city || !country || rest.length > 0) {
    return value.trim();
  }
  return `${city}, ${country}`;
}

function isCityCountryFormat(value: string) {
  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length === 2;
}

function toDateInputValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return `${trimmed}-01`;
  }

  const parsed = Date.parse(`1 ${trimmed}`);
  if (!Number.isNaN(parsed)) {
    const date = new Date(parsed);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  }

  return '';
}

function openNativeDatePicker(input: HTMLInputElement) {
  const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
  if (pickerInput.showPicker) {
    pickerInput.showPicker();
  }
}

function getTodayDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getProgressColor(progress: number) {
  const clamped = Math.min(100, Math.max(0, progress));
  if (clamped < 30) return '#ef4444';
  if (clamped < 60) return '#f97316';
  if (clamped < 100) return '#eab308';
  return '#22c55e';
}

function clampProgress(progress: number) {
  return Math.min(100, Math.max(0, Number.isFinite(progress) ? progress : 0));
}
