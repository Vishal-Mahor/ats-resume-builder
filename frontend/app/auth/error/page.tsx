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
    <main
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(135deg, #0f1a14 0%, #1a2820 60%, #0f1a14 100%)' }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <h1 className="mb-2 text-xl text-gray-900" style={{ fontFamily: 'Instrument Serif, serif' }}>
          Sign-in Error
        </h1>
        <p className="mb-6 text-sm text-gray-500">{message}</p>
        <a
          href="/auth/signin"
          className="inline-flex rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-600"
        >
          Back to Sign In
        </a>
      </div>
    </main>
  );
}
