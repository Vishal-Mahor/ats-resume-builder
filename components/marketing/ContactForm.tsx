'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';

type FormState = {
  name: string;
  email: string;
  company: string;
  subject: string;
  message: string;
};

const initialForm: FormState = {
  name: '',
  email: '',
  company: '',
  subject: '',
  message: '',
};

export function ContactForm() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'success' | 'error'; message: string }>({
    kind: 'idle',
    message: '',
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus({ kind: 'idle', message: '' });

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const payload = (await response.json().catch(() => null)) as { sent?: boolean; error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to send your message right now.');
      }

      setForm(initialForm);
      setStatus({
        kind: 'success',
        message: 'Your message has been sent. We will get back to you soon.',
      });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to send your message right now.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="marketing-contact-form">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="marketing-label">Name</span>
          <input
            required
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            className="marketing-input"
            placeholder="Your full name"
          />
        </label>

        <label className="block">
          <span className="marketing-label">Email</span>
          <input
            required
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            className="marketing-input"
            placeholder="you@example.com"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="marketing-label">Company</span>
          <input
            value={form.company}
            onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))}
            className="marketing-input"
            placeholder="Optional"
          />
        </label>

        <label className="block">
          <span className="marketing-label">Subject</span>
          <input
            required
            value={form.subject}
            onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
            className="marketing-input"
            placeholder="How can we help?"
          />
        </label>
      </div>

      <label className="block">
        <span className="marketing-label">Message</span>
        <textarea
          required
          rows={7}
          value={form.message}
          onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
          className="marketing-input min-h-[190px] resize-y"
          placeholder="Tell us about your use case, issue, or question."
        />
      </label>

      <div className="flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-sm leading-6 text-white/55">
          We typically respond to product, billing, and feature inquiries through the support inbox configured for this workspace.
        </p>
        <button
          type="submit"
          disabled={submitting}
          className="marketing-button-form disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? 'Sending...' : 'Send message'}
        </button>
      </div>

      {status.kind !== 'idle' ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            status.kind === 'success'
              ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
              : 'border-rose-400/30 bg-rose-400/10 text-rose-100'
          }`}
        >
          {status.message}
        </div>
      ) : null}
    </form>
  );
}
