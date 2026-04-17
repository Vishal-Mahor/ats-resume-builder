import Link from 'next/link';

type ErrorPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

const MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked: 'That email is already connected to a different sign-in method.',
  AccessDenied: 'Access was denied by the authentication provider.',
  Configuration: 'Authentication is not fully configured yet.',
  Default: 'Sign-in could not be completed. Please try again.',
};

export default async function AuthErrorPage({ searchParams }: ErrorPageProps) {
  const params = await searchParams;
  const code = params?.error || 'Default';
  const message = MESSAGES[code] || MESSAGES.Default;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050b14] p-6 text-white">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(83,129,169,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(83,129,169,0.07)_1px,transparent_1px),linear-gradient(180deg,#060d16_0%,#091524_48%,#050b14_100%)] [background-size:36px_36px,36px_36px,auto]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(34,211,238,0.16),transparent_22%),radial-gradient(circle_at_82%_18%,rgba(99,102,241,0.16),transparent_24%)]" />
      <div className="relative w-full max-w-md rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,28,0.84),rgba(5,10,20,0.92))] p-8 shadow-[0_30px_90px_rgba(2,6,23,0.56)] backdrop-blur-xl">
        <div className="mb-4 inline-flex rounded-[10px] border border-rose-300/20 bg-rose-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-rose-100">
          Auth error
        </div>
        <h1 className="mb-2 text-xl text-white" style={{ fontFamily: 'Instrument Serif, serif' }}>
          Sign-in Error
        </h1>
        <p className="mb-6 text-sm leading-6 text-slate-300">{message}</p>
        <Link
          href="/auth/signin"
          className="inline-flex rounded-xl bg-[linear-gradient(90deg,#22d3ee,#6366f1)] px-4 py-2.5 text-sm font-medium text-[#06111d] transition hover:brightness-110"
        >
          Back to Sign In
        </Link>
      </div>
    </main>
  );
}
