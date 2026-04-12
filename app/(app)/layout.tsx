'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, setAuthToken, type User } from '@/lib/api';

type NavItem = {
  href: string;
  label: string;
  icon: (props: { active: boolean }) => JSX.Element;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
  { href: '/new-resume', label: 'Create Resume', icon: SparkIcon },
  { href: '/resume-history', label: 'Resume History', icon: HistoryIcon },
  { href: '/jd-analysis', label: 'JD Analysis', icon: AnalysisIcon },
  { href: '/profile', label: 'My Profile', icon: ProfileIcon },
  { href: '/templates', label: 'Templates', icon: TemplateIcon },
  { href: '/analytics', label: 'Analytics', icon: ChartIcon },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
];

const PROFILE_MENU = [
  { href: '/profile', label: 'My Profile' },
  { href: '/settings', label: 'Settings' },
  { href: '/settings?tab=billing', label: 'Billing / Subscription' },
  { href: '/settings?tab=terms', label: 'Terms & Conditions' },
  { href: '/settings?tab=support', label: 'Help / Support' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;

    api.auth
      .me()
      .then((currentUser) => {
        if (!active) return;
        setUser(currentUser);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!active) return;
        setAuthToken(null);
        setStatus('unauthenticated');
        router.replace('/auth/signin');
      });

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const pageTitle = useMemo(() => {
    const current = NAV_ITEMS.find((item) => pathname.startsWith(item.href));
    return current?.label ?? 'Workspace';
  }, [pathname]);

  async function handleLogout() {
    try {
      await api.auth.logout();
    } finally {
      setAuthToken(null);
      setUser(null);
      router.replace('/auth/signin');
    }
  }

  if (status === 'loading') {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center">
        <div className="app-panel p-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[var(--accent)]" />
        </div>
      </div>
    );
  }

  const initials =
    user?.name
      ?.split(' ')
      .map((value) => value[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U';

  return (
    <div className="app-shell">
      <div className="flex min-h-screen">
        <aside
          className={`relative hidden h-screen shrink-0 border-r px-3 py-4 transition-all duration-300 lg:sticky lg:top-0 lg:flex lg:flex-col ${
            collapsed ? 'w-[92px]' : 'w-[286px]'
          }`}
          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="mb-6 flex items-center justify-between gap-3 px-2">
            <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-semibold" style={{ background: '#1f8fff', color: '#07121d' }}>
                A
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold tracking-[0.02em]" style={{ color: 'var(--text-primary)' }}>ATS Resume Builder</div>
                  <div className="truncate text-xs" style={{ color: 'var(--text-dim)' }}>Workspace</div>
                </div>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setCollapsed((current) => !current)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border transition"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-panel)', color: 'var(--text-secondary)' }}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <ChevronIcon collapsed={collapsed} />
            </button>
          </div>

          <div className="app-panel-muted mb-4 p-3">
            {!collapsed ? (
              <>
                <div className="app-eyebrow">Workspace overview</div>
                <div className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                  Tailor resumes faster, track ATS progress, and keep every draft tied to real roles.
                </div>
              </>
            ) : (
              <div className="flex justify-center">
                <SparkIcon active />
              </div>
            )}
          </div>

          <nav className="flex-1 space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-3 transition ${
                    active
                      ? ''
                      : ''
                  }`}
                  style={
                    active
                      ? { background: 'var(--bg-hover)', color: 'var(--text-primary)' }
                      : { color: 'var(--text-secondary)' }
                  }
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition"
                    style={{ background: active ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)' }}
                  >
                    <Icon active={active} />
                  </div>
                  {!collapsed && (
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{item.label}</div>
                    </div>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="relative mt-4" ref={profileMenuRef}>
            {profileMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-3 rounded-[18px] border p-2 backdrop-blur-xl" style={{ background: 'rgba(18,18,19,0.98)', borderColor: 'var(--border-subtle)', boxShadow: '0 24px 48px rgba(0,0,0,0.34)' }}>
                {PROFILE_MENU.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center rounded-xl px-3 py-2.5 text-sm transition"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {item.label}
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-1 flex w-full items-center rounded-xl px-3 py-2.5 text-sm transition"
                  style={{ color: '#f3a0a0' }}
                >
                  Logout
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setProfileMenuOpen((current) => !current)}
              className="flex w-full items-center gap-3 rounded-[16px] border p-3 text-left transition"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-panel)' }}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold" style={{ background: '#1f8fff', color: '#07121d' }}>
                {initials}
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{user?.name || 'Your account'}</div>
                  <div className="truncate text-xs" style={{ color: 'var(--text-dim)' }}>{user?.email || 'Manage workspace access'}</div>
                </div>
              )}
              {!collapsed && <span style={{ color: 'var(--text-dim)' }}>{profileMenuOpen ? '−' : '+'}</span>}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b px-5 py-4 backdrop-blur-xl sm:px-7" style={{ borderColor: 'var(--border-subtle)', background: 'rgba(10,10,11,0.94)' }}>
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(true)}
                  className="app-button-secondary px-3 py-2 lg:hidden"
                  aria-label="Open navigation"
                >
                  <MenuIcon />
                </button>

                <div>
                <div className="app-caption">Workspace</div>
                <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em]" style={{ color: 'var(--text-primary)' }}>{pageTitle}</h1>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/jd-analysis"
                  className="app-button-secondary hidden sm:inline-flex"
                >
                  Analyze JD
                </Link>
                <Link
                  href="/new-resume"
                  className="app-button-primary"
                >
                  Create New Resume
                </Link>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 bg-black/60"
            aria-label="Close navigation overlay"
          />
          <div
            className="absolute inset-y-0 left-0 flex w-[290px] flex-col border-r px-3 py-4"
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
          >
            <div className="mb-6 flex items-center justify-between gap-3 px-2">
              <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-semibold" style={{ background: '#1f8fff', color: '#07121d' }}>
                  A
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold tracking-[0.02em]" style={{ color: 'var(--text-primary)' }}>ATS Resume Builder</div>
                  <div className="truncate text-xs" style={{ color: 'var(--text-dim)' }}>Workspace</div>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="app-button-secondary px-3 py-2"
                aria-label="Close navigation"
              >
                <CloseIcon />
              </button>
            </div>

            <nav className="flex-1 space-y-1">
              {NAV_ITEMS.map((item) => {
                const active = pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-center gap-3 rounded-xl px-3 py-3 transition"
                    style={
                      active
                        ? { background: 'var(--bg-hover)', color: 'var(--text-primary)' }
                        : { color: 'var(--text-secondary)' }
                    }
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition"
                      style={{ background: active ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)' }}
                    >
                      <Icon active={active} />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{item.label}</div>
                    </div>
                  </Link>
                );
              })}
            </nav>

            <div className="app-panel-muted mt-4 p-3">
              <div className="text-sm font-semibold text-[var(--text-primary)]">{user?.name || 'Your account'}</div>
              <div className="mt-1 text-xs text-[var(--text-dim)]">{user?.email || 'Manage workspace access'}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/profile" className="app-button-secondary px-3 py-2 text-xs">Profile</Link>
                <Link href="/settings" className="app-button-secondary px-3 py-2 text-xs">Settings</Link>
                <button type="button" onClick={handleLogout} className="app-button-secondary px-3 py-2 text-xs">Logout</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d={collapsed ? 'M6 3l5 5-5 5' : 'M10 3L5 8l5 5'}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 4h10M3 8h10M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function DashboardIcon({ active }: { active: boolean | undefined }) {
  return iconShell(
    active,
    <path d="M3 3h4v4H3V3zm6 0h4v6H9V3zm-6 6h4v4H3V9zm6 2h4v2H9v-2z" />
  );
}

function SparkIcon({ active }: { active: boolean | undefined }) {
  return iconShell(
    active,
    <path d="M8 1l1.6 3.9L13.5 6.5 9.6 8 8 12 6.4 8 2.5 6.5l3.9-1.6L8 1zm4.5 8.5l.8 1.9 1.7.7-1.7.7-.8 1.9-.8-1.9-1.7-.7 1.7-.7.8-1.9z" />
  );
}

function HistoryIcon({ active }: { active: boolean | undefined }) {
  return iconShell(
    active,
    <path d="M8 2a6 6 0 106 6h-1.5A4.5 4.5 0 118 3.5V1l3 2.5L8 6V4.5A3.5 3.5 0 1011.5 8H8V2z" />
  );
}

function AnalysisIcon({ active }: { active: boolean | undefined }) {
  return iconShell(
    active,
    <path d="M2.5 12.5h11M4 10V6m4 4V3m4 7V8" />
  , true);
}

function ProfileIcon({ active }: { active: boolean | undefined }) {
  return iconShell(
    active,
    <path d="M8 8a2.75 2.75 0 100-5.5A2.75 2.75 0 008 8zm-4.5 5.5c0-2.2 1.8-4 4.5-4s4.5 1.8 4.5 4H3.5z" />
  );
}

function TemplateIcon({ active }: { active: boolean | undefined }) {
  return iconShell(
    active,
    <path d="M3 3h10v10H3V3zm2 2v6m2-6h4M7 8h4M7 11h4" />
  , true);
}

function ChartIcon({ active }: { active: boolean | undefined }) {
  return iconShell(
    active,
    <path d="M3 12.5h10M4.5 10V7.5m3 2.5V5m3 5V6.5" />
  , true);
}

function SettingsIcon({ active }: { active: boolean | undefined }) {
  return iconShell(
    active,
    <path d="M8 5.5A2.5 2.5 0 108 10.5 2.5 2.5 0 008 5.5zm5 2.5l-1.2.5a4.9 4.9 0 01-.4 1l.7 1.1-1.4 1.4-1.1-.7a4.9 4.9 0 01-1 .4L8 13l-1.5-.3a4.9 4.9 0 01-1-.4l-1.1.7-1.4-1.4.7-1.1a4.9 4.9 0 01-.4-1L3 8l.3-1.5a4.9 4.9 0 01.4-1l-.7-1.1L4.4 3l1.1.7a4.9 4.9 0 011-.4L8 2.9l1.5.4a4.9 4.9 0 011 .4l1.1-.7 1.4 1.4-.7 1.1a4.9 4.9 0 01.4 1L13 8z" />
  , true);
}

function iconShell(active: boolean | undefined, path: JSX.Element, outlined = false) {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill={outlined ? 'none' : 'currentColor'} aria-hidden="true">
      {outlined ? (
        <g stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" className={active ? 'opacity-100' : 'opacity-85'}>
          {path}
        </g>
      ) : (
        <g className={active ? 'opacity-100' : 'opacity-85'}>{path}</g>
      )}
    </svg>
  );
}
