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
  session: {
    strategy: "jwt",
    // Sesión "que no caduca" en la práctica: 1 año, y cada visita con más de
    // 24 h desde la última renovación vuelve a emitir cookie + JWT por otro
    // año. Solo pide enlace nuevo si se pasa un año sin entrar, se borran las
    // cookies o se entra desde otro navegador/dispositivo. (Los navegadores
    // limitan las cookies a 400 días, así que más de un año no aporta nada.)
    maxAge: 365 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  // Providers configured in the full config (auth.ts) where env is validated.
  providers: [],
  callbacks: {
    // Edge-safe: maps the decoded JWT onto the session object. This MUST live
    // here (not only in auth.ts) because the proxy builds `req.auth` from THIS
    // config. Without it, `session.user.role` is undefined in the edge and the
    // proxy's role gating would bounce legitimate admins out of /admin.
    // No DB access here → stays edge-safe. (The DB-aware `jwt` callback that
    // refreshes the role on `update` lives in auth.ts.)
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id;
        session.user.role = token.role ?? "STUDENT";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
