import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

/**
 * Edge proxy (renamed from "middleware" in Next.js 16). Two responsibilities:
 *
 *   1. Auth gating — done MANUALLY here off `req.auth`. NextAuth v5 does NOT
 *      invoke `authConfig.callbacks.authorized` when the middleware is wrapped
 *      with a custom function (as it is here, for the CSP). The callback would
 *      be dead code, so the gating lives inline below instead. See
 *      https://github.com/nextauthjs/next-auth/issues/12976.
 *   2. Content-Security-Policy with a fresh per-request nonce. Next.js
 *      auto-applies the nonce to every script it injects (framework runtime,
 *      page bundles, inline styles) when it sees the
 *      `Content-Security-Policy` header on the request — see
 *      `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`.
 *
 * Static security headers (HSTS, X-Frame-Options, Referrer-Policy, etc.) are
 * set globally in `next.config.ts`.
 *
 * NOTE: the file MUST live at `src/proxy.ts` (or root `proxy.ts` if no `src/`).
 * Moving it elsewhere silently disables the proxy in Next 16.
 */
export default auth((req) => {
  // ── Auth gating (manual — see note above) ───────────────────────
  // `req.auth` is the JWT session injected by the NextAuth wrapper. We mirror
  // the server-side checks in the route layouts so the proxy is a real second
  // layer of defense, not just CSP. A request to a protected route with the
  // wrong (or no) session is redirected before any page code runs.
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isAdmin = req.auth?.user?.role === "ADMIN";

  if (pathname.startsWith("/admin") && !isAdmin) {
    // Not admin: send logged-in users to their dashboard, anonymous to login.
    const dest = isLoggedIn ? "/dashboard" : "/login";
    const url = new URL(dest, req.nextUrl.origin);
    if (dest === "/login") url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/dashboard") && !isLoggedIn) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const nonce = btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))
  );
  const isDev = process.env.NODE_ENV !== "production";
  const csp = buildCsp(nonce, isDev);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next reads this on the request to attach the nonce to its own scripts
  // and inline styles.
  requestHeaders.set("Content-Security-Policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
});

/**
 * CSP directives. Tailored to what this app actually loads:
 *   - script-src: nonce + strict-dynamic so Next's bundles run; 'unsafe-eval'
 *     in dev for React's enhanced error stacks.
 *   - style-src: 'unsafe-inline' because Tailwind injects a runtime <style>
 *     tag without nonces. Tighten if/when we switch to nonce'd styles.
 *   - img-src 'https:' is loose — covers can come from R2, Mux thumbnails,
 *     or external URLs the admin pastes. Tighten when migrated to one host.
 *   - connect-src lists the third parties the browser talks to: Mux Data
 *     (litix), Mux HLS streams, Sentry ingest, Vercel telemetry.
 *   - frame-src allows Stripe's js.stripe.com and Mux's iframe fallback.
 *   - form-action 'self' — every <form> action in the codebase posts to
 *     `/api/...` paths on our origin.
 */
function buildCsp(nonce: string, isDev: boolean): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    isDev ? "'unsafe-eval'" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const directives: Record<string, string> = {
    "default-src": "'self'",
    "script-src": scriptSrc,
    "style-src": "'self' 'unsafe-inline'",
    "img-src": "'self' data: blob: https:",
    "font-src": "'self' data:",
    "connect-src":
      "'self' https://*.mux.com https://*.litix.io " +
      "https://*.ingest.sentry.io https://*.ingest.us.sentry.io " +
      "https://*.ingest.de.sentry.io https://vitals.vercel-insights.com " +
      "wss://*.mux.com",
    "media-src": "'self' blob: https://*.mux.com",
    "frame-src": "'self' https://js.stripe.com https://*.mux.com",
    "worker-src": "'self' blob:",
    "object-src": "'none'",
    "base-uri": "'self'",
    "form-action": "'self'",
    "frame-ancestors": "'none'",
    "upgrade-insecure-requests": "",
  };

  return Object.entries(directives)
    .map(([k, v]) => (v ? `${k} ${v}` : k))
    .join("; ");
}

export const config = {
  // Match everything except: api routes, _next static files, public assets.
  // Skip prefetches and static asset fetches that don't need CSP work.
  matcher: [
    {
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
