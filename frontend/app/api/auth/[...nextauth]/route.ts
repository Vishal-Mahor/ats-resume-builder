// ============================================================
// NextAuth Configuration — app/api/auth/[...nextauth]/route.ts
// ============================================================
import NextAuth, { AuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';

const API_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:4000';

const providers: AuthOptions['providers'] = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  providers.push(
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    })
  );
}

providers.push(
  CredentialsProvider({
    name: 'Email',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      if (!res.ok) return null;
      const { user, token } = await res.json();
      return { ...user, backendToken: token };
    },
  })
);

const authOptions: AuthOptions = {
  providers,

  callbacks: {
    // After OAuth sign-in, exchange for our backend JWT
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google' || account?.provider === 'github') {
        const res = await fetch(`${API_URL}/api/auth/oauth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider:    account.provider,
            provider_id: account.providerAccountId,
            email:       user.email,
            name:        user.name ?? undefined,
            avatar_url:  user.image ?? undefined,
          }),
        });
        if (!res.ok) return false;
        const { token } = await res.json();
        (user as any).backendToken = token;
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user) token.backendToken = (user as any).backendToken;
      return token;
    },

    async session({ session, token }) {
      (session as any).backendToken = token.backendToken;
      return session;
    },
  },

  pages: {
    signIn: '/auth/signin',
    error:  '/auth/error',
  },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
