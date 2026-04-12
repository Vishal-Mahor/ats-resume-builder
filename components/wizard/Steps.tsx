'use client';
// ============================================================
// Wizard Step Components
// ============================================================
import { useState, KeyboardEvent } from 'react';
import type { WizardData } from '@/app/(app)/new-resume/page';

// ─── Shared Primitives ────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-gray-600 mb-1.5">{children}</label>;
}
function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props}
      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition bg-white"
    />
  );
}
function Textarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props}
      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition bg-white resize-y"
    />
  );
}
function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-4">{children}</div>;
}

// ─── Step 1: Job Info ─────────────────────────────────────
export function StepJobInfo({ data, update }: { data: WizardData; update: (p: Partial<WizardData>) => void }) {
  return (
    <Card>
      <h3 className="text-sm font-medium text-gray-800 mb-4">Job Information</h3>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <Label>Company Name</Label>
          <Input
            placeholder="e.g. Stripe"
            value={data.company_name}
            onChange={e => update({ company_name: e.target.value })}
          />
        </div>
        <div>
          <Label>Job Title</Label>
          <Input
            placeholder="e.g. Senior Software Engineer"
            value={data.job_title}
            onChange={e => update({ job_title: e.target.value })}
          />
        </div>
      </div>
      <div>
        <Label>Paste Job Description</Label>
        <Textarea
          rows={8}
          placeholder="Paste the full job description here. Our AI will extract keywords and tailor your resume to maximize your ATS score..."
          value={data.job_description}
          onChange={e => update({ job_description: e.target.value })}
        />
        <p className="text-xs text-gray-400 mt-1.5">
          The JD is used only for generation and is never stored.
        </p>
      </div>
    </Card>
  );
}

// ─── Step 2: Experience ───────────────────────────────────
export function StepExperience({ data, update }: { data: WizardData; update: (p: Partial<WizardData>) => void }) {
  function updateExp(i: number, field: string, value: any) {
    const exps = [...data.experiences];
    exps[i] = { ...exps[i], [field]: value };
    update({ experiences: exps });
  }

  function updateBullet(expIdx: number, bulletIdx: number, value: string) {
    const exps = [...data.experiences];
    const bullets = [...exps[expIdx].bullets];
    bullets[bulletIdx] = value;
    exps[expIdx] = { ...exps[expIdx], bullets };
    update({ experiences: exps });
  }

  function addBullet(expIdx: number) {
    const exps = [...data.experiences];
    exps[expIdx].bullets.push('');
    update({ experiences: exps });
  }

  function addExp() {
    update({
      experiences: [...data.experiences, {
        job_title: '', company: '', location: '',
        start_date: '', end_date: '', is_current: false, bullets: [''],
      }],
    });
  }

  return (
    <>
      {data.experiences.map((exp, i) => (
        <Card key={i}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-800">Experience {i + 1}</h3>
            {i > 0 && (
              <button
                onClick={() => update({ experiences: data.experiences.filter((_, j) => j !== i) })}
                className="text-xs text-red-400 hover:text-red-600"
              >Remove</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><Label>Job Title</Label><Input placeholder="Software Engineer" value={exp.job_title} onChange={e => updateExp(i, 'job_title', e.target.value)} /></div>
            <div><Label>Company</Label><Input placeholder="TechCorp Inc." value={exp.company} onChange={e => updateExp(i, 'company', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div><Label>Start Date</Label><Input placeholder="Jan 2022" value={exp.start_date} onChange={e => updateExp(i, 'start_date', e.target.value)} /></div>
            <div><Label>End Date</Label><Input placeholder="Present" value={exp.end_date} disabled={exp.is_current} onChange={e => updateExp(i, 'end_date', e.target.value)} /></div>
            <div className="flex items-end pb-2.5 gap-2">
              <input type="checkbox" checked={exp.is_current} onChange={e => { updateExp(i, 'is_current', e.target.checked); if (e.target.checked) updateExp(i, 'end_date', 'Present'); }} className="mt-0.5" />
              <Label>Current</Label>
            </div>
          </div>
          <div>
            <Label>Key Achievements (one per line, AI will enhance these)</Label>
            {exp.bullets.map((b, j) => (
              <Input key={j} placeholder={`• Achievement with metric (e.g. Reduced load time by 40%)`}
                value={b} onChange={e => updateBullet(i, j, e.target.value)}
                className="mb-2 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
            ))}
            <button onClick={() => addBullet(i)} className="text-xs text-emerald-700 hover:underline mt-1">+ Add bullet</button>
          </div>
        </Card>
      ))}
      <button
        onClick={addExp}
        className="w-full py-2.5 border border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-700 transition"
      >
        + Add Experience
      </button>
    </>
  );
}

// ─── Step 3: Skills + Education ───────────────────────────
export function StepSkills({ data, update }: { data: WizardData; update: (p: Partial<WizardData>) => void }) {
  const [input, setInput] = useState('');

  function addSkill(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      if (!data.skills.includes(input.trim())) {
        update({ skills: [...data.skills, input.trim()] });
      }
      setInput('');
    }
  }

  function removeSkill(skill: string) {
    update({ skills: data.skills.filter(s => s !== skill) });
  }

  function updateEdu(i: number, field: string, value: string) {
    const edu = [...data.education];
    edu[i] = { ...edu[i], [field]: value };
    update({ education: edu });
  }

  return (
    <>
      <Card>
        <h3 className="text-sm font-medium text-gray-800 mb-4">Technical Skills</h3>
        <Label>Skills (press Enter to add)</Label>
        <div
          className="flex flex-wrap gap-1.5 p-2.5 border border-gray-200 rounded-xl min-h-[52px] cursor-text bg-white"
          onClick={() => document.getElementById('skill-input')?.focus()}
        >
          {data.skills.map(s => (
            <span key={s} className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
              {s}
              <button onClick={() => removeSkill(s)} className="opacity-50 hover:opacity-100 text-sm leading-none">×</button>
            </span>
          ))}
          <input
            id="skill-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={addSkill}
            placeholder={data.skills.length === 0 ? 'Type a skill and press Enter (e.g. React)' : ''}
            className="border-none outline-none text-sm text-gray-700 bg-transparent flex-1 min-w-[120px]"
          />
        </div>
        <p className="text-xs text-gray-400 mt-1.5">Add all skills from your background — AI will pick the most relevant ones for the JD.</p>
      </Card>

      <Card>
        <h3 className="text-sm font-medium text-gray-800 mb-4">Education</h3>
        {data.education.map((edu, i) => (
          <div key={i} className={i > 0 ? 'mt-4 pt-4 border-t border-gray-100' : ''}>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><Label>Degree</Label><Input placeholder="B.Tech Computer Science" value={edu.degree} onChange={e => updateEdu(i, 'degree', e.target.value)} /></div>
              <div><Label>Institution</Label><Input placeholder="IIT Bombay" value={edu.institution} onChange={e => updateEdu(i, 'institution', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Year</Label><Input placeholder="2022" value={edu.year} onChange={e => updateEdu(i, 'year', e.target.value)} /></div>
              <div><Label>GPA (optional)</Label><Input placeholder="8.7/10" value={edu.gpa} onChange={e => updateEdu(i, 'gpa', e.target.value)} /></div>
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}

// ─── Step 4: Projects ─────────────────────────────────────
export function StepProjects({ data, update }: { data: WizardData; update: (p: Partial<WizardData>) => void }) {
  function updateProj(i: number, field: string, value: string) {
    const projs = [...data.projects];
    projs[i] = { ...projs[i], [field]: value };
    update({ projects: projs });
  }

  return (
    <>
      {data.projects.map((proj, i) => (
        <Card key={i}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-800">Project {i + 1}</h3>
            {i > 0 && (
              <button onClick={() => update({ projects: data.projects.filter((_, j) => j !== i) })}
                className="text-xs text-red-400 hover:text-red-600">Remove</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><Label>Project Name</Label><Input placeholder="RealtimeCollab" value={proj.name} onChange={e => updateProj(i, 'name', e.target.value)} /></div>
            <div><Label>Tech Stack</Label><Input placeholder="React, WebSocket, Redis" value={proj.tech_stack} onChange={e => updateProj(i, 'tech_stack', e.target.value)} /></div>
          </div>
          <div className="mb-3">
            <Label>Description & Impact</Label>
            <Textarea rows={3} placeholder="Built X using Y, resulting in Z metric. Be specific about numbers and impact..."
              value={proj.description} onChange={e => updateProj(i, 'description', e.target.value)} />
          </div>
          <div>
            <Label>URL (optional)</Label>
            <Input placeholder="github.com/you/project" value={proj.url} onChange={e => updateProj(i, 'url', e.target.value)} />
          </div>
        </Card>
      ))}
      <button
        onClick={() => update({ projects: [...data.projects, { name: '', tech_stack: '', description: '', url: '' }] })}
        className="w-full py-2.5 border border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-700 transition"
      >
        + Add Project
      </button>
    </>
  );
}

// ─── Step 5: Cover Letter Settings ────────────────────────
export function StepCoverLetter({ data, update }: { data: WizardData; update: (p: Partial<WizardData>) => void }) {
  const tones = [
    { key: 'formal',     label: 'Formal',     desc: 'Traditional, structured, respectful' },
    { key: 'modern',     label: 'Modern',      desc: 'Confident, concise, conversational' },
    { key: 'aggressive', label: 'Aggressive',  desc: 'Bold, direct, leads with impact' },
  ] as const;

  return (
    <Card>
      <h3 className="text-sm font-medium text-gray-800 mb-4">Cover Letter Settings</h3>
      <div className="mb-5">
        <Label>Tone</Label>
        <div className="grid grid-cols-3 gap-3 mt-1.5">
          {tones.map(t => (
            <button
              key={t.key}
              onClick={() => update({ cover_letter_tone: t.key })}
              className={`p-3 border rounded-xl text-left transition ${
                data.cover_letter_tone === t.key
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`text-sm font-medium mb-0.5 ${data.cover_letter_tone === t.key ? 'text-emerald-700' : 'text-gray-700'}`}>
                {t.label}
              </div>
              <div className="text-xs text-gray-400">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label>Anything to emphasize? (optional)</Label>
        <Textarea
          rows={3}
          placeholder="e.g. I'm especially excited about Stripe's mission around financial infrastructure, and my experience with payment systems..."
          value={data.cover_letter_highlight}
          onChange={e => update({ cover_letter_highlight: e.target.value })}
        />
      </div>
      <div className="mt-4 p-3 bg-gray-50 rounded-xl">
        <p className="text-xs text-gray-500">
          <strong>Summary:</strong> Resume for <strong>{data.job_title || 'role'}</strong> at{' '}
          <strong>{data.company_name || 'company'}</strong> with{' '}
          <strong>{data.cover_letter_tone}</strong> cover letter.{' '}
          JD length: {data.job_description.length} chars.
        </p>
      </div>
    </Card>
  );
}

// Default export for all steps (individual named exports used above)
export default { StepJobInfo, StepExperience, StepSkills, StepProjects, StepCoverLetter };
