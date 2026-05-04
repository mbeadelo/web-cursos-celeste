// Sentry init for the browser. Picked up automatically by Next.js.
// No-op when NEXT_PUBLIC_SENTRY_DSN is unset (env var must be NEXT_PUBLIC_*
// to be readable in the browser bundle).

import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    // Replay only on errors (cheap) — full session replay is opt-in later.
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    integrations: [Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false })],
  });
}
