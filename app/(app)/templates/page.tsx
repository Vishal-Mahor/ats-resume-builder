'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api, type ResumeTemplate } from '@/lib/api';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<ResumeTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.templates
      .list()
      .then((items) => {
        setTemplates(items);
        setSelectedTemplateId((current) => current || items[0]?.id || '');
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Failed to load templates.'))
      .finally(() => setLoading(false));
  }, []);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? templates[0],
    [selectedTemplateId, templates]
  );

  return (
    <div className="space-y-6">
      <section className="app-panel p-6">
        <div className="app-eyebrow">Templates</div>
        <h2 className="app-heading mt-2">
          Choose a visual style without sacrificing ATS readability
        </h2>
        <p className="app-body mt-3 max-w-3xl">
          Built using ATS formatting guidance: single-column hierarchy, predictable section order, readable spacing, and recruiter-first scanning flow.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <article key={`template-skeleton-${index}`} className="app-panel flex h-full animate-pulse flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="h-7 w-24 rounded-full bg-white/10" />
                  <div className="h-4 w-24 rounded bg-white/10" />
                </div>
                <div className="app-panel-muted mt-5 p-4">
                  <TemplateMiniPreview />
                </div>
                <div className="mt-5 h-7 w-32 rounded bg-white/10" />
                <div className="mt-3 h-4 w-full rounded bg-white/10" />
                <div className="mt-2 h-4 w-[82%] rounded bg-white/10" />
                <div className="mt-4 space-y-2">
                  <div className="h-4 w-full rounded bg-white/10" />
                  <div className="h-4 w-[88%] rounded bg-white/10" />
                  <div className="h-4 w-[76%] rounded bg-white/10" />
                </div>
                <div className="mt-auto h-11 w-full rounded-2xl bg-white/10" />
              </article>
            ))
          : templates.map((template) => (
              <article key={template.id} className="app-panel flex h-full flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold leading-5 text-[var(--text-primary)]" style={{ borderColor: 'var(--border-subtle)', background: 'rgba(255,255,255,0.03)' }}>
                    {template.tag}
                  </span>
                  <span className="max-w-[52%] text-right text-[11px] font-medium leading-5 text-[var(--text-dim)]">
                    {template.usage}
                  </span>
                </div>

                <div className="app-panel-muted mt-5 p-4">
                  <TemplateMiniPreview />
                </div>

                <h3 className="app-subheading mt-5">
                  {template.name}
                </h3>
                <p className="app-body mt-3">{template.description}</p>

                <div className="mt-4 space-y-2">
                  {template.strengths.map((strength) => (
                    <div key={strength} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                      <span>{strength}</span>
                    </div>
                  ))}
                </div>

                <button type="button" className="app-button-secondary mt-auto w-full" onClick={() => setSelectedTemplateId(template.id)}>
                  Preview template
                </button>
              </article>
            ))}
      </section>

      {!loading && templates.length === 0 && (
        <section className="app-panel p-6">
          <div className="app-eyebrow">No templates found</div>
          <h3 className="app-subheading mt-2">
            Your template library is empty
          </h3>
          <p className="app-body mt-3 max-w-2xl">
            Add rows to the `resume_templates` table and this page will start pulling them automatically.
          </p>
        </section>
      )}

      {selectedTemplate && (
        <section className="app-panel p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="app-eyebrow">Template preview</div>
              <h3 className="app-subheading mt-2">{selectedTemplate.name}</h3>
              <p className="app-body mt-2 max-w-2xl">{selectedTemplate.note}</p>
            </div>
            <Link href={`/new-resume?template=${selectedTemplate.id}`} className="app-button-primary">
              Use this template
            </Link>
          </div>

          <div className="app-panel-muted mt-5 p-6">
            <TemplateDetailPreview template={selectedTemplate} />
          </div>
        </section>
      )}
    </div>
  );
}

function TemplateMiniPreview() {
  return (
    <div className="h-52 rounded-xl border p-3" style={{ borderColor: 'var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>
      <div className="h-3 w-2/5 rounded bg-white/25" />
      <div className="mt-1 h-2 w-3/5 rounded bg-white/15" />
      <div className="mt-4 h-1.5 w-full rounded bg-white/10" />
      <div className="mt-2 h-1.5 w-[88%] rounded bg-white/10" />
      <div className="mt-2 h-1.5 w-[92%] rounded bg-white/10" />
      <div className="mt-4 h-2 w-1/3 rounded bg-white/20" />
      <div className="mt-2 h-1.5 w-full rounded bg-white/10" />
      <div className="mt-2 h-1.5 w-full rounded bg-white/10" />
      <div className="mt-2 h-1.5 w-4/5 rounded bg-white/10" />
      <div className="mt-4 h-2 w-1/4 rounded bg-white/20" />
      <div className="mt-2 h-1.5 w-full rounded bg-white/10" />
    </div>
  );
}

function TemplateDetailPreview({ template }: { template: ResumeTemplate }) {
  return (
    <div className="mx-auto max-w-2xl rounded-xl border p-6" style={{ borderColor: 'var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>
      <div className="text-center">
        <div className="text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">Alex Johnson</div>
        <div className="mt-2 text-sm text-[var(--text-secondary)]">alex@email.com | +91 98765 43210 | Bengaluru, India</div>
      </div>
      <div className="mt-5 space-y-4">
        {['Summary', 'Skills', 'Experience', 'Projects', 'Education'].map((section) => (
          <div key={section}>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-dim)]">{section}</div>
            <div className="mt-2 h-1.5 w-full rounded bg-white/12" />
            <div className="mt-2 h-1.5 w-[94%] rounded bg-white/12" />
            <div className="mt-2 h-1.5 w-[86%] rounded bg-white/12" />
          </div>
        ))}
      </div>
      <div className="mt-6 text-xs text-[var(--text-dim)]">
        {template.tag} layout tuned for ATS parsing and fast recruiter scanning.
      </div>
    </div>
  );
}
