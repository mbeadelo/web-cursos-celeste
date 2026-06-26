// Next.js instrumentation hook. Called once at runtime startup, before any
// page or API route runs. We use it to bootstrap Sentry on the server and
// edge runtimes. Client runtime is handled by instrumentation-client.ts.
//
// If SENTRY_DSN is unset (dev, preview without Sentry), the imports silently
// no-op — see sentry.server.config / sentry.edge.config.

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Capture errors thrown in Server Components, route handlers, the proxy and
// other server code (Next 15+/Sentry v8.28+). Without this, server-side errors
// don't reach Sentry.
export const onRequestError = Sentry.captureRequestError;
