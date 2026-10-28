import "server-only";
import crypto from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { sendOpsAlertEmail } from "@/lib/email";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Monitorización PROPIA de la app (sin depender de Sentry ni de Vercel).
 *
 * `reportOps()` es el único punto de entrada: registra una incidencia en la
 * tabla `OpsEvent`, la agrupa con las repeticiones recientes (misma `area` +
 * `message` dentro de 24 h → `count++`) y, si es de nivel ERROR, avisa por
 * email al admin (como mucho una vez cada 6 h por incidencia). Todo se ve y
 * se cierra desde /admin/salud.
 *
 * Reglas:
 *  - NUNCA lanza. Un fallo del propio sistema de alertas no puede romper el
 *    flujo que lo llama (checkout, webhooks…). Como último recurso, consola.
 *  - Sentry sigue recibiendo los ERROR como sumidero secundario (si está
 *    configurado). No es necesario para que esto funcione.
 *  - `message` debe ser estable (sin ids ni timestamps) para que la
 *    agrupación funcione; lo variable va en `detail`.
 */
export type OpsLevel = "INFO" | "WARN" | "ERROR";

export type OpsArea =
  | "checkout"
  | "stripe-webhook"
  | "stripe-provision"
  | "mux-webhook"
  | "email"
  | "rate-limit"
  | "cron"
  | "health"
  | "server";

export type OpsReport = {
  level: OpsLevel;
  area: OpsArea;
  message: string;
  detail?: Record<string, unknown>;
  /** Excepción original; se serializa (nombre, mensaje, código Stripe, stack). */
  error?: unknown;
  /** `false` para registrar sin email aunque sea ERROR. */
  notify?: boolean;
};

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;
const NOTIFY_THROTTLE_MS = 6 * 60 * 60 * 1000;

export function opsFingerprint(area: string, message: string): string {
  return crypto
    .createHash("sha1")
    .update(`${area}|${message}`)
    .digest("hex")
    .slice(0, 16);
}

/** Resumen serializable de una excepción (incluye campos de StripeError). */
export function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    const e = err as Error & {
      type?: string;
      code?: string;
      statusCode?: number;
      param?: string;
      requestId?: string;
    };
    return {
      name: e.name,
      message: e.message,
      ...(e.type ? { type: e.type } : {}),
      ...(e.code ? { code: e.code } : {}),
      ...(e.statusCode ? { statusCode: e.statusCode } : {}),
      ...(e.param ? { param: e.param } : {}),
      ...(e.requestId ? { requestId: e.requestId } : {}),
      stack: e.stack?.split("\n").slice(0, 6).join("\n"),
    };
  }
  if (typeof err === "object" && err !== null) {
    try {
      return { value: JSON.parse(JSON.stringify(err)) };
    } catch {
      return { value: String(err) };
    }
  }
  return { value: String(err) };
}

/** Mensaje corto de una excepción, para columnas de texto (CheckoutAttempt.error). */
export function shortErrorMessage(err: unknown, max = 300): string {
  const s = serializeError(err);
  const code = typeof s.code === "string" ? `[${s.code}] ` : "";
  const msg =
    typeof s.message === "string" ? s.message : String(s.value ?? "error");
  return `${code}${msg}`.slice(0, max);
}

export async function reportOps(input: OpsReport): Promise<void> {
  const { level, area, message } = input;
  const detail: Record<string, unknown> = {
    ...(input.detail ?? {}),
    ...(input.error !== undefined ? { error: serializeError(input.error) } : {}),
  };

  const log =
    level === "ERROR"
      ? console.error
      : level === "WARN"
        ? console.warn
        : console.log;
  log(
    `[ops:${area}] ${message}`,
    Object.keys(detail).length ? JSON.stringify(detail) : ""
  );

  // Sumidero secundario. Best-effort y fuera del camino crítico.
  if (level === "ERROR") {
    try {
      if (input.error instanceof Error) {
        Sentry.captureException(input.error, { tags: { area }, extra: detail });
      } else {
        Sentry.captureMessage(`[${area}] ${message}`, {
          level: "error",
          extra: detail,
        });
      }
    } catch {
      // Sentry no configurado o fallo del SDK: irrelevante.
    }
  }

  try {
    const now = new Date();
    const fingerprint = opsFingerprint(area, message);
    const jsonDetail = detail as Prisma.InputJsonValue;

    const existing = await db.opsEvent.findFirst({
      where: {
        fingerprint,
        resolvedAt: null,
        lastSeenAt: { gte: new Date(now.getTime() - DEDUPE_WINDOW_MS) },
      },
      orderBy: { lastSeenAt: "desc" },
      select: { id: true, notifiedAt: true },
    });

    const event = existing
      ? await db.opsEvent.update({
          where: { id: existing.id },
          data: {
            count: { increment: 1 },
            lastSeenAt: now,
            detail: jsonDetail,
            level,
          },
          select: { id: true, count: true, notifiedAt: true },
        })
      : await db.opsEvent.create({
          data: { level, area, message, fingerprint, detail: jsonDetail },
          select: { id: true, count: true, notifiedAt: true },
        });

    const shouldNotify =
      level === "ERROR" &&
      input.notify !== false &&
      (!event.notifiedAt ||
        event.notifiedAt.getTime() < now.getTime() - NOTIFY_THROTTLE_MS);

    if (shouldNotify) {
      await sendOpsAlertEmail({
        area,
        message,
        detail,
        count: event.count,
        eventId: event.id,
      });
      await db.opsEvent.update({
        where: { id: event.id },
        data: { notifiedAt: now },
      });
    }
  } catch (err) {
    // Último recurso: que al menos quede en los logs de Vercel.
    console.error("[ops] no se pudo registrar/notificar la incidencia:", err);
    // Si la DB está caída el email aún puede salir (no depende de la DB).
    if (level === "ERROR" && input.notify !== false) {
      await sendOpsAlertEmail({
        area,
        message,
        detail: { ...detail, opsPersistError: serializeError(err) },
        count: 1,
        eventId: null,
      }).catch((e) =>
        console.error("[ops] tampoco se pudo enviar el email:", e)
      );
    }
  }
}
