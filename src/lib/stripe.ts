import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

/**
 * Stripe is feature-flagged: env vars are optional in env.ts so the app boots
 * even before Stripe is set up. Code paths that need Stripe must call
 * `isStripeConfigured()` first or import `requireStripe()`.
 *
 * Switch from test → live just by replacing the keys in env. The SDK
 * automatically uses the mode that matches the secret key prefix.
 */
export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
}

let _client: Stripe | null = null;

/**
 * Get the Stripe client. Throws if not configured — callers should gate with
 * `isStripeConfigured()` first to render a graceful UI.
 */
export function requireStripe(): Stripe {
  if (_client) return _client;
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error(
      "Stripe no está configurado. Define STRIPE_SECRET_KEY en .env."
    );
  }
  _client = new Stripe(env.STRIPE_SECRET_KEY, {
    typescript: true,
  });
  return _client;
}
