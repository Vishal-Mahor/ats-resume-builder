'use client';

import { useEffect } from 'react';
import { getSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { setAuthToken } from '@/lib/api';

type OAuthSession = {
  accessToken?: string;
  refreshToken?: string;
};

export default function OAuthSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function finalizeOAuth() {
      try {
        const session = (await getSession()) as OAuthSession | null;

        if (!session?.accessToken || !session.refreshToken) {
          throw new Error('OAuth sign-in could not be completed.');
        }

        const finalizeResponse = await fetch('/api/auth/oauth/finalize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        });

        if (!finalizeResponse.ok) {
          throw new Error('Could not finish OAuth sign-in.');
        }

        setAuthToken(session.accessToken);
        await signOut({ redirect: false });

        if (!active) return;
        router.replace('/dashboard');
        router.refresh();
      } catch (error) {
        setAuthToken(null);
        await signOut({ redirect: false });

        if (!active) return;
        toast.error(error instanceof Error ? error.message : 'OAuth sign-in failed.');
        router.replace('/auth/signin');
      }
    }

    void finalizeOAuth();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030711] text-white">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#040816_0%,#071120_48%,#02040b_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(56,189,248,0.18),transparent_22%),radial-gradient(circle_at_82%_18%,rgba(168,85,247,0.18),transparent_24%),radial-gradient(circle_at_48%_78%,rgba(16,185,129,0.12),transparent_26%)]" />
      <div className="relative flex items-center gap-3 rounded-3xl border border-white/10 bg-white/6 px-6 py-4 shadow-[0_22px_60px_rgba(1,4,12,0.42)] backdrop-blur-md">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-cyan-300" />
        <span className="text-sm text-slate-200">Finishing secure sign-in...</span>
      </div>
    </main>
  );
}
