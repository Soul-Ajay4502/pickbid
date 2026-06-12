import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { UserModel } from '@/lib/models';

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    // ── 1. Upsert user in DB on every Google sign-in ───────────────────────
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google') return true;

      const googleId = profile?.sub ?? account.providerAccountId;
      const email    = user.email;
      if (!googleId || !email) return true;

      try {
        const [row, created] = await UserModel.findOrCreate({
          where:    { email },
          defaults: { id: googleId, email, name: user.name ?? '', photo: user.image ?? '' },
        });

        if (!created) {
          const updates: Record<string, unknown> = { updatedAt: new Date() };
          if (!row.profileCompleted) {
            updates.name  = user.name  ?? row.name;
            updates.photo = user.image ?? row.photo;
          }
          await row.update(updates);
        }
      } catch (err) {
        console.error('Failed to sync user to DB:', err);
      }

      return true;
    },

    // ── 2. Set token.sub = the actual DB row.id ────────────────────────────
    // signIn runs first (creates/finds the row), then jwt runs.
    // We look up the DB user by email so token.sub always matches the stored id,
    // regardless of what NextAuth or the provider put in account/profile.
    async jwt({ token, account, user }) {
      if (account?.provider === 'google' && user?.email) {
        try {
          const dbUser = await UserModel.findOne({ where: { email: user.email } });
          if (dbUser) token.sub = dbUser.id;
        } catch (err) {
          console.error('JWT user lookup failed:', err);
        }
      }
      return token;
    },

    // ── 3. Expose session.user.id = token.sub (= DB row.id) ───────────────
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
