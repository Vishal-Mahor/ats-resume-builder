import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import {
  featureCards,
  heroStats,
  pricingPlans,
  testimonials,
  workflowSteps,
} from '@/components/marketing/site-content';

export default function HomePage() {
  return (
    <MarketingShell>
      <section className="mx-auto w-full max-w-7xl px-5 pb-10 pt-6 sm:px-8 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] lg:items-end">
          <div className="marketing-hero-card">
            <div className="marketing-pill">Built for focused job seekers</div>
            <h1 className="marketing-hero-title mt-6">
              Build better resumes, understand ATS fit, and keep every application organized.
            </h1>
            <p className="marketing-hero-description mt-6">
              ATS Resume Builder brings resume tailoring, job-description analysis, templates, cover-letter support, and application workflow tracking into one AI-powered workspace.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/auth/signin" className="marketing-button-primary">
                Start free
              </Link>
              <Link href="/pricing" className="marketing-button-ghost">
                View pricing
              </Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {heroStats.map((item) => (
                <div key={item.label} className="marketing-stat-card">
                  <div className="text-3xl font-semibold tracking-[-0.05em] text-white">{item.value}</div>
                  <div className="mt-2 text-sm leading-6 text-white/60">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="marketing-dashboard-card">
            <div className="marketing-window-topbar">
              <span />
              <span />
              <span />
            </div>

            <div className="grid gap-4">
              <div className="marketing-mini-panel">
                <div className="marketing-label">Live workflow</div>
                <div className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">From profile to tailored resume</div>
                <p className="mt-3 text-sm leading-7 text-white/62">
                  Save your profile once, paste the JD, generate a cleaner resume, and track everything from the same dashboard.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="marketing-mini-panel">
                  <div className="marketing-label">ATS alignment</div>
                  <div className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-white">84%</div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-[84%] rounded-full bg-[#ff9a3d]" />
                  </div>
                </div>
                <div className="marketing-mini-panel">
                  <div className="marketing-label">This month</div>
                  <div className="mt-3 text-sm leading-7 text-white/62">
                    12 resumes generated
                    <br />
                    18 JD analyses completed
                    <br />
                    5 active role tracks
                  </div>
                </div>
              </div>

              <div className="marketing-mini-panel">
                <div className="marketing-label">Top value</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {['Role-specific output', 'Reusable profile', 'Faster iteration'].map((item) => (
                    <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/75">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
        <div className="marketing-section-head">
          <div>
            <div className="marketing-eyebrow">Core capabilities</div>
            <h2 className="marketing-section-title mt-4">The product website now reflects what the app actually does.</h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-white/64">
            Every section below is tied to real parts of the product: resume generation, JD analysis, templates, analytics, billing, support, and reusable candidate profile data.
          </p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {featureCards.map((item) => (
            <article key={item.title} className="marketing-feature-card">
              <div className="marketing-icon-chip">{item.icon}</div>
              <h3 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-white/68">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:px-10">
        <div className="marketing-section-card">
          <div className="marketing-eyebrow">How it works</div>
          <h2 className="marketing-section-title mt-4">A smoother application loop from start to submit.</h2>
          <p className="mt-4 text-sm leading-7 text-white/68">
            Instead of juggling scattered docs and edits, the workflow gives each application a clearer path with less repeated effort.
          </p>
        </div>

        <div className="space-y-4">
          {workflowSteps.map((item) => (
            <div key={item.step} className="marketing-mini-card marketing-workflow-row items-start">
              <div className="marketing-step-pill">{item.step}</div>
              <div>
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-white/68">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
        <div className="marketing-section-head">
          <div>
            <div className="marketing-eyebrow">Plans</div>
            <h2 className="marketing-section-title mt-4">Choose the pace that matches your application volume.</h2>
          </div>
          <Link href="/pricing" className="marketing-button-ghost">
            Full pricing page
          </Link>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {pricingPlans.map((plan) => (
            <article key={plan.name} className={`marketing-pricing-card ${plan.featured ? 'marketing-pricing-featured' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="marketing-eyebrow">{plan.name}</div>
                  <div className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-white">
                    {plan.price}
                    <span className="ml-1 text-lg font-medium text-white/48">{plan.period}</span>
                  </div>
                </div>
                {plan.featured ? <div className="marketing-pill">Best for active search</div> : null}
              </div>
              <p className="mt-4 text-sm leading-7 text-white/68">{plan.summary}</p>
              <div className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="marketing-mini-card">
                    <div className="h-2.5 w-2.5 rounded-full bg-[#ff9a3d]" />
                    <p className="text-sm leading-7 text-white/72">{feature}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
        <div className="marketing-section-head">
          <div>
            <div className="marketing-eyebrow">What users care about</div>
            <h2 className="marketing-section-title mt-4">The value is speed, clarity, and less application chaos.</h2>
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {testimonials.map((item) => (
            <article key={item.name} className="marketing-feature-card">
              <p className="text-base leading-8 text-white/74">"{item.quote}"</p>
              <div className="mt-6 border-t border-white/10 pt-4">
                <div className="text-sm font-semibold text-white">{item.name}</div>
                <div className="text-sm text-white/50">{item.role}</div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
        <div className="marketing-callout">
          <div>
            <div className="marketing-eyebrow">Get started</div>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              Launch the public site, then let the app do the heavy lifting behind it.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/64">
              Explore features, pricing, and company story publicly, then move into the authenticated workspace when you are ready to build.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/contact" className="marketing-button-ghost">
              Contact us
            </Link>
            <Link href="/auth/signin" className="marketing-button-primary">
              Create workspace
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
