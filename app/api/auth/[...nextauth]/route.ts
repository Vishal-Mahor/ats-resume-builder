// ============================================================
// NextAuth Configuration — app/api/auth/[...nextauth]/route.ts
// ============================================================
import NextAuth, { AuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import { upsertOAuthUser } from '@/lib/server/auth-service';

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
        user.accessToken = result.accessToken;
        user.refreshToken = result.refreshToken;
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
      }

      return token;
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      session.refreshToken = token.refreshToken as string | undefined;
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
