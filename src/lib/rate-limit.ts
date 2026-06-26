import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

/**
 * Rate limiting via Upstash Redis. Optional — if `UPSTASH_REDIS_REST_URL` /
 * `UPSTASH_REDIS_REST_TOKEN` are unset, every check returns `{ success: true }`
 * so dev/test environments work without provisioning Redis. In production
 * those vars MUST be set, otherwise abuse of magic links and checkout is
 * possible.
 *
 * Set up:
 *   1. Create a free Upstash Redis database (https://console.upstash.com).
 *   2. Copy REST URL + REST token to env vars.
 *   3. Add the same vars to Vercel.
 */

let _redis: Redis | null = null;
function redis(): Redis | null {
  if (_redis) return _redis;
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return null;
  _redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
  return _redis;
}

type Limiter = {
  limit: (key: string) => Promise<{ success: boolean; reset: number }>;
};

function makeLimiter(prefix: string, tokens: number, window: string): Limiter {
  const r = redis();
  if (!r) {
    return {
      async limit() {
        return { success: true, reset: 0 };
      },
    };
  }
  const rl = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(tokens, window as `${number} ${"s" | "m" | "h" | "d"}`),
    analytics: false,
    prefix: `rl:${prefix}`,
  });
  return {
    async limit(key: string) {
      const res = await rl.limit(key);
      return { success: res.success, reset: res.reset };
    },
  };
}

// Magic link requests: 5 per 15 min per email AND 10 per 15 min per IP.
// Two separate limiters because each axis defends a different abuse:
//   - per-email: prevents spamming a single inbox
//   - per-ip: prevents enumerating many emails from one host
export const loginEmailLimiter = makeLimiter("login:email", 5, "15 m");
export const loginIpLimiter = makeLimiter("login:ip", 10, "15 m");

// Checkout: 10 per minute per IP. Checkout is an unauthenticated POST that
// hits Stripe, so we cap to avoid running up Stripe API costs from a tight
// loop.
export const checkoutIpLimiter = makeLimiter("checkout:ip", 10, "1 m");

// Chatbot: 15 messages/min and 120/hour per IP. The chat endpoint is an
// unauthenticated POST that spends Anthropic tokens, so we cap per-IP to keep a
// tight loop from running up the bill. The hard ceiling is the spending cap in
// the Anthropic console.
export const chatIpLimiter = makeLimiter("chat:ip", 15, "1 m");
export const chatIpHourLimiter = makeLimiter("chat:ip:h", 120, "1 h");

// Chatbot GLOBAL daily ceiling: a soft cap across ALL callers, keyed on a
// constant (not the IP). The per-IP limiters above are spoofable via
// x-forwarded-for, so a distributed or header-rotating attack could slip past
// them; this bounds the TOTAL number of model calls per day regardless of who
// makes them. When tripped, the route degrades to a friendly "resting" reply
// instead of spending tokens. It sits *below* the hard spend cap in the
// Anthropic workspace — a runaway-abuse backstop, not the expected volume.
// Tune the number to your monthly budget (legit traffic is far lower).
export const chatGlobalDayLimiter = makeLimiter("chat:global:d", 1000, "1 d");

/**
 * Best-effort client IP from common proxy headers. Never trust this for
 * security decisions other than rate limiting (it's spoofable on a misconfig).
 */
export function getClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? "unknown";
}
