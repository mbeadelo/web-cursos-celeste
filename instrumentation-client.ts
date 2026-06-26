// Sentry init for the BROWSER.
//
// In Next.js 15+/Sentry SDK v10 the client config MUST live here, in
// `instrumentation-client.ts` — the old `sentry.client.config.ts` convention is
// no longer picked up. It only gets bundled into the client when
// `next.config.ts` is wrapped with `withSentryConfig` (see there).
//
// No-op when NEXT_PUBLIC_SENTRY_DSN is unset (dev, preview without Sentry). The
// var must be NEXT_PUBLIC_* to be readable in the browser bundle, and is inlined
// at build time — changing it requires a fresh build, not a cached redeploy.

import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    // Replay only on errors (cheap) — full session replay is opt-in later.
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    integrations: [
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
  });
}

// Instrument App Router client-side navigations (Sentry v8+/Next 15+).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
