// Sentry init for the Edge runtime (middleware.ts, edge route handlers).
// Imported by instrumentation.ts. No-op when SENTRY_DSN is unset.

import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}
