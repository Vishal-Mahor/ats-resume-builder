'use client';
// app/dashboard/page.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, type ResumeSummary, type ResumeStats } from '@/lib/api';
import toast from 'react-hot-toast';

function ScoreChip({ score }: { score: number }) {
  const cls = score >= 80 ? 'score-high' : score >= 65 ? 'score-medium' : 'score-low';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}
      style={{ fontFamily: 'Instrument Serif, serif', fontSize: 15 }}>
      {score}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft:     'bg-gray-100 text-gray-600',
    applied:   'bg-emerald-50 text-emerald-700',
    reviewing: 'bg-blue-50 text-blue-700',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || map.draft}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<ResumeStats | null>(null);
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.resumes.stats(), api.resumes.list()])
      .then(([s, r]) => { setStats(s); setResumes(r); })
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string, company: string) {
    if (!confirm(`Delete resume for ${company}?`)) return;
    await api.resumes.delete(id);
    setResumes(prev => prev.filter(r => r.id !== id));
    toast.success('Resume deleted');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Resumes Created', value: stats?.total_resumes ?? 0, note: 'all time' },
          { label: 'Avg ATS Score',   value: stats?.avg_ats_score ?? 0,  note: 'across all resumes' },
          { label: 'Companies',       value: stats?.companies_targeted ?? 0, note: 'targeted' },
          { label: 'Best Score',      value: stats?.best_score ?? 0,      note: 'highest match' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4">
            <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-1.5">{s.label}</p>
            <p className="text-3xl font-light text-gray-900" style={{ fontFamily: 'Instrument Serif, serif' }}>
              {s.value}
            </p>
            <p className="text-[11px] text-emerald-600 mt-1">{s.note}</p>
          </div>
        ))}
      </div>

      {/* Resume Table */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Resume History</h2>
        <Link
          href="/new-resume"
          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium rounded-xl transition"
        >
          + New Resume
        </Link>
      </div>

      {resumes.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
          <p className="text-gray-400 text-sm mb-4">No resumes yet. Create your first one!</p>
          <Link href="/new-resume" className="px-5 py-2.5 bg-emerald-700 text-white text-sm rounded-xl hover:bg-emerald-600 transition">
            Create Resume
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Company', 'Role', 'ATS Score', 'Date', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resumes.map((r, i) => (
                <tr key={r.id} className={`border-b border-gray-50 hover:bg-gray-50 transition ${i === resumes.length - 1 ? 'border-b-0' : ''}`}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.company_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.job_title}</td>
                  <td className="px-4 py-3"><ScoreChip score={r.ats_score} /></td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link href={`/resumes/${r.id}`} className="px-3 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600">
                        Edit
                      </Link>
                      <a
                        href={api.resumes.pdfUrl(r.id)}
                        target="_blank"
                        className="px-3 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600"
                      >
                        PDF
                      </a>
                      <button
                        onClick={() => handleDelete(r.id, r.company_name)}
                        className="px-3 py-1 text-xs border border-red-100 rounded-lg hover:bg-red-50 transition text-red-500"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
