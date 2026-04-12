'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getSession, signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api, setAuthToken } from '@/lib/api';

const showGoogleAuth = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === 'true';
const showGithubAuth = process.env.NEXT_PUBLIC_ENABLE_GITHUB_AUTH === 'true';

type AuthMode = 'signin' | 'register';

type FormErrors = {
  email?: string;
  password?: string;
};

export default function SignInPage() {
  const router = useRouter();
  const { status } = useSession();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'github' | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [router, status]);

  const passwordHint =
    mode === 'register'
      ? 'Use at least 8 characters so your account is secure.'
      : 'Use the password for your ATS Resume Builder account.';

  const modeCopy = useMemo(
    () =>
      mode === 'signin'
        ? {
            eyebrow: 'Return To Orbit',
            title: 'Sign in beneath a darker, sharper night sky.',
            description:
              'Resume history, ATS signals, tailored cover letters, and every application draft are waiting in one workspace.',
            cta: 'Sign In',
          }
        : {
            eyebrow: 'Launch Your Workspace',
            title: 'Create an account and start building better applications fast.',
            description:
              'Save your profile once, tailor each resume to a role, and keep the whole process organized from one dashboard.',
            cta: 'Create Account',
          },
    [mode]
  );

  function validateForm() {
    const nextErrors: FormErrors = {};

    if (!email.trim()) {
      nextErrors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = 'Enter a valid email address.';
    }

    if (!password) {
      nextErrors.password = 'Password is required.';
    } else if (mode === 'register' && password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleEmailSubmit(event: FormEvent) {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      if (mode === 'register') {
        await api.auth.register(email.trim(), password, email.split('@')[0]);
        toast.success('Account created. Signing you in...');
      }

      const result = await signIn('credentials', {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (result?.error) {
        throw new Error(mode === 'signin' ? 'Invalid email or password.' : 'Sign-in failed after registration.');
      }

      const session = await getSession();
      setAuthToken(session?.backendToken ?? null);
      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to continue right now.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: 'google' | 'github') {
    setSocialLoading(provider);
    await signIn(provider, { callbackUrl: '/dashboard' });
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030711] text-white">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#040816_0%,#071120_48%,#02040b_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(56,189,248,0.18),transparent_22%),radial-gradient(circle_at_82%_18%,rgba(168,85,247,0.18),transparent_24%),radial-gradient(circle_at_48%_78%,rgba(16,185,129,0.12),transparent_26%)]" />
      <div className="absolute inset-0 opacity-80 [background-image:radial-gradient(circle_at_8%_18%,rgba(255,255,255,0.9)_0,rgba(255,255,255,0.9)_1px,transparent_1.8px),radial-gradient(circle_at_21%_64%,rgba(255,255,255,0.78)_0,rgba(255,255,255,0.78)_1px,transparent_1.8px),radial-gradient(circle_at_32%_36%,rgba(255,255,255,0.82)_0,rgba(255,255,255,0.82)_1px,transparent_1.8px),radial-gradient(circle_at_44%_16%,rgba(255,255,255,0.72)_0,rgba(255,255,255,0.72)_1px,transparent_1.8px),radial-gradient(circle_at_56%_74%,rgba(255,255,255,0.84)_0,rgba(255,255,255,0.84)_1px,transparent_1.8px),radial-gradient(circle_at_68%_28%,rgba(255,255,255,0.68)_0,rgba(255,255,255,0.68)_1px,transparent_1.8px),radial-gradient(circle_at_78%_58%,rgba(255,255,255,0.88)_0,rgba(255,255,255,0.88)_1px,transparent_1.8px),radial-gradient(circle_at_90%_20%,rgba(255,255,255,0.74)_0,rgba(255,255,255,0.74)_1px,transparent_1.8px)]" />
      <div className="absolute -left-16 top-10 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="absolute right-[-60px] top-20 h-80 w-80 rounded-full bg-violet-500/12 blur-3xl" />
      <div className="absolute bottom-[-80px] left-1/3 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="absolute left-[12%] top-[16%] h-px w-32 rotate-[18deg] bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-70" />
      <div className="absolute right-[20%] top-[26%] h-px w-20 -rotate-[24deg] bg-gradient-to-r from-transparent via-cyan-200/80 to-transparent opacity-80" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col lg:flex-row">
        <section className="flex flex-1 items-center px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
          <div className="w-full max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-cyan-100 shadow-sm backdrop-blur-md">
              ATS Resume Builder
            </div>

            <div className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/75">{modeCopy.eyebrow}</p>
              <h1
                className="max-w-3xl text-4xl leading-tight text-white sm:text-5xl lg:text-6xl"
                style={{ fontFamily: 'Instrument Serif, serif' }}
              >
                {modeCopy.title}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">{modeCopy.description}</p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                { label: 'Signal Tracking', value: 'See ATS score movement and missing keywords in context.' },
                { label: 'Tailored Output', value: 'Generate role-specific resumes and cover letters faster.' },
                { label: 'Saved Momentum', value: 'Return to drafts, exports, and profile data without friction.' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-3xl border border-white/10 bg-white/6 p-4 shadow-[0_22px_60px_rgba(1,4,12,0.42)] backdrop-blur-md"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/55">
                    {item.label}
                  </div>
                  <div className="mt-3 text-sm leading-6 text-slate-200">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex w-full items-center px-5 pb-10 sm:px-8 lg:max-w-[560px] lg:px-10 lg:pb-0">
          <div className="w-full rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,28,0.84),rgba(5,10,20,0.92))] p-5 text-white shadow-[0_30px_90px_rgba(2,6,23,0.56)] backdrop-blur-xl sm:p-8">
            <div className="mb-8 flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/70">Secure access</div>
                <h2 className="mt-2 text-2xl text-white" style={{ fontFamily: 'Instrument Serif, serif' }}>
                  {mode === 'signin' ? 'Welcome back' : 'Create your account'}
                </h2>
              </div>

              <div className="rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrors({});
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    mode === 'signin' ? 'bg-cyan-100 text-slate-950 shadow-sm' : 'text-white/60 hover:text-white'
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrors({});
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    mode === 'register' ? 'bg-cyan-100 text-slate-950 shadow-sm' : 'text-white/60 hover:text-white'
                  }`}
                >
                  Create account
                </button>
              </div>
            </div>

            {(showGoogleAuth || showGithubAuth) && (
              <div className="mb-6 grid gap-3 sm:grid-cols-2">
                {showGoogleAuth && (
                  <button
                    type="button"
                    onClick={() => handleOAuth('google')}
                    disabled={socialLoading !== null}
                    className="flex items-center justify-center gap-3 rounded-2xl border border-white/12 bg-white/92 px-4 py-3 text-sm font-medium text-slate-900 transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <GoogleIcon />
                    {socialLoading === 'google' ? 'Connecting...' : 'Continue with Google'}
                  </button>
                )}

                {showGithubAuth && (
                  <button
                    type="button"
                    onClick={() => handleOAuth('github')}
                    disabled={socialLoading !== null}
                    className="flex items-center justify-center gap-3 rounded-2xl border border-white/12 bg-white/92 px-4 py-3 text-sm font-medium text-slate-900 transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <GitHubIcon />
                    {socialLoading === 'github' ? 'Connecting...' : 'Continue with GitHub'}
                  </button>
                )}
              </div>
            )}

            {(showGoogleAuth || showGithubAuth) && (
              <div className="mb-6 flex items-center gap-4">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[11px] uppercase tracking-[0.28em] text-white/35">or use email</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
            )}

            <form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (errors.email) {
                      setErrors((current) => ({ ...current, email: undefined }));
                    }
                  }}
                  placeholder="you@company.com"
                  className={`w-full rounded-2xl border bg-white/6 px-4 py-3 text-sm text-white placeholder:text-white/28 focus:outline-none focus:ring-2 focus:ring-cyan-400/30 ${
                    errors.email ? 'border-red-400/70' : 'border-white/10 focus:border-cyan-300'
                  }`}
                />
                {errors.email && <p className="mt-2 text-sm text-red-300">{errors.email}</p>}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold uppercase tracking-[0.22em] text-white/55"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="text-xs font-medium text-cyan-200 transition hover:text-white"
                  >
                    {showPassword ? 'Hide password' : 'Show password'}
                  </button>
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (errors.password) {
                      setErrors((current) => ({ ...current, password: undefined }));
                    }
                  }}
                  placeholder={mode === 'signin' ? 'Enter your password' : 'Create a strong password'}
                  className={`w-full rounded-2xl border bg-white/6 px-4 py-3 text-sm text-white placeholder:text-white/28 focus:outline-none focus:ring-2 focus:ring-cyan-400/30 ${
                    errors.password ? 'border-red-400/70' : 'border-white/10 focus:border-cyan-300'
                  }`}
                />
                <p className="mt-2 text-sm text-white/38">{passwordHint}</p>
                {errors.password && <p className="mt-2 text-sm text-red-300">{errors.password}</p>}
              </div>

              <button
                type="submit"
                disabled={loading || socialLoading !== null}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(90deg,#8b5cf6,#22d3ee)] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading && <Spinner />}
                {loading ? (mode === 'signin' ? 'Signing you in...' : 'Creating your account...') : modeCopy.cta}
              </button>
            </form>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/75">What happens next</div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-white/70">
                <li>Build your profile once and reuse it for every application.</li>
                <li>Generate ATS-focused resumes and cover letters for each job.</li>
                <li>Edit, export, and track everything from one dashboard.</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/25 border-t-slate-950" />;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#111" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.749 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}
