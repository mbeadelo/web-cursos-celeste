// Sentry init for the Node.js runtime (API routes, server components).
// Imported by instrumentation.ts. No-op when SENTRY_DSN is unset.

import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    // Skip noisy ECONNRESET/aborts that don't indicate real problems.
    ignoreErrors: ["ECONNRESET", "AbortError"],
  });
}
