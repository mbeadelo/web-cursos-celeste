import type { NextConfig } from "next";

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
  // Prevent clickjacking. CSP frame-ancestors is the modern equivalent
  // (set in middleware), but X-Frame-Options is a defense-in-depth fallback
  // for older browsers and intermediaries that strip CSP.
  { key: "X-Frame-Options", value: "DENY" },
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
};

export default nextConfig;
