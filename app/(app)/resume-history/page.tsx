'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import ResumePreview from '@/components/resume/ResumePreview';
import { api, type FullProfile, type Resume, type ResumeSummary } from '@/lib/api';

export default function ResumeHistoryPage() {
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [previewResume, setPreviewResume] = useState<Resume | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.resumes.list(),
      api.profile.get().catch(() => null),
    ])
      .then(([resumeList, profileData]) => {
        setResumes(resumeList);
        setProfile(profileData);
      })
      .catch(() => toast.error('Failed to load resume history'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return resumes.filter((resume) => {
      const matchesQuery =
        !query ||
        `${resume.company_name} ${resume.job_title}`.toLowerCase().includes(query.toLowerCase());
      const matchesPlatform = platform === 'all' || (resume.source_platform ?? 'manual') === platform;
      const matchesScore =
        scoreFilter === 'all' ||
        (scoreFilter === 'high' && resume.ats_score >= 80) ||
        (scoreFilter === 'medium' && resume.ats_score >= 65 && resume.ats_score < 80) ||
        (scoreFilter === 'low' && resume.ats_score < 65);

      return matchesQuery && matchesPlatform && matchesScore;
    });
  }, [platform, query, resumes, scoreFilter]);

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

  async function handleDownload(resumeId: string) {
    try {
      setActionLoadingId(resumeId);
      await api.resumes.downloadPdf(resumeId);
      toast.success('Resume download started');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to download resume';
      toast.error(message);
    } finally {
      setActionLoadingId(null);
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
            <div className="app-eyebrow">Resume history</div>
            <h2 className="app-heading mt-2">
              Search, filter, and manage every generated resume
            </h2>
          </div>
          <Link
            href="/new-resume"
            className="app-button-primary"
          >
            Create resume
          </Link>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by role or company"
            className="input-shell"
          />
          <select value={platform} onChange={(event) => setPlatform(event.target.value)} className="input-shell">
            <option value="all">All platforms</option>
            <option value="linkedin">LinkedIn</option>
            <option value="indeed">Indeed</option>
            <option value="naukri">Naukri</option>
            <option value="manual">Manual</option>
          </select>
          <select value={scoreFilter} onChange={(event) => setScoreFilter(event.target.value)} className="input-shell">
            <option value="all">All ATS scores</option>
            <option value="high">80% and above</option>
            <option value="medium">65% to 79%</option>
            <option value="low">Below 65%</option>
          </select>
        </div>
      </section>

      <section className="app-panel overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
              No resumes match these filters
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              Try a broader search or create a new tailored resume for a different role.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1.15fr)_120px_120px_110px_110px_220px] gap-3 border-b px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-dim)] lg:grid" style={{ borderColor: 'var(--border-subtle)' }}>
              <span>Resume</span>
              <span>Platform</span>
              <span>Date</span>
              <span>ATS</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            <div>
              {filtered.map((resume) => (
                <div key={resume.id} className="app-table-row grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1.15fr)_120px_120px_110px_110px_220px] lg:items-center">
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{resume.job_title}</div>
                    <div className="mt-1 text-sm text-[var(--text-secondary)]">{resume.company_name}</div>
                  </div>
                  <div className="text-sm text-[var(--text-secondary)]">{formatPlatform(resume.source_platform)}</div>
                  <div className="text-sm text-[var(--text-secondary)]">{formatDate(resume.created_at)}</div>
                  <div>
                    <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${resume.ats_score >= 80 ? 'app-score-high' : resume.ats_score >= 65 ? 'app-score-medium' : 'app-score-low'}`}>
                      {resume.ats_score}%
                    </span>
                  </div>
                  <div className="text-sm text-[var(--text-secondary)] capitalize">{resume.status}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handlePreview(resume.id)}
                      className="app-button-secondary px-3 py-2 text-xs font-semibold"
                    >
                      Preview
                    </button>
                    <Link href={`/resumes/${resume.id}`} className="app-button-secondary px-3 py-2 text-xs font-semibold">
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDownload(resume.id)}
                      disabled={actionLoadingId === resume.id}
                      className="app-button-primary px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {actionLoadingId === resume.id ? 'Downloading...' : 'Download'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
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
              {previewResume ? (
                <>
                  <Link href={`/resumes/${previewResume.id}`} className="app-button-secondary">
                    Edit resume
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDownload(previewResume.id)}
                    disabled={actionLoadingId === previewResume.id}
                    className="app-button-primary disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {actionLoadingId === previewResume.id ? 'Downloading...' : 'Download PDF'}
                  </button>
                </>
              ) : null}
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
