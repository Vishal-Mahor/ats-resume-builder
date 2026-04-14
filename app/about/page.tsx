import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { aboutPrinciples } from '@/components/marketing/site-content';

export const metadata: Metadata = {
  title: 'About | ATS Resume Builder AI',
  description: 'Learn what ATS Resume Builder is building for modern job seekers and application workflows.',
};

export default function AboutPage() {
  return (
    <MarketingShell
      eyebrow="About us"
      title="We are building a calmer, smarter way to prepare job applications."
      description="ATS Resume Builder is designed for people who are tired of rewriting the same story for every role and guessing whether their resume matches the job."
    >
      <section className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-4 sm:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:px-10">
        <div className="marketing-section-card">
          <h2 className="marketing-section-title">Why this product exists</h2>
          <div className="mt-5 space-y-5 text-base leading-8 text-white/72">
            <p>
              Applying to jobs should not feel like maintaining a chaotic stack of copied resumes, forgotten edits, and vague ATS advice. We built this workspace to give that process more structure.
            </p>
            <p>
              The goal is simple: help candidates move faster without sounding generic. That means keeping profile data reusable, showing where job-fit gaps exist, and making each application easier to tailor.
            </p>
            <p>
              We care about practical value over hype. If a feature does not reduce friction, improve clarity, or help someone submit a better application, it does not belong here.
            </p>
          </div>
        </div>

        <aside className="marketing-section-card">
          <h2 className="marketing-section-title">What we believe</h2>
          <div className="mt-5 grid gap-4">
            {aboutPrinciples.map((item) => (
              <div key={item.title} className="marketing-mini-card">
                <div className="marketing-icon-chip">{item.icon}</div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-white/68">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
        <div className="marketing-callout">
          <div>
            <div className="marketing-eyebrow">Ready to see it in action?</div>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              Start with a free workspace and build your next application with better signal.
            </h2>
          </div>
          <Link href="/auth/signin" className="marketing-button-primary">
            Create account
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
