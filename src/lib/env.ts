import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),

  // Auth.js
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url().optional(),

  // Resend (email)
  RESEND_API_KEY: z.string().startsWith("re_"),
  EMAIL_FROM: z.string().min(3),

  // Bootstrap admin (used by prisma/seed.ts)
  ADMIN_EMAIL: z.string().email(),

  // Stripe (Fase 3)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  // Mux (Fase 4)
  MUX_TOKEN_ID: z.string().optional(),
  MUX_TOKEN_SECRET: z.string().optional(),
  MUX_WEBHOOK_SECRET: z.string().optional(),
  MUX_SIGNING_KEY_ID: z.string().optional(),
  MUX_SIGNING_PRIVATE_KEY: z.string().optional(),

  // Cloudflare R2 (Fase 4)
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_URL: z.string().url().optional(),

  // Sentry (error tracking). Optional — if unset, Sentry is a no-op.
  SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),

  // Upstash Redis (rate limiting). Optional — if unset, rate limiting is a
  // no-op so dev/test environments work without provisioning Redis.
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", z.treeifyError(parsed.error));
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
