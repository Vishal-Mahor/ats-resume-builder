import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { featureCards, featureHighlights, workflowSteps } from '@/components/marketing/site-content';

export const metadata: Metadata = {
  title: 'Features | ATS Resume Builder AI',
  description: 'Explore the AI resume tailoring, ATS analysis, cover letter, template, and workflow features in ATS Resume Builder.',
};

export default function FeaturesPage() {
  return (
    <MarketingShell
      eyebrow="Features"
      title="Everything you need to move from raw profile data to a sharper application."
      description="The platform combines resume generation, ATS-aware analysis, reusable profile data, and application workflow tools in one place."
    >
      <section className="mx-auto w-full max-w-7xl px-5 py-4 sm:px-8 lg:px-10">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {featureCards.map((item) => (
            <article key={item.title} className="marketing-feature-card">
              <div className="marketing-icon-chip">{item.icon}</div>
              <h2 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-white/68">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-8 sm:px-8 lg:grid-cols-2 lg:px-10">
        <div className="marketing-section-card">
          <h2 className="marketing-section-title">Feature highlights</h2>
          <div className="mt-5 grid gap-4">
            {featureHighlights.map((item) => (
              <div key={item.title} className="marketing-mini-card items-start">
                <div className="marketing-icon-chip">{item.icon}</div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-white/68">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="marketing-section-card">
          <h2 className="marketing-section-title">How the workflow fits together</h2>
          <div className="mt-5 space-y-4">
            {workflowSteps.map((item) => (
              <div key={item.step} className="marketing-mini-card items-start">
                <div className="marketing-step-pill">{item.step}</div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-white/68">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
        <div className="marketing-callout">
          <div>
            <div className="marketing-eyebrow">Build with momentum</div>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              Start with the free plan, then move to Plus when application volume increases.
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/pricing" className="marketing-button-ghost">
              Compare plans
            </Link>
            <Link href="/auth/signin" className="marketing-button-primary">
              Get started
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
