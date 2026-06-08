import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { authConfig } from "@/lib/auth.config";

// Closed registration: a User row must exist before any sign-in flow can
// create a session for that email. Sign-up happens out-of-band via:
//   - Stripe webhook (post-purchase) — creates User + Enrollment
//   - Admin manual enrollment             — creates User + Enrollment
// We wrap PrismaAdapter to block automatic user creation that Auth.js would
// otherwise do on first magic-link verification. The bootstrap admin email is
// allowed as a recovery path in case the DB is wiped.
const baseAdapter = PrismaAdapter(db);

const lockedAdapter: Adapter = {
  ...baseAdapter,
  async createUser(user: AdapterUser) {
    const email = user.email?.toLowerCase() ?? "";
    if (email !== env.ADMIN_EMAIL.toLowerCase()) {
      throw new Error(
        `Registration is closed. Email ${email} must be pre-provisioned.`
      );
    }
    return baseAdapter.createUser!(user);
  },
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: lockedAdapter,
  providers: [
    Resend({
      apiKey: env.RESEND_API_KEY,
      from: env.EMAIL_FROM,
    }),
  ],
  callbacks: {
    // Inherit the edge-safe `session` callback from authConfig so role mapping
    // is defined in exactly one place (and the proxy and full config agree).
    ...authConfig.callbacks,
    async signIn({ user }) {
      // Defense in depth: even if the API is hit directly (bypassing our
      // /login server action), reject unknown emails before sending the
      // magic link or creating a session.
      const email = user?.email?.toLowerCase();
      if (!email) return false;
      if (email === env.ADMIN_EMAIL.toLowerCase()) return true;
      const existing = await db.user.findUnique({
        where: { email },
        select: { id: true },
      });
      return Boolean(existing);
    },
    async jwt({ token, user, trigger }) {
      // First sign-in: persist DB user fields into the JWT.
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      // On explicit refresh (e.g. after role change), reload from DB.
      if (trigger === "update" && token.id) {
        const fresh = await db.user.findUnique({
          where: { id: token.id },
          select: { role: true },
        });
        if (fresh) token.role = fresh.role;
      }
      return token;
    },
    // `session` callback is inherited from authConfig (see spread above).
  },
});
