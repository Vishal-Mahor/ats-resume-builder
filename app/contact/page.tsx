import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactForm } from '@/components/marketing/ContactForm';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { contactReasons } from '@/components/marketing/site-content';

export const metadata: Metadata = {
  title: 'Contact | ATS Resume Builder AI',
  description: 'Reach out with product questions, billing inquiries, bug reports, or feature requests.',
};

export default function ContactPage() {
  return (
    <MarketingShell
      eyebrow="Contact"
      title="Talk to us about product questions, pricing, or support needs."
      description="Use the form below to send a message directly to the workspace support inbox. If you are already a customer, you can also use the in-app support page after signing in."
    >
      <section className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-4 sm:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:px-10">
        <div className="marketing-section-card">
          <h2 className="marketing-section-title">Send a message</h2>
          <p className="mt-4 max-w-2xl text-base leading-8 text-white/70">
            Share as much context as you can so we can reply with something useful, whether that is onboarding help, billing guidance, or a deeper product conversation.
          </p>
          <div className="mt-8">
            <ContactForm />
          </div>
        </div>

        <aside className="space-y-6">
          <div className="marketing-section-card">
            <h2 className="marketing-section-title">Common reasons people reach out</h2>
            <div className="mt-5 space-y-3">
              {contactReasons.map((reason) => (
                <div key={reason} className="marketing-mini-card">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#ff9a3d]" />
                  <p className="text-sm leading-7 text-white/70">{reason}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="marketing-section-card">
            <h2 className="marketing-section-title">Already using the app?</h2>
            <p className="mt-4 text-sm leading-7 text-white/70">
              Sign in to access the authenticated support page, billing details, and your full application workspace.
            </p>
            <div className="mt-6 flex gap-3">
              <Link href="/auth/signin" className="marketing-button-primary">
                Sign in
              </Link>
              <Link href="/pricing" className="marketing-button-ghost">
                View plans
              </Link>
            </div>
          </div>
        </aside>
      </section>
    </MarketingShell>
  );
}
