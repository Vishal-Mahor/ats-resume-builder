'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import ResumePreview from '@/components/resume/ResumePreview';
import { api, type FullProfile, type JobApplication, type Resume } from '@/lib/api';

type DateFilter = 'all' | 'today' | '7-days' | '30-days' | 'older';
type DateSort = 'asc' | 'desc' | null;

const PLATFORM_OPTIONS = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'indeed', label: 'Indeed' },
  { value: 'naukri', label: 'Naukri' },
  { value: 'manual', label: 'Manual' },
] as const;

const STATUS_OPTIONS = [
  { value: 'saved', label: 'Saved' },
  { value: 'applied', label: 'Applied' },
  { value: 'interviewing', label: 'Interviewing' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'draft', label: 'Draft' },
] as const;

const JOB_GRID_COLUMNS = '44px minmax(120px,1fr) minmax(160px,1.35fr) minmax(110px,0.95fr) minmax(90px,0.75fr) minmax(105px,0.8fr) minmax(130px,0.95fr) minmax(100px,0.8fr) minmax(95px,0.75fr)';

export default function ResumeHistoryPage() {
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateSort, setDateSort] = useState<DateSort>(null);
  const [previewResume, setPreviewResume] = useState<Resume | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [addJobOpen, setAddJobOpen] = useState(false);
  const [addingJob, setAddingJob] = useState(false);
  const [savingStatusKey, setSavingStatusKey] = useState<string | null>(null);
  const [draggedJobKey, setDraggedJobKey] = useState<string | null>(null);
  const [dragOverJobKey, setDragOverJobKey] = useState<string | null>(null);
  const [jobForm, setJobForm] = useState({
    company_name: '',
    job_title: '',
    location: '',
    source_platform: 'manual',
    status: 'saved',
    application_link: '',
  });

  useEffect(() => {
    Promise.all([
      api.jobs.list(),
      api.profile.get().catch(() => null),
    ])
      .then(([jobList, profileData]) => {
        setJobs(jobList);
        setProfile(profileData);
      })
      .catch(() => toast.error('Failed to load jobs'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const nextJobs = jobs.filter((job) => {
      const matchesQuery =
        !query ||
        `${job.company_name} ${job.job_title}`.toLowerCase().includes(query.toLowerCase());
      const matchesPlatform = platform === 'all' || (job.source_platform ?? 'manual') === platform;
      const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
      const matchesDate = matchesDateFilter(job.created_at, dateFilter);

      return matchesQuery && matchesPlatform && matchesStatus && matchesDate;
    });

    if (dateSort) {
      return [...nextJobs].sort((left, right) => compareJobsByDate(left, right, dateSort));
    }

    return nextJobs;
  }, [dateFilter, jobs, platform, query, dateSort, statusFilter]);

  const statusOptions = useMemo(
    () => Array.from(new Set([...STATUS_OPTIONS.map((status) => status.value), ...jobs.map((job) => job.status).filter(Boolean)])),
    [jobs]
  );

  async function handlePreview(resumeId: string) {
    try {
      setPreviewOpen(true);
      setPreviewLoading(true);
      const data = await api.resumes.get(resumeId);
      setPreviewResume(data);
    } catch {
      setPreviewOpen(false);
      toast.error('Failed to load resume preview');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleAddJob() {
    if (!jobForm.company_name.trim() || !jobForm.job_title.trim()) {
      toast.error('Add both company name and position.');
      return;
    }

    try {
      setAddingJob(true);
      const created = await api.jobs.create({
        company_name: jobForm.company_name.trim(),
        job_title: jobForm.job_title.trim(),
        location: jobForm.location.trim(),
        source_platform: jobForm.source_platform,
        status: jobForm.status,
        application_link: jobForm.application_link.trim(),
      });
      setJobs((current) => [created, ...current]);
      setJobForm({
        company_name: '',
        job_title: '',
        location: '',
        source_platform: 'manual',
        status: 'saved',
        application_link: '',
      });
      setAddJobOpen(false);
      toast.success('Job added.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add job.');
    } finally {
      setAddingJob(false);
    }
  }

  async function handleStatusChange(job: JobApplication, status: string) {
    const key = `${job.source}-${job.id}`;
    const previousJobs = jobs;

    setSavingStatusKey(key);
    setJobs((current) =>
      current.map((item) =>
        item.id === job.id && item.source === job.source ? { ...item, status } : item
      )
    );

    try {
      const updated = await api.jobs.updateStatus({ id: job.id, source: job.source, status });
      setJobs((current) =>
        current.map((item) =>
          item.id === job.id && item.source === job.source ? { ...item, ...updated } : item
        )
      );
      toast.success('Status updated.');
    } catch (error) {
      setJobs(previousJobs);
      toast.error(error instanceof Error ? error.message : 'Failed to update status.');
    } finally {
      setSavingStatusKey(null);
    }
  }

  async function handleDrop(targetJob: JobApplication) {
    if (!draggedJobKey) return;

    const targetKey = getJobKey(targetJob);
    if (draggedJobKey === targetKey) {
      setDraggedJobKey(null);
      setDragOverJobKey(null);
      return;
    }

    const previousJobs = jobs;
    const draggedJob = jobs.find((job) => getJobKey(job) === draggedJobKey);
    if (!draggedJob) return;

    const visibleKeys = filtered.map(getJobKey);
    const reorderedVisibleKeys = moveKey(visibleKeys, draggedJobKey, targetKey);
    const visibleQueue = reorderedVisibleKeys
      .map((key) => jobs.find((job) => getJobKey(job) === key))
      .filter((job): job is JobApplication => Boolean(job));

    const nextJobs = jobs.map((job) => (visibleKeys.includes(getJobKey(job)) ? visibleQueue.shift() || job : job));
    const orderedJobs = nextJobs.map((job, index) => ({ ...job, sort_order: index }));

    setDateSort(null);
    setJobs(orderedJobs);
    setDraggedJobKey(null);
    setDragOverJobKey(null);

    try {
      await api.jobs.reorder(
        orderedJobs.map((job, index) => ({
          id: job.id,
          source: job.source,
          sort_order: index,
        }))
      );
    } catch (error) {
      setJobs(previousJobs);
      toast.error(error instanceof Error ? error.message : 'Failed to save row order.');
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
    <div className="space-y-6">
      <section className="app-panel p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="app-eyebrow">My jobs</div>
            <h2 className="app-heading mt-2">
              Search, filter, and manage every job application
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setAddJobOpen(true)}
            className="app-button-primary gap-2"
          >
            <PlusIcon />
            Add job
          </button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by company name or role"
            className="input-shell"
          />
          <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value as DateFilter)} className="input-shell">
            <option value="all">All dates</option>
            <option value="today">Today</option>
            <option value="7-days">Last 7 days</option>
            <option value="30-days">Last 30 days</option>
            <option value="older">Older than 30 days</option>
          </select>
          <select value={platform} onChange={(event) => setPlatform(event.target.value)} className="input-shell">
            <option value="all">All platforms</option>
            {PLATFORM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="input-shell">
            <option value="all">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="app-panel overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
              No jobs match these filters
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              Try a broader company, role, date, platform, or status filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[1024px]">
              <div
                className="hidden border-b bg-[var(--bg-panel-muted)] text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-dim)] lg:grid"
                style={{ borderColor: 'var(--border-subtle)', gridTemplateColumns: JOB_GRID_COLUMNS }}
              >
                <div className="px-3 py-3" aria-hidden="true" />
                {['Company', 'Position', 'Location', 'Platform'].map((label) => (
                  <div key={label} className="px-5 py-3">{label}</div>
                ))}
                <button
                  type="button"
                  onClick={() => setDateSort((current) => (current === 'desc' ? 'asc' : 'desc'))}
                  className="flex items-center gap-2 px-5 py-3 text-left transition hover:text-[var(--text-primary)]"
                >
                  Date
                  <span aria-hidden="true">{dateSort === 'asc' ? '↑' : '↓'}</span>
                </button>
                {['Status', 'Link', 'Actions'].map((label) => (
                  <div key={label} className="px-5 py-3">{label}</div>
                ))}
              </div>
              <div>
                {filtered.map((job) => (
                  <div
                    key={`${job.source}-${job.id}`}
                    draggable
                    onDragStart={() => setDraggedJobKey(getJobKey(job))}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragOverJobKey(getJobKey(job));
                    }}
                    onDragLeave={() => setDragOverJobKey(null)}
                    onDrop={() => handleDrop(job)}
                    onDragEnd={() => {
                      setDraggedJobKey(null);
                      setDragOverJobKey(null);
                    }}
                    className={`app-table-row grid gap-0 px-0 py-0 transition lg:items-stretch ${
                      draggedJobKey === getJobKey(job) ? 'opacity-50' : ''
                    } ${dragOverJobKey === getJobKey(job) ? 'bg-[var(--accent-soft)]' : ''}`}
                    style={{ gridTemplateColumns: JOB_GRID_COLUMNS }}
                  >
                    <div className="flex min-h-[64px] cursor-grab items-center justify-center text-[var(--text-dim)] active:cursor-grabbing" aria-label="Drag row">
                      <DragHandleIcon />
                    </div>
                    <TableCell className="font-semibold text-[var(--text-primary)]">{job.company_name}</TableCell>
                    <TableCell className="text-[var(--text-primary)]">{job.job_title}</TableCell>
                    <TableCell>{job.location || 'Not set'}</TableCell>
                    <TableCell>{formatPlatform(job.source_platform)}</TableCell>
                    <TableCell>{formatDate(job.created_at)}</TableCell>
                    <TableCell>
                      <select
                        value={job.status}
                        onChange={(event) => handleStatusChange(job, event.target.value)}
                        disabled={savingStatusKey === `${job.source}-${job.id}`}
                        className={`min-h-0 w-full min-w-[120px] rounded-lg border px-3 py-2 text-sm font-semibold outline-none transition disabled:cursor-wait disabled:opacity-70 ${getStatusSelectClass(job.status)}`}
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {formatStatus(status)}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      {job.application_link ? (
                        <a
                          href={job.application_link}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-[var(--accent)] underline underline-offset-4"
                        >
                          Open link
                        </a>
                      ) : (
                        <span className="text-[var(--text-dim)]">Not added</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {job.resume_id ? (
                        <button
                          type="button"
                          onClick={() => handlePreview(job.resume_id as string)}
                          className="app-button-secondary min-w-[82px] px-3 py-2 text-xs font-semibold"
                        >
                          Preview
                        </button>
                      ) : (
                        <span className="text-[var(--text-dim)]">Manual</span>
                      )}
                    </TableCell>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {previewOpen ? (
        <div className="resume-generation-modal">
          <button
            type="button"
            aria-label="Close preview"
            className="resume-generation-backdrop"
            onClick={() => {
              setPreviewOpen(false);
              setPreviewResume(null);
            }}
          />
          <div className="resume-generation-dialog max-w-[1120px]">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-5 py-4">
              <div>
                <div className="app-eyebrow">Resume preview</div>
                <h3 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">
                  {previewResume ? `${previewResume.job_title} at ${previewResume.company_name}` : 'Loading preview'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPreviewOpen(false);
                  setPreviewResume(null);
                }}
                className="app-button-secondary"
              >
                Close
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
              {previewResume ? <div className="text-sm text-[var(--text-secondary)]">Generated resume preview</div> : null}
            </div>

            <div className="max-h-[calc(100vh-14rem)] overflow-y-auto bg-[var(--bg-panel-muted)] p-5">
              {previewLoading || !previewResume ? (
                <div className="flex min-h-[420px] items-center justify-center">
                  <div className="app-panel p-3">
                    <div className="h-8 w-8 animate-spin rounded-[10px] border-2 border-white/10 border-t-[var(--accent)]" />
                  </div>
                </div>
              ) : (
                <div className="rounded-[18px] border border-[var(--border-subtle)] bg-white/95 p-4 shadow-[var(--shadow-panel)]">
                  <ResumePreview meta={getPreviewMeta(profile)} content={previewResume.resume_content} />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {addJobOpen ? (
        <AddJobModal
          form={jobForm}
          saving={addingJob}
          onChange={(field, value) => setJobForm((current) => ({ ...current, [field]: value }))}
          onClose={() => setAddJobOpen(false)}
          onSubmit={handleAddJob}
        />
      ) : null}
    </div>
  );
}

function formatPlatform(platform?: string) {
  const value = platform ?? 'manual';
  return value === 'linkedin' ? 'LinkedIn' : value === 'indeed' ? 'Indeed' : value === 'naukri' ? 'Naukri' : 'Manual';
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function matchesDateFilter(value: string, filter: DateFilter) {
  if (filter === 'all') return true;

  const date = new Date(value);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ageMs = now.getTime() - date.getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  if (filter === 'today') {
    return date >= startOfToday;
  }
  if (filter === '7-days') {
    return ageMs <= 7 * dayMs;
  }
  if (filter === '30-days') {
    return ageMs <= 30 * dayMs;
  }
  return ageMs > 30 * dayMs;
}

function formatStatus(status: string) {
  return status.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function getStatusSelectClass(status: string) {
  switch (status) {
    case 'applied':
      return 'border-blue-200 bg-blue-50 text-blue-700 focus:ring-4 focus:ring-blue-100';
    case 'interviewing':
      return 'border-violet-200 bg-violet-50 text-violet-700 focus:ring-4 focus:ring-violet-100';
    case 'offer':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 focus:ring-4 focus:ring-emerald-100';
    case 'rejected':
      return 'border-rose-200 bg-rose-50 text-rose-700 focus:ring-4 focus:ring-rose-100';
    case 'draft':
      return 'border-amber-200 bg-amber-50 text-amber-700 focus:ring-4 focus:ring-amber-100';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700 focus:ring-4 focus:ring-slate-100';
  }
}

function compareJobsByDate(left: JobApplication, right: JobApplication, dateSort: Exclude<DateSort, null>) {
  if (dateSort === 'asc') {
    return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
  }

  return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
}

function getJobKey(job: JobApplication) {
  return `${job.source}-${job.id}`;
}

function moveKey(keys: string[], sourceKey: string, targetKey: string) {
  const nextKeys = [...keys];
  const sourceIndex = nextKeys.indexOf(sourceKey);
  const targetIndex = nextKeys.indexOf(targetKey);

  if (sourceIndex === -1 || targetIndex === -1) return keys;

  const [moved] = nextKeys.splice(sourceIndex, 1);
  nextKeys.splice(targetIndex, 0, moved);
  return nextKeys;
}

function PlusIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
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

function TableCell({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex min-h-[64px] items-center px-5 py-3 text-sm text-[var(--text-secondary)] ${className}`}
    >
      <div className="min-w-0 truncate">{children}</div>
    </div>
  );
}

function AddJobModal({
  form,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  form: {
    company_name: string;
    job_title: string;
    location: string;
    source_platform: string;
    status: string;
    application_link: string;
  };
  saving: boolean;
  onChange: (field: keyof typeof form, value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button
        type="button"
        aria-label="Close add job modal"
        className="absolute inset-0 bg-[var(--bg-overlay)]"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--bg-panel-strong)] p-6 shadow-[var(--shadow-panel)]">
        <div className="app-eyebrow">Add job</div>
        <h3 className="app-subheading mt-2">Add a job manually</h3>
        <p className="app-body mt-3">
          Save a job you applied to or want to track, including the original link for quick access.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Company name</span>
            <input
              value={form.company_name}
              onChange={(event) => onChange('company_name', event.target.value)}
              className="input-shell"
              placeholder="Company"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Position</span>
            <input
              value={form.job_title}
              onChange={(event) => onChange('job_title', event.target.value)}
              className="input-shell"
              placeholder="Role title"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Location</span>
            <input
              value={form.location}
              onChange={(event) => onChange('location', event.target.value)}
              className="input-shell"
              placeholder="City, Country or Remote"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Platform</span>
            <select
              value={form.source_platform}
              onChange={(event) => onChange('source_platform', event.target.value)}
              className="input-shell"
            >
              {PLATFORM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Status</span>
            <select
              value={form.status}
              onChange={(event) => onChange('status', event.target.value)}
              className="input-shell"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Link</span>
            <input
              value={form.application_link}
              onChange={(event) => onChange('application_link', event.target.value)}
              className="input-shell"
              placeholder="https://..."
            />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onClose} className="app-button-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            className="app-button-primary disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? 'Adding...' : 'Add job'}
          </button>
        </div>
      </div>
    </div>
  );
}

function getPreviewMeta(profile: FullProfile | null) {
  return {
    name: profile?.name?.trim() || 'Candidate',
    email: profile?.email?.trim() || 'candidate@example.com',
    phone: profile?.phone?.trim() || undefined,
    location: profile?.location?.trim() || undefined,
    linkedin: profile?.linkedin?.trim() || undefined,
    github: profile?.github?.trim() || undefined,
  };
}
