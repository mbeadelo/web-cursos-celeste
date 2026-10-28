import "server-only";
import { db } from "@/lib/db";
import { reportOps } from "@/lib/ops";

/**
 * Rate limiting sobre Postgres (tabla `RateLimitBucket`), sin servicios
 * externos.
 *
 * Historia: hasta oct-2026 los contadores vivían en Upstash Redis (plan free).
 * Upstash archiva/borra la base tras ~30 días sin tráfico, y eso pasó TRES
 * veces (jul, sep y oct-2026), dejando el rate limiting en fail-open sin que
 * nadie se enterase. La web ya habla con Neon en cada petición, así que los
 * contadores viven ahí: nadie los archiva y no hay credenciales que caduquen.
 *
 * Algoritmo: ventana fija. La clave es `${prefix}:${id}:${inicioVentana}`;
 * cada petición hace un UPSERT atómico (`count + 1`) y se compara con el tope.
 * Es algo menos fino que la ventana deslizante de Upstash (en el borde de dos
 * ventanas se puede llegar a ~2× el tope en un instante), pero más que
 * suficiente para lo que protege: spam de enlaces mágicos, bucles contra
 * checkout y gasto del chatbot. Las filas caducadas las purga el cron de
 * /api/cron/health.
 *
 * Fail-open: si la DB falla, la petición pasa (un limiter caído no puede
 * bloquear compras) y queda un WARN en /admin/salud.
 */

type Window = `${number} ${"s" | "m" | "h" | "d"}`;

const UNIT_MS = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

export function windowToMs(window: Window): number {
  const [n, unit] = window.split(" ") as [string, keyof typeof UNIT_MS];
  return Number(n) * UNIT_MS[unit];
}

export type LimitResult = {
  success: boolean;
  /** Timestamp (ms) en que se abre la siguiente ventana. */
  reset: number;
  remaining: number;
};

type Limiter = {
  limit: (id: string) => Promise<LimitResult>;
};

/**
 * Incrementa el contador de `key` para la ventana actual y devuelve el valor
 * resultante. Un solo round-trip, atómico (ON CONFLICT en la PK).
 */
export async function bumpBucket(key: string, expiresAt: Date): Promise<number> {
  const rows = await db.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "expiresAt")
    VALUES (${key}, 1, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET "count" = "RateLimitBucket"."count" + 1
    RETURNING "count"
  `;
  return rows[0]?.count ?? 1;
}

function makeLimiter(prefix: string, tokens: number, window: Window): Limiter {
  const windowMs = windowToMs(window);
  return {
    async limit(id: string) {
      const now = Date.now();
      const windowStart = Math.floor(now / windowMs) * windowMs;
      const reset = windowStart + windowMs;
      const key = `${prefix}:${id}:${windowStart}`;
      try {
        const count = await bumpBucket(key, new Date(reset));
        return {
          success: count <= tokens,
          reset,
          remaining: Math.max(0, tokens - count),
        };
      } catch (err) {
        await reportOps({
          level: "WARN",
          area: "rate-limit",
          message: `El limiter "${prefix}" falló (fail-open, petición permitida)`,
          error: err,
        });
        return { success: true, reset, remaining: tokens };
      }
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
