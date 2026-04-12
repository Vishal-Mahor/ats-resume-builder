'use client';
// app/(app)/layout.tsx — Authenticated app shell with sidebar
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { setAuthToken } from '@/lib/api';

const NAV = [
  { href: '/dashboard',  label: 'Dashboard',    icon: GridIcon },
  { href: '/new-resume', label: 'New Resume',    icon: PlusIcon },
  { href: '/profile',    label: 'Profile',       icon: UserIcon },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'authenticated') {
      setAuthToken((session as any)?.backendToken ?? null);
      return;
    }

    if (status === 'unauthenticated') {
      setAuthToken(null);
      router.push('/auth/signin');
    }
  }, [router, session, status]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  const user = session?.user;
  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="w-52 min-w-[208px] flex flex-col overflow-hidden" style={{ background: '#0f0f0f' }}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/8">
          <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 17, color: '#fff', lineHeight: 1.2 }}>
            ATS Builder
          </div>
          <div className="text-[10px] text-white/30 uppercase tracking-widest mt-1">AI Resume Suite</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3">
          <p className="px-4 pb-2 text-[10px] text-white/25 uppercase tracking-widest">Workspace</p>
          {NAV.map(item => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-4 py-2.5 text-[13px] transition border-l-2 ${
                  active
                    ? 'text-white bg-white/10 border-emerald-400'
                    : 'text-white/50 hover:text-white hover:bg-white/5 border-transparent'
                }`}
              >
                <Icon />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-white/8 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-white font-medium truncate">{user?.name || 'User'}</p>
            <button onClick={() => {
              setAuthToken(null);
              signOut({ callbackUrl: '/auth/signin' });
            }}
              className="text-[10px] text-white/30 hover:text-white/60 transition">Sign out</button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

function GridIcon() {
  return <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" style={{ opacity: 0.7 }}><path d="M2 2h5v5H2V2zm7 0h5v5H9V2zm-7 7h5v5H2V9zm7 0h5v5H9V9z"/></svg>;
}
function PlusIcon() {
  return <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" style={{ opacity: 0.7 }}><path d="M8 3a.5.5 0 01.5.5V7h3.5a.5.5 0 010 1H8.5v3.5a.5.5 0 01-1 0V8H4a.5.5 0 010-1h3.5V3.5A.5.5 0 018 3z"/></svg>;
}
function UserIcon() {
  return <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" style={{ opacity: 0.7 }}><path d="M8 8a3 3 0 100-6 3 3 0 000 6zm-5 6s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H3z"/></svg>;
}
