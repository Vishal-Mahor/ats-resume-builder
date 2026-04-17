'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, setAuthToken, type NotificationItem, type User } from '@/lib/api';

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
  { href: '/billing', label: 'Billing', icon: WalletIcon },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
];

const PROFILE_MENU = [
  { href: '/profile', label: 'My Profile' },
  { href: '/settings', label: 'Settings' },
  { href: '/billing', label: 'Billing / Subscription' },
  { href: '/support', label: 'Help / Support' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [workspaceName, setWorkspaceName] = useState('ATS Resume Builder');
  const [collapsed, setCollapsed] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;

    api.auth
      .me()
      .then(async (currentUser) => {
        if (!active) return;
        setUser(currentUser);
        setStatus('authenticated');

        try {
          const settings = await api.settings.get();
          if (!active) return;
          setWorkspaceName(settings.workspaceName);
        } catch {
          if (!active) return;
          setWorkspaceName('ATS Resume Builder');
        }
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
      if (!notificationMenuRef.current?.contains(event.target as Node)) {
        setNotificationMenuOpen(false);
      }
    }

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleSettingsUpdate(event: Event) {
      const customEvent = event as CustomEvent<{ workspaceName?: string }>;
      if (customEvent.detail?.workspaceName) {
        setWorkspaceName(customEvent.detail.workspaceName);
      }
    }

    window.addEventListener('workspace-settings-updated', handleSettingsUpdate as EventListener);
    return () => window.removeEventListener('workspace-settings-updated', handleSettingsUpdate as EventListener);
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let active = true;

    async function refreshNotifications() {
      try {
        const payload = await api.notifications.list(20);
        if (!active) return;
        setNotifications(payload.items);
        setUnreadNotifications(payload.unreadCount);
      } catch {
        if (!active) return;
      }
    }

    refreshNotifications();
    const intervalId = window.setInterval(refreshNotifications, 30000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [status]);

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

  async function handleNotificationToggle() {
    const nextOpen = !notificationMenuOpen;
    setNotificationMenuOpen(nextOpen);
    if (nextOpen) {
      try {
        const payload = await api.notifications.list(20);
        setNotifications(payload.items);
        setUnreadNotifications(payload.unreadCount);
      } catch {
        // Ignore transient notification fetch errors in header interactions.
      }
    }
  }

  async function handleMarkNotificationRead(notificationId: string) {
    try {
      const payload = await api.notifications.markRead(notificationId);
      setNotifications(payload.items);
      setUnreadNotifications(payload.unreadCount);
    } catch {
      // Ignore transient errors to avoid interrupting main workflow.
    }
  }

  async function handleMarkAllNotificationsRead() {
    try {
      const payload = await api.notifications.markAllRead();
      setNotifications(payload.items);
      setUnreadNotifications(payload.unreadCount);
    } catch {
      // Ignore transient errors to avoid interrupting main workflow.
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
              <div className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-semibold" style={{ background: 'linear-gradient(135deg, #22d3ee, #6366f1)', color: '#06111d', boxShadow: '0 0 28px rgba(34,211,238,0.22)' }}>
                A
              </div>
              {!collapsed && (
                  <div className="min-w-0">
                  <div className="truncate text-sm font-semibold tracking-[0.02em]" style={{ color: 'var(--text-primary)' }}>{workspaceName}</div>
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

        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b px-5 py-4 backdrop-blur-xl sm:px-7" style={{ borderColor: 'var(--border-subtle)', background: 'rgba(6,14,24,0.88)' }}>
            <div className="flex w-full items-center justify-between gap-4">
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
                <div className="relative hidden md:block" ref={notificationMenuRef}>
                  <button
                    type="button"
                    onClick={handleNotificationToggle}
                    className="relative flex h-11 w-11 items-center justify-center rounded-xl border transition"
                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-panel)', color: 'var(--text-secondary)' }}
                    aria-label="Notifications"
                  >
                    <BellIcon />
                    {unreadNotifications > 0 && (
                      <span
                        className="absolute -right-1 -top-1 min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold leading-4 text-white"
                        style={{ background: 'linear-gradient(135deg, #fb7185, #f97316)' }}
                      >
                        {unreadNotifications > 99 ? '99+' : unreadNotifications}
                      </span>
                    )}
                  </button>

                  {notificationMenuOpen && (
                    <div
                      className="absolute right-0 top-[calc(100%+12px)] z-30 w-[340px] rounded-[20px] border p-3 backdrop-blur-xl"
                      style={{ background: 'rgba(18,18,19,0.98)', borderColor: 'var(--border-subtle)', boxShadow: '0 24px 48px rgba(0,0,0,0.34)' }}
                    >
                      <div className="mb-2 flex items-center justify-between px-1">
                        <div className="text-sm font-semibold text-[var(--text-primary)]">Notifications</div>
                        <button
                          type="button"
                          onClick={handleMarkAllNotificationsRead}
                          disabled={unreadNotifications === 0}
                          className="text-xs font-semibold text-[var(--text-secondary)] disabled:opacity-50"
                        >
                          Mark all read
                        </button>
                      </div>

                      <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                        {notifications.length > 0 ? (
                          notifications.map((notification) => (
                            <button
                              key={notification.id}
                              type="button"
                              onClick={() => handleMarkNotificationRead(notification.id)}
                              className="block w-full rounded-xl border px-4 py-3 text-left transition hover:bg-[var(--bg-hover)]"
                              style={{
                                borderColor: 'var(--border-subtle)',
                                background: notification.is_read ? 'transparent' : 'rgba(31,143,255,0.08)',
                              }}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="text-sm font-semibold text-[var(--text-primary)]">{notification.title}</div>
                                {!notification.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />}
                              </div>
                              <div className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{notification.message}</div>
                              <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
                                {formatRelativeTime(notification.created_at)}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="rounded-xl border px-4 py-4 text-sm text-[var(--text-secondary)]" style={{ borderColor: 'var(--border-subtle)' }}>
                            No notifications in the last 24 hours.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="relative hidden md:block" ref={profileMenuRef}>
                  {profileMenuOpen && (
                    <div
                      className="absolute right-0 top-[calc(100%+12px)] z-30 w-[280px] rounded-[20px] border p-2 backdrop-blur-xl"
                      style={{ background: 'rgba(18,18,19,0.98)', borderColor: 'var(--border-subtle)', boxShadow: '0 24px 48px rgba(0,0,0,0.34)' }}
                    >
                      {PROFILE_MENU.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setProfileMenuOpen(false)}
                          className="flex items-center rounded-xl px-4 py-3 text-sm transition hover:bg-[var(--bg-hover)]"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {item.label}
                        </Link>
                      ))}
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="mt-1 flex w-full items-center rounded-xl px-4 py-3 text-sm transition hover:bg-[var(--bg-hover)]"
                        style={{ color: '#f3a0a0' }}
                      >
                        Logout
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setProfileMenuOpen((current) => !current)}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border transition"
                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-panel)' }}
                    aria-label="Open account menu"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold" style={{ background: 'linear-gradient(135deg, #22d3ee, #6366f1)', color: '#06111d', boxShadow: '0 0 28px rgba(34,211,238,0.22)' }}>
                      {initials}
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
            <div className="w-full">{children}</div>
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
                <div className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-semibold" style={{ background: 'linear-gradient(135deg, #22d3ee, #6366f1)', color: '#06111d', boxShadow: '0 0 28px rgba(34,211,238,0.22)' }}>
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

function WalletIcon({ active }: { active: boolean | undefined }) {
  return iconShell(
    active,
    <path d="M3 5.5A1.5 1.5 0 014.5 4h7A1.5 1.5 0 0113 5.5v1h-2.4a2.1 2.1 0 100 4.2H13v.8A1.5 1.5 0 0111.5 13h-7A1.5 1.5 0 013 11.5v-6zM10.6 7.5a1.1 1.1 0 000 2.2H14v-2.2h-3.4z" />
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" className="opacity-85">
        <path d="M8 13.5c.8 0 1.5-.6 1.5-1.4h-3c0 .8.7 1.4 1.5 1.4z" />
        <path d="M3.5 11.5h9l-1.1-1.6V7.4A3.4 3.4 0 008 4a3.4 3.4 0 00-3.4 3.4v2.5L3.5 11.5z" />
        <path d="M6.8 3.2A1.4 1.4 0 018 2.5c.5 0 .9.3 1.2.7" />
      </g>
    </svg>
  );
}

function formatRelativeTime(value: string) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return 'Just now';

  const diffMs = Date.now() - timestamp;
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return '1d ago';
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
