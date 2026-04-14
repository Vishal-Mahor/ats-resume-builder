import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { pricingPlans } from '@/components/marketing/site-content';

export const metadata: Metadata = {
  title: 'Pricing | ATS Resume Builder AI',
  description: 'Compare the Free and Plus subscription plans for ATS Resume Builder.',
};

export default function PricingPage() {
  return (
    <MarketingShell
      eyebrow="Pricing"
      title="Simple pricing for focused job application workflows."
      description="Choose a free entry point or upgrade to Plus for higher resume generation and JD analysis limits. All plans include the same core workspace."
    >
      <section className="mx-auto w-full max-w-7xl px-5 py-4 sm:px-8 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-2">
          {pricingPlans.map((plan) => (
            <article
              key={plan.name}
              className={`marketing-pricing-card ${plan.featured ? 'marketing-pricing-featured' : ''}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="marketing-eyebrow">{plan.name}</div>
                  <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-white">
                    {plan.price}
                    <span className="ml-1 text-lg font-medium text-white/48">{plan.period}</span>
                  </h2>
                  <p className="mt-4 max-w-md text-sm leading-7 text-white/68">{plan.summary}</p>
                </div>
                {plan.featured ? <div className="marketing-pill">Most popular</div> : null}
              </div>

              <div className="mt-8 space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="marketing-mini-card">
                    <div className="h-2.5 w-2.5 rounded-full bg-[#ff9a3d]" />
                    <p className="text-sm leading-7 text-white/72">{feature}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex gap-3">
                <Link href={plan.href} className="marketing-button-primary">
                  {plan.cta}
                </Link>
                <Link href="/contact" className="marketing-button-ghost">
                  Talk to us
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
        <div className="marketing-section-card">
          <h2 className="marketing-section-title">What stays included across plans</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {[
              'Reusable profile with skills, experience, projects, and links',
              'Template browsing and document history',
              'Workspace dashboard and application organization',
              'Authenticated billing view, settings, and support access',
            ].map((item) => (
              <div key={item} className="marketing-mini-card">
                <div className="marketing-icon-chip text-xs font-semibold">+</div>
                <p className="text-sm leading-7 text-white/72">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
