'use client';
// app/new-resume/page.tsx — 5-step AI resume generation wizard
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

// ─── Step Components ───────────────────────────────────────
import StepJobInfo from '@/components/wizard/StepJobInfo';
import StepExperience from '@/components/wizard/StepExperience';
import StepSkills from '@/components/wizard/StepSkills';
import StepProjects from '@/components/wizard/StepProjects';
import StepCoverLetter from '@/components/wizard/StepCoverLetter';

export interface WizardData {
  // Step 1
  company_name: string;
  job_title:    string;
  job_description: string;
  // Step 2
  experiences: Array<{
    job_title: string; company: string; location: string;
    start_date: string; end_date: string; is_current: boolean; bullets: string[];
  }>;
  // Step 3
  skills: string[];
  education: Array<{ degree: string; institution: string; year: string; gpa: string }>;
  // Step 4
  projects: Array<{ name: string; tech_stack: string; description: string; url: string }>;
  // Step 5
  cover_letter_tone: 'formal' | 'modern' | 'aggressive';
  cover_letter_highlight: string;
}

const STEPS = ['Job Info', 'Experience', 'Skills', 'Projects', 'Cover Letter'];

export default function NewResumePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState('');

  const [data, setData] = useState<WizardData>({
    company_name: '', job_title: '', job_description: '',
    experiences: [{
      job_title: '', company: '', location: '',
      start_date: '', end_date: '', is_current: false, bullets: [''],
    }],
    skills: [],
    education: [{ degree: '', institution: '', year: '', gpa: '' }],
    projects: [{ name: '', tech_stack: '', description: '', url: '' }],
    cover_letter_tone: 'formal',
    cover_letter_highlight: '',
  });

  function update(partial: Partial<WizardData>) {
    setData(prev => ({ ...prev, ...partial }));
  }

  async function generate() {
    setGenerating(true);
    const genSteps = [
      'Analyzing job description...',
      'Matching your profile to the role...',
      'Generating ATS-optimized bullets...',
      'Writing your cover letter...',
      'Calculating ATS score...',
    ];

    // Animate steps
    for (const s of genSteps) {
      setGenStep(s);
      await new Promise(r => setTimeout(r, 800));
    }

    try {
      // Save profile data first
      await api.profile.update({
        experiences: data.experiences,
        skills:      data.skills,
        projects:    data.projects,
        education:   data.education,
      });

      // Generate resume
      const result = await api.generate({
        company_name:      data.company_name,
        job_title:         data.job_title,
        job_description:   data.job_description,
        cover_letter_tone: data.cover_letter_tone,
      });

      toast.success('Resume generated!');
      router.push(`/resumes/${result.resume_id}`);
    } catch (err: any) {
      toast.error(err.message || 'Generation failed');
      setGenerating(false);
    }
  }

  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-24">
        <div className="w-10 h-10 border-2 border-gray-200 border-t-emerald-600 rounded-full animate-spin mb-5" />
        <h2 className="text-xl text-gray-800 mb-2" style={{ fontFamily: 'Instrument Serif, serif' }}>
          Building your resume...
        </h2>
        <p className="text-sm text-gray-400">{genStep}</p>
      </div>
    );
  }

  const stepComponents = [
    <StepJobInfo    key="1" data={data} update={update} />,
    <StepExperience key="2" data={data} update={update} />,
    <StepSkills     key="3" data={data} update={update} />,
    <StepProjects   key="4" data={data} update={update} />,
    <StepCoverLetter key="5" data={data} update={update} />,
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl text-gray-900 mb-1" style={{ fontFamily: 'Instrument Serif, serif' }}>
          Create New Resume
        </h1>
        <p className="text-sm text-gray-400">AI tailors your resume to the job description</p>
      </div>

      {/* Step Indicator */}
      <div className="flex bg-white border border-gray-100 rounded-2xl overflow-hidden mb-6">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`flex-1 py-2.5 text-center border-r border-gray-100 last:border-r-0 cursor-pointer transition text-xs font-medium ${
              i === step
                ? 'bg-emerald-700 text-white'
                : i < step
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-gray-400'
            }`}
            onClick={() => i < step && setStep(i)}
          >
            <span className="block text-base" style={{ fontFamily: 'Instrument Serif, serif', lineHeight: 1 }}>
              {i + 1}
            </span>
            {label}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div key={step}>
        {stepComponents[step]}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-5">
        <button
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
          className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-30"
        >
          ← Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl transition"
          >
            Next →
          </button>
        ) : (
          <button
            onClick={generate}
            className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl transition flex items-center gap-2"
          >
            ✦ Generate with AI
          </button>
        )}
      </div>
    </div>
  );
}
