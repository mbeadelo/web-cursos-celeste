import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Static security headers — applied to every response.
 *
 * The dynamic Content-Security-Policy (with per-request nonce) is set in
 * middleware.ts so we can mint a fresh nonce for inline scripts. CSP can't
 * live here for that reason.
 *
 * Verify after deploy with https://securityheaders.com/?q=bienvenidoatuplaza.com
 */
const securityHeaders = [
  // Force HTTPS for two years (preload-eligible). Only takes effect once the
  // site is served over https — Vercel does that automatically.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Block MIME-sniffing — content types are trusted.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak the full URL on cross-origin navigations (only origin).
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable browser features we never use. Add to this list if a feature is
  // ever needed (e.g. `payment=(self)` if we accept Stripe Payment Element
  // embeds — currently we redirect to hosted checkout instead).
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=()",
  },
  // Prevent clickjacking from OTHER origins. CSP frame-ancestors is the modern
  // equivalent (set in middleware), but X-Frame-Options is a defense-in-depth
  // fallback for older browsers and intermediaries that strip CSP.
  // SAMEORIGIN (not DENY) so we can embed our own gated content — e.g. the
  // lesson PDF viewer iframe at /api/lessons/[id]/file. Cross-origin framing
  // (the actual clickjacking vector) is still blocked.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Cross-origin isolation — opt-in, hardens against Spectre-style leaks.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  // Rutas "vanity" de campaña: sirven la home pero la URL del navegador se
  // queda como /ig o /wa, así Vercel Analytics las registra como páginas
  // separadas y podemos medir cuánta gente trae cada canal SIN pagar el
  // add-on de UTMs. Un rewrite (no redirect) es lo que mantiene la URL.
  async rewrites() {
    return [
      { source: "/ig", destination: "/" }, // Instagram
      { source: "/wa", destination: "/" }, // WhatsApp
    ];
  },
};

// Wrap with Sentry: this is what bundles the client SDK (instrumentation-client.ts)
// into the browser build and wires up server instrumentation. WITHOUT this
// wrapper Sentry never loads in the browser, no matter the env vars.
// Source-map upload is skipped unless SENTRY_AUTH_TOKEN is set (just a warning).
export default withSentryConfig(nextConfig, {
  org: "bienvenido-a-tu-plaza",
  project: "javascript-nextjs",
  // Only log source-map upload noise in CI.
  silent: !process.env.CI,
});
