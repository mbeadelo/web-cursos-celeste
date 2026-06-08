import type { NextAuthConfig } from "next-auth";

// Edge-safe Auth.js config: no database adapter, no Node-only deps.
// Imported by the edge proxy (src/proxy.ts) to resolve the JWT session without
// hitting the DB. The full config in auth.ts extends this with the Prisma
// adapter and the jwt/session/signIn callbacks.
//
// NOTE: there is intentionally NO `authorized` callback here. NextAuth v5 does
// not invoke it when the proxy wraps the middleware with a custom function (it
// does, for CSP), so route gating is done manually in src/proxy.ts instead.
// See https://github.com/nextauthjs/next-auth/issues/12976.

export const authConfig = {
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify",
  },
  session: { strategy: "jwt" },
  // Providers configured in the full config (auth.ts) where env is validated.
  providers: [],
} satisfies NextAuthConfig;
