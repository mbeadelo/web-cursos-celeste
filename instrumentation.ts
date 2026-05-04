// Next.js instrumentation hook. Called once at runtime startup, before any
// page or API route runs. We use it to bootstrap Sentry on the server and
// edge runtimes. Client runtime is handled by sentry.client.config.ts.
//
// If SENTRY_DSN is unset (dev, preview without Sentry), the imports silently
// no-op — see sentry.server.config / sentry.edge.config.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
