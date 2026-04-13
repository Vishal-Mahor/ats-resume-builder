'use client';
// app/resumes/[id]/page.tsx — Split-screen resume editor
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { api, type Resume, type ResumeContent, type UserSettings } from '@/lib/api';
import ResumePreview from '@/components/resume/ResumePreview';
import ATSPanel from '@/components/ats/ATSPanel';

type Tab = 'resume' | 'cover';

export default function ResumeEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [resume, setResume] = useState<Resume | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('resume');
  const [openSection, setOpenSection] = useState<string | null>('summary');
  const [content, setContent] = useState<ResumeContent | null>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [settings, setSettings] = useState<UserSettings | null>(null);

  // Placeholder meta — in production, fetch from /profile
  const meta = {
    name: 'Alex Johnson',
    email: 'alex@email.com',
    phone: '+91 98765 43210',
    location: 'Bengaluru, India',
    linkedin: 'linkedin.com/in/alexj',
    github: 'github.com/alexj',
  };

  useEffect(() => {
    api.settings.get().then(setSettings).catch(() => undefined);
  }, []);

  useEffect(() => {
    api.resumes.get(id)
      .then(r => {
        setResume(r);
        setContent(r.resume_content);
        setCoverLetter(r.cover_letter);
      })
      .catch(() => toast.error('Failed to load resume'))
      .finally(() => setLoading(false));
  }, [id]);

  async function save() {
    if (!content) return;
    setSaving(true);
    try {
      await api.resumes.update(id, { resume_content: content, cover_letter: coverLetter });
      toast.success('Saved!');
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  }

  function updateSection(section: keyof ResumeContent, value: any) {
    if (!content) return;
    setContent({ ...content, [section]: value });
  }

  async function handleResumePdfDownload() {
    try {
      await api.resumes.downloadPdf(id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to download resume PDF');
    }
  }

  async function handleCoverPdfDownload() {
    try {
      await api.resumes.downloadCoverPdf(id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to download cover letter PDF');
    }
  }

  if (loading || !resume || !content) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: Editor ────────────────────────────────── */}
      <div className="w-80 min-w-[320px] bg-white border-r border-gray-100 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-xs font-medium text-gray-800">{resume.company_name}</p>
            <p className="text-[11px] text-gray-400">{resume.job_title}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={save} disabled={saving}
              className="px-3 py-1.5 text-xs bg-emerald-700 text-white rounded-lg hover:bg-emerald-600 transition disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={handleResumePdfDownload}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600"
            >
              ↓ PDF
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 flex-shrink-0">
          {(['resume', 'cover'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-medium transition border-b-2 -mb-px ${
                tab === t ? 'text-emerald-700 border-emerald-600' : 'text-gray-400 border-transparent hover:text-gray-600'
              }`}>
              {t === 'resume' ? 'Resume' : 'Cover Letter'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {tab === 'resume' ? (
            <div className="space-y-2">
              <SectionEditor title="Summary" open={openSection === 'summary'} onToggle={() => setOpenSection(o => o === 'summary' ? null : 'summary')}>
                <textarea
                  value={content.summary}
                  onChange={e => updateSection('summary', e.target.value)}
                  rows={4}
                  className="w-full text-xs border border-gray-200 rounded-lg p-2.5 text-gray-700 resize-y focus:outline-none focus:border-emerald-400"
                />
              </SectionEditor>

              <SectionEditor title="Skills" open={openSection === 'skills'} onToggle={() => setOpenSection(o => o === 'skills' ? null : 'skills')}>
                <SkillsEditor
                  skills={[...content.skills.technical, ...content.skills.tools, ...content.skills.other]}
                  onChange={skills => updateSection('skills', { technical: skills, tools: [], other: [] })}
                />
              </SectionEditor>

              <SectionEditor title="Experience" open={openSection === 'experience'} onToggle={() => setOpenSection(o => o === 'experience' ? null : 'experience')}>
                {content.experience.map((exp, i) => (
                  <div key={i} className="mb-3 pb-3 border-b border-gray-100 last:border-b-0">
                    <input className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 mb-1.5 focus:outline-none focus:border-emerald-400" value={exp.job_title}
                      onChange={e => { const exps=[...content.experience]; exps[i]={...exps[i],job_title:e.target.value}; updateSection('experience',exps); }} />
                    <input className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 mb-1.5 text-gray-500 focus:outline-none focus:border-emerald-400" value={exp.company}
                      onChange={e => { const exps=[...content.experience]; exps[i]={...exps[i],company:e.target.value}; updateSection('experience',exps); }} />
                    <textarea className="w-full text-xs border border-gray-200 rounded-lg p-2.5 resize-y focus:outline-none focus:border-emerald-400" rows={4}
                      value={exp.bullets.join('\n')}
                      onChange={e => { const exps=[...content.experience]; exps[i]={...exps[i],bullets:e.target.value.split('\n')}; updateSection('experience',exps); }} />
                  </div>
                ))}
              </SectionEditor>

              <SectionEditor title="Projects" open={openSection === 'projects'} onToggle={() => setOpenSection(o => o === 'projects' ? null : 'projects')}>
                {content.projects.map((p, i) => (
                  <div key={i} className="mb-3 pb-3 border-b border-gray-100 last:border-b-0">
                    <input className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 mb-1.5 font-medium focus:outline-none focus:border-emerald-400" value={p.name}
                      onChange={e => { const ps=[...content.projects]; ps[i]={...ps[i],name:e.target.value}; updateSection('projects',ps); }} />
                    <input className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 mb-1.5 text-gray-500 focus:outline-none focus:border-emerald-400" value={p.tech_stack}
                      onChange={e => { const ps=[...content.projects]; ps[i]={...ps[i],tech_stack:e.target.value}; updateSection('projects',ps); }} />
                    <textarea className="w-full text-xs border border-gray-200 rounded-lg p-2.5 resize-y focus:outline-none focus:border-emerald-400" rows={2}
                      value={p.description}
                      onChange={e => { const ps=[...content.projects]; ps[i]={...ps[i],description:e.target.value}; updateSection('projects',ps); }} />
                  </div>
                ))}
              </SectionEditor>

              <SectionEditor title="Education" open={openSection === 'education'} onToggle={() => setOpenSection(o => o === 'education' ? null : 'education')}>
                {content.education.map((edu, i) => (
                  <div key={i} className="grid grid-cols-2 gap-1.5 mb-2">
                    <input className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 col-span-2 focus:outline-none focus:border-emerald-400" value={edu.degree}
                      onChange={e => { const edus=[...content.education]; edus[i]={...edus[i],degree:e.target.value}; updateSection('education',edus); }} />
                    <input className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-400" value={edu.institution}
                      onChange={e => { const edus=[...content.education]; edus[i]={...edus[i],institution:e.target.value}; updateSection('education',edus); }} />
                    <input className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-400" value={edu.year}
                      onChange={e => { const edus=[...content.education]; edus[i]={...edus[i],year:e.target.value}; updateSection('education',edus); }} />
                  </div>
                ))}
              </SectionEditor>
            </div>
          ) : (
            <div>
              <div className="mb-3">
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Tone</label>
                <select
                  value={resume.cover_letter_tone}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-emerald-400 bg-white"
                >
                  <option value="formal">Formal</option>
                  <option value="modern">Modern</option>
                  <option value="aggressive">Aggressive</option>
                </select>
              </div>
              <textarea
                value={coverLetter}
                onChange={e => setCoverLetter(e.target.value)}
                rows={20}
                className="w-full text-xs border border-gray-200 rounded-lg p-3 resize-y focus:outline-none focus:border-emerald-400 font-mono leading-relaxed"
              />
              <button
                type="button"
                onClick={handleCoverPdfDownload}
                disabled={!settings?.exports.includeCoverLetter}
                className="mt-2 w-full flex items-center justify-center py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600"
              >
                {settings?.exports.includeCoverLetter ? '↓ Download Cover Letter PDF' : 'Cover letter export disabled in settings'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Center: Live Preview ─────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-gray-100 p-5 min-w-0">
        {tab === 'resume' ? (
          <div className="shadow-sm">
            <ResumePreview meta={meta} content={content} />
          </div>
        ) : (
          <div className="bg-white max-w-2xl mx-auto p-10 shadow-sm font-sans text-sm leading-7 text-gray-800 whitespace-pre-wrap">
            {coverLetter}
          </div>
        )}
      </div>

      {/* ── Right: ATS Panel ─────────────────────────────── */}
      <ATSPanel
        score={resume.ats_score}
        matchedKeywords={resume.matched_keywords}
        missingKeywords={resume.missing_keywords}
        suggestions={resume.suggestions}
        companyName={resume.company_name}
        jobTitle={resume.job_title}
      />
    </div>
  );
}

// ─── Section Collapsible ──────────────────────────────────
function SectionEditor({ title, open, onToggle, children }: {
  title: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition"
      >
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{title}</span>
        <span className="text-gray-400 text-xs">{open ? '▾' : '›'}</span>
      </button>
      {open && <div className="p-3">{children}</div>}
    </div>
  );
}

// ─── Skills Tag Editor ────────────────────────────────────
function SkillsEditor({ skills, onChange }: { skills: string[]; onChange: (s: string[]) => void }) {
  const [input, setInput] = useState('');
  return (
    <div
      className="flex flex-wrap gap-1 p-2 border border-gray-200 rounded-lg min-h-[40px] cursor-text"
      onClick={() => document.getElementById('se-input')?.focus()}
    >
      {skills.map(s => (
        <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-medium">
          {s}
          <button onClick={() => onChange(skills.filter(x => x !== s))} className="opacity-50 hover:opacity-100">×</button>
        </span>
      ))}
      <input
        id="se-input" value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && input.trim()) {
            e.preventDefault();
            if (!skills.includes(input.trim())) onChange([...skills, input.trim()]);
            setInput('');
          }
        }}
        placeholder="Add skill..."
        className="border-none outline-none text-[11px] bg-transparent flex-1 min-w-[80px]"
      />
    </div>
  );
}
