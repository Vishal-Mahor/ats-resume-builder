const templates = [
  { name: 'Clarity', tag: 'ATS-friendly', usage: 'Most used', description: 'Crisp hierarchy, clean sectioning, easy parsing.' },
  { name: 'Operator', tag: 'Recommended', usage: 'Great for product and ops roles', description: 'Designed to spotlight metrics, execution, and ownership.' },
  { name: 'Signal', tag: 'Modern', usage: 'Popular with tech applicants', description: 'Balanced layout with a slightly more contemporary rhythm.' },
];

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <section className="app-panel p-6">
        <div className="app-eyebrow">Templates</div>
        <h2 className="app-heading mt-2">
          Choose a visual style without sacrificing ATS readability
        </h2>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        {templates.map((template) => (
          <article key={template.name} className="app-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="app-chip">{template.tag}</span>
              <span className="app-caption">{template.usage}</span>
            </div>
            <div className="app-panel-muted mt-5 p-5">
              <div className="h-48 rounded-[1.25rem] border border-dashed" style={{ borderColor: 'var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }} />
            </div>
            <h3 className="app-subheading mt-5">
              {template.name}
            </h3>
            <p className="app-body mt-3">{template.description}</p>
            <button className="app-button-secondary mt-5">
              Preview template
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}
