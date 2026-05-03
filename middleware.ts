import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Edge middleware: imports authConfig (no DB adapter) so it can run on edge.
// Uses the `authorized` callback in authConfig to gate /admin and /dashboard.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Match everything except: api routes, _next static files, public assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
