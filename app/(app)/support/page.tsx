'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { api, type SupportCategory } from '@/lib/api';

const CATEGORY_OPTIONS: Array<{ value: SupportCategory; label: string; hint: string }> = [
  { value: 'feature-request', label: 'Feature request', hint: 'Request a new product capability.' },
  { value: 'suggestion', label: 'Suggestion', hint: 'Share usability or workflow improvements.' },
  { value: 'bug-report', label: 'Bug report', hint: 'Report broken behavior or incorrect data.' },
  { value: 'billing', label: 'Billing', hint: 'Questions about plans, usage, or invoices.' },
  { value: 'account', label: 'Account', hint: 'Access, login, verification, or profile issues.' },
  { value: 'other', label: 'Other', hint: 'Anything else support should know.' },
];

export default function SupportPage() {
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    category: 'feature-request' as SupportCategory,
    subject: '',
    message: '',
  });

  async function handleSubmit() {
    if (!form.subject.trim() || !form.message.trim()) {
      toast.error('Please add both a subject and detailed message.');
      return;
    }

    setSending(true);
    try {
      await api.support.submit({
        category: form.category,
        subject: form.subject.trim(),
        message: form.message.trim(),
      });
      setForm({ category: 'feature-request', subject: '', message: '' });
      toast.success('Support request sent successfully.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send support request.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.9fr)]">
      <section className="space-y-6">
        <div className="app-panel p-6 sm:p-7">
          <div className="app-badge">Support / Help</div>
          <h2 className="app-heading mt-4">Send a categorized request to support</h2>
          <p className="app-body mt-3 max-w-2xl">
            Choose the request type, add a concise subject, and include full details so we can respond with actionable help.
          </p>

          <div className="mt-7 grid gap-4">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Request type</span>
              <select
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as SupportCategory }))}
                className="input-shell"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Subject</span>
              <input
                value={form.subject}
                onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
                placeholder="Example: Add role-specific cover letter presets"
                className="input-shell"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Details</span>
              <textarea
                rows={9}
                value={form.message}
                onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                placeholder="Describe what you expected, what happened, and any relevant context (page, role, workflow, error text)."
                className="input-shell min-h-[220px] resize-y"
              />
            </label>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={sending}
                className="app-button-primary disabled:cursor-not-allowed disabled:opacity-70"
              >
                {sending ? 'Sending...' : 'Send request'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <aside className="space-y-6">
        <div className="app-panel p-6">
          <div className="app-eyebrow">Request categories</div>
          <h3 className="app-subheading mt-2">Choose the closest type</h3>
          <div className="mt-4 space-y-3">
            {CATEGORY_OPTIONS.map((option) => (
              <div key={option.value} className="app-panel-muted p-4">
                <div className="text-sm font-semibold text-[var(--text-primary)]">{option.label}</div>
                <div className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{option.hint}</div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
