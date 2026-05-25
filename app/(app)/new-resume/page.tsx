'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Copy, FilePlus2, Pencil, PlusCircle, Sparkles, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import ResumePreview from '@/components/resume/ResumePreview';
import {
  api,
  type FullProfile,
  type ResumeContent,
  type ResumeSummary,
  type ResumeTemplate,
  type JDAnalysisResult,
} from '@/lib/api';

type CreateMode = 'build' | 'import';
type WizardStep = 'choice' | 'upload' | 'template' | 'role' | 'name';
type TailorStep = 'setup' | 'analysis';

export interface WizardData {
  company_name: string;
  job_title: string;
  job_description: string;
  experiences: Array<{
    job_title: string;
    company: string;
    location: string;
    start_date: string;
    end_date: string;
    is_current: boolean;
    bullets: string[];
  }>;
  skills: string[];
  education: Array<{ degree: string; institution: string; year: string; gpa: string }>;
  projects: Array<{ name: string; tech_stack: string; description: string; url: string }>;
  cover_letter_tone: 'formal' | 'modern' | 'aggressive';
  cover_letter_highlight: string;
}

const DEFAULT_CONTENT: ResumeContent = {
  summary: '',
  skills: { categories: [], technical: [], tools: [], other: [], soft: [] },
  section_visibility: {
    summary: true,
    skills: true,
    experience: true,
    projects: true,
    achievements: true,
    education: true,
    languages: true,
    hobbies: true,
  },
  experience: [{ job_title: '', company: '', location: '', start_date: '', end_date: '', is_current: false, bullets: [''] }],
  projects: [{ name: '', tech_stack: '', summary: '', description: '', bullets: [''], url: '' }],
  education: [{ degree: '', institution: '', year: '', gpa: '', bullets: [''] }],
  achievements: [],
  languages: [],
  hobbies: [],
};

export default function NewResumePage() {
  const router = useRouter();
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [templates, setTemplates] = useState<ResumeTemplate[]>([]);
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>('choice');
  const [createMode, setCreateMode] = useState<CreateMode>('build');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [role, setRole] = useState('');
  const [resumeName, setResumeName] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [tailorOpen, setTailorOpen] = useState(false);
  const [tailorStep, setTailorStep] = useState<TailorStep>('setup');
  const [selectedBaseId, setSelectedBaseId] = useState('');
  const [tailorCompany, setTailorCompany] = useState('');
  const [tailorRole, setTailorRole] = useState('');
  const [tailorJobUrl, setTailorJobUrl] = useState('');
  const [tailorDescription, setTailorDescription] = useState('');
  const [tailorAnalysis, setTailorAnalysis] = useState<JDAnalysisResult | null>(null);
  const [analyzingTailor, setAnalyzingTailor] = useState(false);
  const [generatingTailor, setGeneratingTailor] = useState(false);

  useEffect(() => {
    Promise.all([
      api.resumes.list(),
      api.templates.list(),
      api.profile.get().catch(() => null),
    ])
      .then(([resumeList, templateList, profileData]) => {
        setResumes(resumeList);
        setTemplates(templateList);
        setSelectedTemplate(templateList[0]?.id ?? 'clarity');
        setProfile(profileData);
      })
      .catch(() => toast.error('Failed to load resumes.'))
      .finally(() => setLoading(false));
  }, []);

  const filteredResumes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return resumes;
    return resumes.filter((resume) =>
      `${resume.company_name} ${resume.job_title}`.toLowerCase().includes(needle)
    );
  }, [query, resumes]);

  const baseResumes = useMemo(() => resumes.filter((resume) => !isTailoredResume(resume)), [resumes]);
  const tailoredResumes = useMemo(() => resumes.filter(isTailoredResume), [resumes]);

  const visibleBaseResumes = filteredResumes.filter((resume) => !isTailoredResume(resume));
  const visibleTailoredResumes = filteredResumes.filter(isTailoredResume);
  const previewMeta = {
    name: profile?.name?.trim() || 'your name',
    email: profile?.email?.trim() || '',
    phone: profile?.phone?.trim() || undefined,
    location: profile?.location?.trim() || undefined,
    linkedin: profile?.linkedin?.trim() || undefined,
    github: profile?.github?.trim() || undefined,
    website: profile?.website?.trim() || undefined,
  };

  function openWizard(mode: CreateMode) {
    setCreateMode(mode);
    setWizardStep(mode === 'import' ? 'upload' : 'choice');
    setRole('');
    setResumeName('');
    setImportFile(null);
    setWizardOpen(true);
  }

  function openTailorWizard(baseResume?: ResumeSummary) {
    const selectedBase = baseResume ?? baseResumes[0];
    setSelectedBaseId(selectedBase?.id ?? '');
    setSelectedTemplate(selectedBase?.template_id ?? templates[0]?.id ?? 'clarity');
    setTailorCompany('');
    setTailorRole(selectedBase?.job_title ?? '');
    setTailorJobUrl('');
    setTailorDescription('');
    setTailorAnalysis(null);
    setTailorStep('setup');
    setTailorOpen(true);
  }

  function chooseMode(mode: CreateMode) {
    setCreateMode(mode);
    setWizardStep(mode === 'import' ? 'upload' : 'template');
  }

  function goNext() {
    if (wizardStep === 'upload') {
      if (!importFile) {
        toast.error('Upload your resume file first.');
        return;
      }
      setWizardStep('template');
      return;
    }
    if (wizardStep === 'template') {
      if (!selectedTemplate) {
        toast.error('Choose a template format.');
        return;
      }
      setWizardStep('role');
      return;
    }
    if (wizardStep === 'role') {
      if (!role.trim()) {
        toast.error('Add the position or role.');
        return;
      }
      setWizardStep('name');
    }
  }

  async function handleCreateResume() {
    if (!resumeName.trim() || !role.trim() || !selectedTemplate) {
      toast.error('Complete the resume setup first.');
      return;
    }

    setSubmitting(true);
    try {
      const created =
        createMode === 'import'
          ? await api.resumes.import({
              resume_name: resumeName.trim(),
              job_title: role.trim(),
              template_id: selectedTemplate,
              file: importFile as File,
            })
          : await api.resumes.create({
              resume_name: resumeName.trim(),
              job_title: role.trim(),
              template_id: selectedTemplate,
              use_profile: true,
            });

      toast.success(createMode === 'import' ? 'Resume imported. Review it in the editor.' : 'Resume draft created.');
      router.push(`/resumes/${created.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create resume.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDuplicate(resume: ResumeSummary) {
    try {
      const created = await api.resumes.create({
        resume_name: `${resume.company_name} copy`,
        job_title: resume.job_title,
        template_id: resume.template_id || selectedTemplate,
        resume_content: normalizeContent(resume.resume_content),
      });
      setResumes((current) => [created, ...current]);
      toast.success('Resume duplicated.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to duplicate resume.');
    }
  }

  async function handleDelete(resume: ResumeSummary) {
    const confirmed = window.confirm(`Delete ${resume.company_name}?`);
    if (!confirmed) return;

    const previous = resumes;
    setDeletingId(resume.id);
    setResumes((current) => current.filter((item) => item.id !== resume.id));
    try {
      await api.resumes.delete(resume.id);
      toast.success('Resume deleted.');
    } catch (error) {
      setResumes(previous);
      toast.error(error instanceof Error ? error.message : 'Failed to delete resume.');
    } finally {
      setDeletingId(null);
    }
  }

  async function analyzeTailoredResume() {
    if (!selectedBaseId || !tailorCompany.trim() || !tailorRole.trim() || tailorDescription.trim().length < 50) {
      toast.error('Select a base resume and add company, role, and a complete job description.');
      return;
    }

    setAnalyzingTailor(true);
    try {
      const analysis = await api.jdAnalysis({
        base_resume_id: selectedBaseId,
        job_description: tailorDescription.trim(),
      });
      setTailorAnalysis(analysis);
      setTailorStep('analysis');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not analyze this job description.');
    } finally {
      setAnalyzingTailor(false);
    }
  }

  async function generateTailoredResume() {
    if (!selectedBaseId || !tailorAnalysis) return;

    setGeneratingTailor(true);
    try {
      const result = await api.generate({
        base_resume_id: selectedBaseId,
        company_name: tailorCompany.trim(),
        job_title: tailorRole.trim(),
        job_url: tailorJobUrl.trim() || undefined,
        template_id: selectedTemplate,
        source_platform: 'manual',
        job_description: tailorDescription.trim(),
        cover_letter_tone: 'modern',
      });
      toast.success('Tailored resume created. Review each improvement before exporting.');
      router.push(`/resumes/${result.resume_id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate tailored resume.');
    } finally {
      setGeneratingTailor(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="app-panel p-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-subtle)] border-t-[var(--accent)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="app-panel p-5">
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Base Resume</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
            A main resume targeted to a specific role/title and seniority. Create one or two base resumes, then refine them in the editor.
          </p>
          <button type="button" onClick={() => openWizard('build')} className="app-button-secondary mt-4 gap-2 px-4 py-2">
            <PlusCircle className="h-4 w-4" />
            Create New
          </button>
        </div>

        <div className="app-panel p-5">
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Job Tailored Resume</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
            A resume targeted to a specific job description and built off of a Base Resume.
          </p>
          <button type="button" onClick={() => openTailorWizard()} disabled={baseResumes.length === 0} className="app-button-secondary mt-4 gap-2 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60">
            <PlusCircle className="h-4 w-4" />
            Select Base Resume
          </button>
        </div>
      </section>

      <div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="input-shell"
          placeholder="Search resumes by title, role, or company..."
        />
      </div>

      <section className="grid gap-6 xl:grid-cols-2">
        <ResumeColumn
          title="Base Resumes"
          count={baseResumes.length}
          emptyText="No base resumes yet. Create or import one to get started."
          resumes={visibleBaseResumes}
          previewMeta={previewMeta}
          deletingId={deletingId}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onTailor={openTailorWizard}
        />

        <ResumeColumn
          title="Job Tailored Resumes"
          count={tailoredResumes.length}
          emptyText="No tailored resumes yet. Select a base resume and a job description to create one."
          resumes={visibleTailoredResumes}
          previewMeta={previewMeta}
          deletingId={deletingId}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onTailor={openTailorWizard}
          tailored
        />
      </section>

      {wizardOpen ? (
        <CreateResumeModal
          mode={createMode}
          step={wizardStep}
          templates={templates}
          selectedTemplate={selectedTemplate}
          role={role}
          resumeName={resumeName}
          importFile={importFile}
          submitting={submitting}
          onChooseMode={chooseMode}
          onTemplateChange={setSelectedTemplate}
          onRoleChange={setRole}
          onNameChange={setResumeName}
          onFileChange={setImportFile}
          onNext={goNext}
          onSubmit={handleCreateResume}
          onClose={() => setWizardOpen(false)}
        />
      ) : null}

      {tailorOpen ? (
        <TailorResumeModal
          step={tailorStep}
          baseResumes={baseResumes}
          selectedBaseId={selectedBaseId}
          selectedTemplate={selectedTemplate}
          templates={templates}
          company={tailorCompany}
          role={tailorRole}
          jobUrl={tailorJobUrl}
          description={tailorDescription}
          analysis={tailorAnalysis}
          analyzing={analyzingTailor}
          generating={generatingTailor}
          onBaseChange={setSelectedBaseId}
          onTemplateChange={setSelectedTemplate}
          onCompanyChange={setTailorCompany}
          onRoleChange={setTailorRole}
          onJobUrlChange={setTailorJobUrl}
          onDescriptionChange={setTailorDescription}
          onAnalyze={() => void analyzeTailoredResume()}
          onBack={() => setTailorStep('setup')}
          onGenerate={() => void generateTailoredResume()}
          onClose={() => setTailorOpen(false)}
        />
      ) : null}
    </div>
  );
}

function ResumeColumn({
  title,
  count,
  resumes,
  emptyText,
  previewMeta,
  deletingId,
  tailored = false,
  onDuplicate,
  onDelete,
  onTailor,
}: {
  title: string;
  count: number;
  resumes: ResumeSummary[];
  emptyText: string;
  previewMeta: Parameters<typeof ResumePreview>[0]['meta'];
  deletingId: string | null;
  tailored?: boolean;
  onDuplicate: (resume: ResumeSummary) => void;
  onDelete: (resume: ResumeSummary) => void;
  onTailor: (resume?: ResumeSummary) => void;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
        <span className="text-sm text-[var(--text-secondary)]">({count})</span>
      </div>
      {resumes.length === 0 ? (
        <div className="app-panel p-8 text-center text-sm text-[var(--text-secondary)]">{emptyText}</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {resumes.map((resume) => (
            <ResumeCard
              key={resume.id}
              resume={resume}
              previewMeta={previewMeta}
              deleting={deletingId === resume.id}
              tailored={tailored}
              onDuplicate={() => onDuplicate(resume)}
              onDelete={() => onDelete(resume)}
              onTailor={() => onTailor(resume)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ResumeCard({
  resume,
  previewMeta,
  deleting,
  tailored,
  onDuplicate,
  onDelete,
  onTailor,
}: {
  resume: ResumeSummary;
  previewMeta: Parameters<typeof ResumePreview>[0]['meta'];
  deleting: boolean;
  tailored: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  onTailor: () => void;
}) {
  return (
    <div className="app-panel grid gap-4 p-4 sm:grid-cols-[138px_minmax(0,1fr)]">
      <div className="h-[184px] overflow-hidden rounded-sm bg-white shadow-sm">
        <div className="origin-top-left scale-[0.172]">
          <div className="w-[794px]">
            <ResumePreview meta={previewMeta} content={normalizeContent(resume.resume_content)} />
          </div>
        </div>
      </div>
      <div className="flex min-w-0 flex-col justify-between gap-4">
        <div className="space-y-1.5 text-sm">
          <p className="truncate text-[var(--text-secondary)]">
            Resume Title: <span className="font-semibold text-[var(--text-primary)]">{resume.company_name}</span>
          </p>
          <p className="truncate text-[var(--text-secondary)]">Job Title: {resume.job_title}</p>
          {tailored ? <p className="truncate text-[var(--text-secondary)]">Used Base Resume: {resume.base_resume_name || 'Unavailable'}</p> : null}
        </div>
        <div className="grid gap-2">
          <Link href={`/resumes/${resume.id}`} className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-100">
            <Pencil className="h-4 w-4" />
            Edit Resume
          </Link>
          {!tailored ? (
            <button type="button" onClick={onTailor} className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-100">
              <PlusCircle className="h-4 w-4" />
              Tailor to Job
            </button>
          ) : null}
          <button type="button" onClick={onDuplicate} className="inline-flex items-center justify-center gap-2 rounded-full bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-600 transition hover:bg-violet-100">
            <Copy className="h-4 w-4" />
            Duplicate
          </button>
          <button type="button" onClick={onDelete} disabled={deleting} className="inline-flex items-center justify-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-wait disabled:opacity-60">
            <Trash2 className="h-4 w-4" />
            {deleting ? 'Deleting' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateResumeModal({
  mode,
  step,
  templates,
  selectedTemplate,
  role,
  resumeName,
  importFile,
  submitting,
  onChooseMode,
  onTemplateChange,
  onRoleChange,
  onNameChange,
  onFileChange,
  onNext,
  onSubmit,
  onClose,
}: {
  mode: CreateMode;
  step: WizardStep;
  templates: ResumeTemplate[];
  selectedTemplate: string;
  role: string;
  resumeName: string;
  importFile: File | null;
  submitting: boolean;
  onChooseMode: (mode: CreateMode) => void;
  onTemplateChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onNext: () => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center px-4 py-6">
      <button type="button" aria-label="Close create resume modal" className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl rounded-[18px] bg-white p-8 shadow-2xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-[-0.03em] text-slate-950">Create a Resume</h2>
          <p className="mt-4 text-xl text-slate-600">{getWizardSubtitle(step, mode)}</p>
        </div>

        <div className="mt-9">
          {step === 'choice' ? (
            <div className="grid gap-8 md:grid-cols-2">
              <ChoiceCard icon={<FilePlus2 className="h-9 w-9" />} title="Build Resume" description="Create a new resume from scratch with AI assistance" onClick={() => onChooseMode('build')} />
              <ChoiceCard icon={<Upload className="h-9 w-9" />} title="Import Resume" description="Upload your existing resume to get started" onClick={() => onChooseMode('import')} purple />
            </div>
          ) : null}

          {step === 'upload' ? (
            <label className="mx-auto flex max-w-xl cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 px-6 py-10 text-center transition hover:bg-blue-50">
              <Upload className="h-10 w-10 text-blue-600" />
              <span className="mt-4 text-lg font-semibold text-slate-950">{importFile ? importFile.name : 'Upload resume file'}</span>
              <span className="mt-2 text-sm text-slate-600">PDF, DOCX, or TXT</span>
              <input type="file" accept=".pdf,.doc,.docx,.txt,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={(event) => onFileChange(event.target.files?.[0] ?? null)} />
            </label>
          ) : null}

          {step === 'template' ? (
            <div className="grid gap-4 md:grid-cols-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => onTemplateChange(template.id)}
                  className={`rounded-2xl border p-5 text-left transition ${selectedTemplate === template.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  <div className="font-semibold text-slate-950">{template.name}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">{template.note || template.description}</div>
                </button>
              ))}
            </div>
          ) : null}

          {step === 'role' ? (
            <div className="mx-auto max-w-xl">
              <label className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Position / Role</label>
              <input value={role} onChange={(event) => onRoleChange(event.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="Software Engineer" />
            </div>
          ) : null}

          {step === 'name' ? (
            <div className="mx-auto max-w-xl">
              <label className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Resume Name</label>
              <input value={resumeName} onChange={(event) => onNameChange(event.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="Software Engineer II Base Resume" />
            </div>
          ) : null}
        </div>

        <div className="mt-9 flex justify-center gap-3">
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-5 py-3 font-medium text-slate-600 transition hover:bg-slate-200">
            Cancel
          </button>
          {step !== 'choice' && step !== 'name' ? (
            <button type="button" onClick={onNext} className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700">
              Continue
            </button>
          ) : null}
          {step === 'name' ? (
            <button type="button" onClick={onSubmit} disabled={submitting} className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">
              {submitting ? 'Creating...' : mode === 'import' ? 'Import and Edit' : 'Create and Edit'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TailorResumeModal({
  step,
  baseResumes,
  selectedBaseId,
  selectedTemplate,
  templates,
  company,
  role,
  jobUrl,
  description,
  analysis,
  analyzing,
  generating,
  onBaseChange,
  onTemplateChange,
  onCompanyChange,
  onRoleChange,
  onJobUrlChange,
  onDescriptionChange,
  onAnalyze,
  onBack,
  onGenerate,
  onClose,
}: {
  step: TailorStep;
  baseResumes: ResumeSummary[];
  selectedBaseId: string;
  selectedTemplate: string;
  templates: ResumeTemplate[];
  company: string;
  role: string;
  jobUrl: string;
  description: string;
  analysis: JDAnalysisResult | null;
  analyzing: boolean;
  generating: boolean;
  onBaseChange: (value: string) => void;
  onTemplateChange: (value: string) => void;
  onCompanyChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onJobUrlChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onAnalyze: () => void;
  onBack: () => void;
  onGenerate: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center px-4 py-6">
      <button type="button" aria-label="Close tailored resume setup" className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[18px] bg-white p-7 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-[-0.03em] text-slate-950">Create Job Tailored Resume</h2>
            <p className="mt-2 text-sm text-slate-600">
              {step === 'setup' ? 'Use a base resume as factual evidence for one target job.' : 'Review grounded match signals before generation.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">Close</button>
        </div>

        {step === 'setup' ? (
          <div className="mt-6 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <ModalField label="Base resume">
                <select value={selectedBaseId} onChange={(event) => onBaseChange(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-blue-500">
                  <option value="">Select a base resume</option>
                  {baseResumes.map((resume) => (
                    <option key={resume.id} value={resume.id}>{resume.company_name} - {resume.job_title}</option>
                  ))}
                </select>
              </ModalField>
              <ModalField label="Template">
                <select value={selectedTemplate} onChange={(event) => onTemplateChange(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-blue-500">
                  {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
              </ModalField>
              <ModalField label="Company name">
                <input value={company} onChange={(event) => onCompanyChange(event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-950 outline-none focus:border-blue-500" placeholder="Target company" />
              </ModalField>
              <ModalField label="Target role">
                <input value={role} onChange={(event) => onRoleChange(event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-950 outline-none focus:border-blue-500" placeholder="Software Engineer" />
              </ModalField>
            </div>
            <ModalField label="Job URL (optional)">
              <input value={jobUrl} onChange={(event) => onJobUrlChange(event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-950 outline-none focus:border-blue-500" placeholder="https://company.com/jobs/role" />
            </ModalField>
            <ModalField label="Job description">
              <textarea value={description} onChange={(event) => onDescriptionChange(event.target.value)} rows={9} className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 text-slate-950 outline-none focus:border-blue-500" placeholder="Paste the complete job description. The tailored resume will only use claims supported by your selected base resume." />
            </ModalField>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-5 py-3 font-medium text-slate-600">Cancel</button>
              <button type="button" onClick={onAnalyze} disabled={analyzing} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60">
                <Sparkles className="h-4 w-4" />
                {analyzing ? 'Analyzing...' : 'Analyze Job Match'}
              </button>
            </div>
          </div>
        ) : analysis ? (
          <div className="mt-6 space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <AnalysisMetric label="Initial match" value={`${analysis.atsScore}%`} />
              <AnalysisMetric label="Required skills" value={`${analysis.requiredSkills.length}`} />
              <AnalysisMetric label="Missing keywords" value={`${analysis.missingKeywords.length}`} />
            </div>
            <AnalysisList title="Matched evidence" items={analysis.matchedKeywords} emptyText="No direct matched keywords found yet." tone="green" />
            <AnalysisList title="Missing or unsupported" items={analysis.missingKeywords} emptyText="No critical gaps detected." tone="amber" />
            <AnalysisList title="Required skills in this role" items={analysis.requiredSkills} emptyText="No required skills extracted." tone="blue" />
            <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              Generation rewrites and reorders supported evidence from the selected base resume. Unsupported requirements stay listed as gaps rather than being invented.
            </p>
            <div className="flex flex-wrap justify-between gap-3">
              <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-5 py-3 font-medium text-slate-600">
                <ArrowLeft className="h-4 w-4" />
                Edit details
              </button>
              <button type="button" onClick={onGenerate} disabled={generating} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60">
                <Sparkles className="h-4 w-4" />
                {generating ? 'Generating...' : 'Generate Tailored Resume'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function AnalysisMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function AnalysisList({ title, items, emptyText, tone }: { title: string; items: string[]; emptyText: string; tone: 'green' | 'amber' | 'blue' }) {
  const color = tone === 'green' ? 'bg-emerald-50 text-emerald-700' : tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700';
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.length ? items.slice(0, 12).map((item) => (
          <span key={`${title}-${item}`} className={`rounded-full px-3 py-1.5 text-xs font-medium ${color}`}>{item}</span>
        )) : <span className="text-sm text-slate-500">{emptyText}</span>}
      </div>
    </div>
  );
}

function ChoiceCard({ icon, title, description, onClick, purple = false }: { icon: React.ReactNode; title: string; description: string; onClick: () => void; purple?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="rounded-2xl border border-slate-100 px-8 py-10 text-center transition hover:border-blue-200 hover:shadow-lg">
      <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${purple ? 'bg-violet-100 text-violet-600' : 'bg-blue-100 text-blue-600'}`}>{icon}</span>
      <span className="mt-7 block text-2xl font-bold text-slate-950">{title}</span>
      <span className="mx-auto mt-5 block max-w-[260px] text-base leading-6 text-slate-600">{description}</span>
    </button>
  );
}

function getWizardSubtitle(step: WizardStep, mode: CreateMode) {
  if (step === 'choice') return 'Choose an option to get started';
  if (step === 'upload') return 'Upload your existing resume';
  if (step === 'template') return 'Choose the template format';
  if (step === 'role') return 'Add the position or role';
  return mode === 'import' ? 'Name this imported resume' : 'Name this resume';
}

function isTailoredResume(resume: ResumeSummary) {
  return resume.status === 'tailored';
}

function normalizeContent(content: ResumeSummary['resume_content']): ResumeContent {
  if (!content) return DEFAULT_CONTENT;
  if (typeof content === 'string') {
    try {
      return JSON.parse(content) as ResumeContent;
    } catch {
      return DEFAULT_CONTENT;
    }
  }
  return content;
}
