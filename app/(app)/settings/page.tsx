export default function SettingsPage() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_360px]">
      <section className="space-y-6">
        <div className="app-panel p-6">
          <div className="app-eyebrow">Settings</div>
          <h2 className="app-heading mt-2">
            Manage account, notifications, and preferences
          </h2>

          <div className="mt-7 space-y-4">
            <SettingsRow title="Notification preferences" description="Choose whether to receive product updates and resume completion alerts." />
            <SettingsRow title="Export defaults" description="Set preferred file format, naming style, and default template for downloads." />
            <SettingsRow title="Privacy and data handling" description="Review how profile data and generated resumes are stored for reuse." />
          </div>
        </div>
      </section>

      <aside className="space-y-6">
        <div className="app-panel p-6">
          <div className="app-eyebrow">Subscription</div>
          <h3 className="app-subheading mt-2">
            Free plan
          </h3>
          <p className="app-body mt-3">Upgrade hooks can be added here later for billing, limits, and premium templates.</p>
        </div>
      </aside>
    </div>
  );
}

function SettingsRow({ title, description }: { title: string; description: string }) {
  return (
    <div className="app-panel-muted p-5">
      <div className="text-lg font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
        {title}
      </div>
      <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{description}</div>
    </div>
  );
}
