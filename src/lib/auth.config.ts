import type { NextAuthConfig } from "next-auth";

// Edge-safe Auth.js config: no database adapter, no Node-only deps.
// Imported by middleware.ts to gate routes without hitting the DB.
// The full config in auth.ts extends this with the Prisma adapter.

export const authConfig = {
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify",
  },
  session: { strategy: "jwt" },
  // Providers configured in the full config (auth.ts) where env is validated.
  // Middleware doesn't need providers — only authorized() and pages.
  providers: [],
  callbacks: {
    authorized({ request, auth }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth;
      const isAdmin = auth?.user?.role === "ADMIN";

      if (pathname.startsWith("/admin")) return isAdmin;
      if (pathname.startsWith("/dashboard")) return isLoggedIn;
      return true;
    },
  },
} satisfies NextAuthConfig;
