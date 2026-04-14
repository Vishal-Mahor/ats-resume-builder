import Link from 'next/link';
import type { ReactNode } from 'react';
import { marketingNavItems } from './site-content';

export function MarketingShell({
  children,
  eyebrow,
  title,
  description,
}: {
  children: ReactNode;
  eyebrow?: string;
  title?: string;
  description?: string;
}) {
  return (
    <div className="marketing-shell">
      <div className="marketing-orb marketing-orb-left" />
      <div className="marketing-orb marketing-orb-right" />

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-5 py-5 sm:px-8 lg:px-10">
        <Link href="/" className="flex items-center gap-3">
          <div className="marketing-logo-mark">A</div>
          <div>
            <div className="text-sm font-semibold tracking-[0.18em] text-white">ATS RESUME BUILDER</div>
            <div className="text-xs text-white/60">AI-powered application workspace</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {marketingNavItems.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-white/72 transition hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/auth/signin" className="marketing-button-ghost">
            Sign in
          </Link>
          <Link href="/auth/signin" className="marketing-button-primary">
            Get started
          </Link>
        </div>
      </header>

      {(title || description || eyebrow) && (
        <section className="mx-auto w-full max-w-7xl px-5 pb-8 pt-4 sm:px-8 lg:px-10">
          <div className="marketing-hero-card max-w-4xl">
            {eyebrow ? <div className="marketing-eyebrow">{eyebrow}</div> : null}
            {title ? <h1 className="marketing-page-title mt-4">{title}</h1> : null}
            {description ? <p className="marketing-page-description mt-5">{description}</p> : null}
          </div>
        </section>
      )}

      <main>{children}</main>

      <footer className="mx-auto mt-20 w-full max-w-7xl px-5 pb-10 sm:px-8 lg:px-10">
        <div className="marketing-footer">
          <div>
            <div className="text-sm font-semibold tracking-[0.18em] text-white">ATS RESUME BUILDER</div>
            <p className="mt-3 max-w-xl text-sm leading-7 text-white/65">
              A focused workspace for tailoring resumes, understanding ATS alignment, and shipping better job applications with less repetitive effort.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-white/70">
            {marketingNavItems.map((item) => (
              <Link key={item.href} href={item.href} className="transition hover:text-white">
                {item.label}
              </Link>
            ))}
            <Link href="/auth/signin" className="transition hover:text-white">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
