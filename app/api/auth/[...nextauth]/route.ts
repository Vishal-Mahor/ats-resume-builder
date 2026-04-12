// ============================================================
// NextAuth Configuration — app/api/auth/[...nextauth]/route.ts
// ============================================================
import NextAuth, { AuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';
import { loginWithEmail, upsertOAuthUser } from '@/lib/server/auth-service';

export const runtime = 'nodejs';

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
      if (!credentials?.email || !credentials.password) {
        return null;
      }

      try {
        const { user, token } = await loginWithEmail({
          email: credentials.email,
          password: credentials.password,
        });

        return { ...user, backendToken: token };
      } catch {
        return null;
      }
    },
  })
);

const authOptions: AuthOptions = {
  providers,

  callbacks: {
    // After OAuth sign-in, exchange for our backend JWT
    async signIn({ user, account }) {
      if (account?.provider === 'google' || account?.provider === 'github') {
        if (!user.email) {
          return false;
        }

        const result = await upsertOAuthUser({
          provider: account.provider,
          providerId: account.providerAccountId,
          email: user.email,
          name: user.name ?? undefined,
          avatarUrl: user.image ?? undefined,
        });

        user.name = result.user.name;
        user.email = result.user.email;
        user.image = result.user.avatar_url ?? user.image;
        user.backendToken = result.token;
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.backendToken = user.backendToken;
      }

      return token;
    },

    async session({ session, token }) {
      session.backendToken = token.backendToken;
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
