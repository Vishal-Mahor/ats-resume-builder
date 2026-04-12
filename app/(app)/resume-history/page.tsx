'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { api, type ResumeSummary } from '@/lib/api';

export default function ResumeHistoryPage() {
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');

  useEffect(() => {
    api.resumes
      .list()
      .then(setResumes)
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
            <div className="hidden grid-cols-[minmax(0,1.2fr)_120px_120px_110px_110px_110px] gap-3 border-b px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-dim)] lg:grid" style={{ borderColor: 'var(--border-subtle)' }}>
              <span>Resume</span>
              <span>Platform</span>
              <span>Date</span>
              <span>ATS</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            <div>
              {filtered.map((resume) => (
                <div key={resume.id} className="app-table-row grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1.2fr)_120px_120px_110px_110px_110px] lg:items-center">
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
                  <div>
                    <Link href={`/resumes/${resume.id}`} className="text-sm font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]">
                      Open
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
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
