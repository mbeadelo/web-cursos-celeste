import "server-only";
import { Redis } from "@upstash/redis";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { isStripeConfigured, requireStripe } from "@/lib/stripe";
import {
  isMuxConfigured,
  isMuxSigningConfigured,
  requireMux,
} from "@/lib/mux";
import { isStorageConfigured, pingStorage } from "@/lib/storage";
import { shortErrorMessage } from "@/lib/ops";

/**
 * Chequeos activos de salud: van a cada proveedor y comprueban que la
 * configuración REAL (no solo la variable de entorno) sirve para vender.
 * Los ejecuta /admin/salud al cargar y el cron diario /api/cron/health.
 *
 * Cada chequeo devuelve ok / warn / fail / skip y nunca lanza: un proveedor
 * caído se refleja como `fail` con el error, sin tumbar el resto.
 */
export type CheckStatus = "ok" | "warn" | "fail" | "skip";

export type HealthCheck = {
  id: string;
  name: string;
  status: CheckStatus;
  summary: string;
  detail?: string;
  ms: number;
};

export type HealthReport = {
  ranAt: Date;
  checks: HealthCheck[];
  failing: number;
  warning: number;
};

const SITE_URL =
  env.AUTH_URL?.replace(/\/$/, "") ?? "https://bienvenidoatuplaza.com";

/** Eventos que el endpoint de Stripe debe tener suscritos (ver webhook). */
const REQUIRED_STRIPE_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "charge.refunded",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];

type CheckBody = Omit<HealthCheck, "id" | "name" | "ms">;

async function run(
  id: string,
  name: string,
  fn: () => Promise<CheckBody>,
  timeoutMs = 8000
): Promise<HealthCheck> {
  const t0 = Date.now();
  try {
    const body = await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`sin respuesta en ${timeoutMs} ms`)),
          timeoutMs
        )
      ),
    ]);
    return { id, name, ms: Date.now() - t0, ...body };
  } catch (err) {
    return {
      id,
      name,
      ms: Date.now() - t0,
      status: "fail",
      summary: "Error al comprobar",
      detail: shortErrorMessage(err),
    };
  }
}

export async function runHealthChecks(): Promise<HealthReport> {
  const ranAt = new Date();
  const checks = await Promise.all([
    run("db", "Base de datos (Neon)", checkDatabase),
    run("stripe-key", "Stripe: clave y modo", checkStripeKey),
    run("stripe-webhook", "Stripe: endpoint de webhook", checkStripeWebhookEndpoint),
    run("stripe-tax", "Stripe Tax", checkStripeTax),
    run("reach-stripe", "Webhook Stripe alcanzable (www)", () =>
      checkWebhookReachable("/api/webhooks/stripe")
    ),
    run("reach-mux", "Webhook Mux alcanzable (www)", () =>
      checkWebhookReachable("/api/webhooks/mux")
    ),
    run("mux", "Mux: API y signing", checkMux),
    run("mux-pending", "Mux: vídeos atascados", checkMuxPending),
    run("r2", "Cloudflare R2", checkStorage),
    run("resend", "Resend: dominio de envío", checkResend),
    run("upstash", "Upstash: rate limiting", checkUpstash),
    run("cron", "Cron de Vercel", checkCronSecret),
  ]);
  return {
    ranAt,
    checks,
    failing: checks.filter((c) => c.status === "fail").length,
    warning: checks.filter((c) => c.status === "warn").length,
  };
}

// ─── Chequeos ────────────────────────────────────────────────────────────

async function checkDatabase(): Promise<CheckBody> {
  await db.$queryRaw`SELECT 1`;
  return { status: "ok", summary: "Responde" };
}

async function checkStripeKey(): Promise<CheckBody> {
  if (!isStripeConfigured()) {
    return {
      status: "fail",
      summary: "Sin STRIPE_SECRET_KEY o STRIPE_WEBHOOK_SECRET: no se puede vender",
    };
  }
  const stripe = requireStripe();
  await stripe.balance.retrieve();
  const live = env.STRIPE_SECRET_KEY!.startsWith("sk_live_");
  if (!live && env.NODE_ENV === "production") {
    return {
      status: "warn",
      summary: "Clave de TEST en producción: los pagos no son reales",
    };
  }
  return { status: "ok", summary: live ? "Clave válida, modo LIVE" : "Clave válida, modo test" };
}

async function checkStripeWebhookEndpoint(): Promise<CheckBody> {
  if (!isStripeConfigured()) return { status: "skip", summary: "Stripe sin configurar" };
  const stripe = requireStripe();
  const expected = `${SITE_URL}/api/webhooks/stripe`;
  const { data } = await stripe.webhookEndpoints.list({ limit: 100 });

  const exact = data.find((e) => e.url === expected);
  if (!exact) {
    const apex = data.find(
      (e) =>
        e.url.includes("bienvenidoatuplaza.com/api/webhooks/stripe") &&
        !e.url.includes("://www.")
    );
    if (apex) {
      return {
        status: "fail",
        summary: "El endpoint apunta al apex (sin www): el 308 rompe la entrega",
        detail: `Configurado: ${apex.url}\nEsperado: ${expected}\nEditar el endpoint existente, no crear otro.`,
      };
    }
    return {
      status: "fail",
      summary: "No hay ningún endpoint con la URL esperada",
      detail: `Esperado: ${expected}\nExistentes: ${data.map((e) => e.url).join(", ") || "ninguno"}`,
    };
  }
  if (exact.status !== "enabled") {
    return {
      status: "fail",
      summary: `Endpoint existe pero está "${exact.status}"`,
      detail: expected,
    };
  }
  const events = exact.enabled_events;
  const missing = events.includes("*")
    ? []
    : REQUIRED_STRIPE_EVENTS.filter((ev) => !events.includes(ev));
  if (missing.length > 0) {
    return {
      status: "warn",
      summary: `Faltan ${missing.length} eventos suscritos`,
      detail: `Añadir al endpoint existente: ${missing.join(", ")}`,
    };
  }
  return { status: "ok", summary: "URL www, activo y con todos los eventos" };
}

async function checkStripeTax(): Promise<CheckBody> {
  if (!isStripeConfigured()) return { status: "skip", summary: "Stripe sin configurar" };
  const stripe = requireStripe();
  try {
    const settings = await stripe.tax.settings.retrieve();
    if (settings.status === "active") {
      return { status: "ok", summary: "Activo (el checkout usa automatic_tax)" };
    }
    return {
      status: "fail",
      summary: `Stripe Tax en estado "${settings.status}": el checkout con automatic_tax fallará`,
      detail:
        "Stripe → Settings → Tax: completar dirección de origen y registros fiscales.",
    };
  } catch (err) {
    return {
      status: "warn",
      summary: "No se pudo leer la configuración de Tax",
      detail: shortErrorMessage(err),
    };
  }
}

/**
 * Reproduce el gotcha de los webhooks: un POST sin firma debe devolver 400
 * (la app contesta y solo falta la firma). Un 3xx significa que la URL
 * redirige (apex → www) y ni Stripe ni Mux siguen redirects; un 503, que
 * falta el secret en el entorno.
 */
async function checkWebhookReachable(path: string): Promise<CheckBody> {
  if (!SITE_URL.startsWith("https://")) {
    return { status: "skip", summary: "Solo en producción (AUTH_URL https)" };
  }
  const url = `${SITE_URL}${path}`;
  const res = await fetch(url, {
    method: "POST",
    body: "{}",
    headers: { "content-type": "application/json" },
    redirect: "manual",
    cache: "no-store",
  });
  if (res.status === 400) return { status: "ok", summary: `${url} → 400 (correcto)` };
  if (res.status >= 300 && res.status < 400) {
    return {
      status: "fail",
      summary: `${url} redirige (${res.status}): los webhooks no llegan`,
      detail: `Location: ${res.headers.get("location") ?? "?"}`,
    };
  }
  if (res.status === 503) {
    return {
      status: "fail",
      summary: `${url} → 503: falta el secret del webhook en Vercel`,
    };
  }
  return { status: "warn", summary: `${url} → ${res.status} (esperaba 400)` };
}

async function checkMux(): Promise<CheckBody> {
  if (!isMuxConfigured()) {
    return { status: "warn", summary: "Mux sin configurar: no hay vídeo" };
  }
  const mux = requireMux();
  await mux.video.assets.list({ limit: 1 });
  if (!isMuxSigningConfigured()) {
    return {
      status: "warn",
      summary: "API OK, pero sin signing keys: los vídeos nuevos saldrán públicos",
    };
  }
  if (!env.MUX_WEBHOOK_SECRET) {
    return {
      status: "warn",
      summary: "API OK, pero sin MUX_WEBHOOK_SECRET: el webhook responde 503",
    };
  }
  return { status: "ok", summary: "API, signing y webhook secret configurados" };
}

async function checkMuxPending(): Promise<CheckBody> {
  const stale = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const pending = await db.lesson.findMany({
    where: {
      type: "VIDEO",
      muxUploadId: { not: null },
      muxPlaybackId: null,
      updatedAt: { lt: stale },
    },
    select: { id: true, title: true, course: { select: { slug: true } } },
    take: 10,
  });
  if (pending.length === 0) {
    return { status: "ok", summary: "Ningún vídeo pendiente de más de 2 h" };
  }
  return {
    status: "warn",
    summary: `${pending.length} lección(es) con upload pero sin playback desde hace >2 h`,
    detail: pending.map((l) => `${l.course.slug} · ${l.title}`).join("\n"),
  };
}

async function checkStorage(): Promise<CheckBody> {
  if (!isStorageConfigured()) {
    return { status: "warn", summary: "R2 sin configurar: portadas y PDFs no funcionan" };
  }
  await pingStorage();
  return { status: "ok", summary: "Bucket accesible" };
}

async function checkResend(): Promise<CheckBody> {
  const resend = new Resend(env.RESEND_API_KEY);
  const res = await resend.domains.list();
  if (res.error) {
    return {
      status: "fail",
      summary: "La API de Resend rechaza la clave",
      detail: res.error.message,
    };
  }
  const fromDomain = env.EMAIL_FROM.match(/@([^>\s]+)/)?.[1]?.toLowerCase();
  const domains = (res.data?.data ?? []) as Array<{ name: string; status: string }>;
  if (!fromDomain) {
    return { status: "warn", summary: `EMAIL_FROM sin dominio reconocible: ${env.EMAIL_FROM}` };
  }
  const match = domains.find((d) => d.name.toLowerCase() === fromDomain);
  if (!match) {
    return {
      status: "warn",
      summary: `El dominio de EMAIL_FROM (${fromDomain}) no está en Resend`,
      detail: `Dominios en la cuenta: ${domains.map((d) => d.name).join(", ") || "ninguno"}`,
    };
  }
  if (match.status !== "verified") {
    return {
      status: "fail",
      summary: `Dominio ${fromDomain} en estado "${match.status}": los emails no salen`,
    };
  }
  return { status: "ok", summary: `Clave válida, ${fromDomain} verificado` };
}

async function checkUpstash(): Promise<CheckBody> {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return {
      status: "warn",
      summary: "Sin Upstash: login, checkout y chat van sin rate limiting",
    };
  }
  const redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
  const pong = await redis.ping();
  if (pong !== "PONG") {
    return { status: "fail", summary: `Redis responde "${pong}" en vez de PONG` };
  }
  return { status: "ok", summary: "Redis responde (la base no está archivada)" };
}

async function checkCronSecret(): Promise<CheckBody> {
  if (!env.CRON_SECRET) {
    return {
      status: "warn",
      summary: "Sin CRON_SECRET: los crons (Mux, salud) responden 503",
    };
  }
  return { status: "ok", summary: "CRON_SECRET definido" };
}
