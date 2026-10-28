import type { Metadata } from "next";
import { db } from "@/lib/db";
import { runHealthChecks, type CheckStatus } from "@/lib/health";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ResolveButton,
  ResolveAllButton,
  TestAlertButton,
  RefreshButton,
} from "./_actions-ui";

export const metadata: Metadata = { title: "Salud" };
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const dateTime = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Madrid",
});

const statusStyle: Record<CheckStatus, { dot: string; label: string }> = {
  ok: { dot: "bg-emerald-500", label: "OK" },
  warn: { dot: "bg-amber-500", label: "Aviso" },
  fail: { dot: "bg-red-600", label: "Fallo" },
  skip: { dot: "bg-neutral-300", label: "N/A" },
};

const levelStyle = {
  ERROR: "bg-red-100 text-red-800",
  WARN: "bg-amber-100 text-amber-800",
  INFO: "bg-neutral-100 text-neutral-700",
} as const;

/**
 * /admin/salud — panel del sistema propio de monitorización.
 *
 * 1. Chequeos activos contra cada proveedor (src/lib/health.ts), ejecutados
 *    en cada carga de esta página.
 * 2. Funnel de pagos de los últimos 30 días (CheckoutAttempt vs Order).
 * 3. Incidencias abiertas (OpsEvent) con su detalle, para cerrarlas a mano.
 */
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export default async function AdminHealthPage() {
  const monthAgo = daysAgo(30);

  const [report, openEvents, resolvedEvents, attempts] = await Promise.all([
    runHealthChecks(),
    db.opsEvent.findMany({
      where: { resolvedAt: null },
      orderBy: [{ level: "asc" }, { lastSeenAt: "desc" }],
      take: 100,
    }),
    db.opsEvent.findMany({
      where: { resolvedAt: { not: null } },
      orderBy: { resolvedAt: "desc" },
      take: 20,
    }),
    db.checkoutAttempt.findMany({
      where: { createdAt: { gte: monthAgo } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { course: { select: { slug: true, title: true } } },
    }),
  ]);

  const openErrors = openEvents.filter((e) => e.level === "ERROR");
  const openWarns = openEvents.filter((e) => e.level !== "ERROR");

  const funnel = {
    total: attempts.length,
    completed: attempts.filter((a) => a.completedAt).length,
    failed: attempts.filter((a) => a.status === "FAILED").length,
  };
  const abandoned = funnel.total - funnel.completed - funnel.failed;

  const ordered = [...report.checks].sort(
    (a, b) => rank(a.status) - rank(b.status)
  );

  return (
    <main className="px-6 py-12">
      <div className="max-w-5xl mx-auto space-y-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Salud de la web</h1>
            <p className="text-sm text-neutral-600 mt-1">
              Comprobaciones reales contra Stripe, Mux, R2, Resend, Upstash y
              la base de datos, más las incidencias que la propia app detecta.
              Comprobado a las {dateTime.format(report.ranAt)}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TestAlertButton />
            <RefreshButton />
          </div>
        </header>

        {/* ── Estado global ───────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Proveedores y configuración</h2>
            <span
              className={`text-xs font-semibold rounded-full px-3 py-1 ${
                report.failing > 0
                  ? "bg-red-100 text-red-800"
                  : report.warning > 0
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {report.failing > 0
                ? `${report.failing} fallo(s)`
                : report.warning > 0
                  ? `${report.warning} aviso(s)`
                  : "Todo OK"}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ordered.map((c) => {
              const st = statusStyle[c.status];
              return (
                <div
                  key={c.id}
                  className={`rounded-lg border bg-white p-4 ${
                    c.status === "fail"
                      ? "border-red-300"
                      : c.status === "warn"
                        ? "border-amber-300"
                        : "border-neutral-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        aria-hidden
                        className={`inline-block size-2.5 rounded-full shrink-0 ${st.dot}`}
                      />
                      <p className="text-sm font-semibold truncate">{c.name}</p>
                    </div>
                    <span className="text-[11px] text-neutral-400 shrink-0">
                      {st.label} · {c.ms} ms
                    </span>
                  </div>
                  <p className="text-sm text-neutral-700 mt-1 break-words">
                    {c.summary}
                  </p>
                  {c.detail && (
                    <pre className="mt-2 text-[11px] text-neutral-600 bg-neutral-50 rounded p-2 whitespace-pre-wrap break-words">
                      {c.detail}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Funnel de pagos ─────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Pagos (últimos 30 días)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Pulsaron Comprar" value={funnel.total} />
            <Stat label="Completados" value={funnel.completed} tone="good" />
            <Stat
              label="Fallaron al iniciar"
              value={funnel.failed}
              tone={funnel.failed > 0 ? "bad" : undefined}
            />
            <Stat label="Sin terminar en Stripe" value={abandoned} />
          </div>
          <p className="text-xs text-neutral-500">
            «Fallaron al iniciar» = la app no pudo crear la sesión de Stripe
            (eso es un bug nuestro o de configuración, y genera incidencia).
            «Sin terminar» = llegaron a la página de Stripe y no pagaron:
            abandono, tarjeta rechazada o pago aún en curso.
          </p>
          {attempts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-600">
              Ningún intento de pago registrado todavía.
            </div>
          ) : (
            <div className="rounded-lg border border-neutral-200 bg-white overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cuándo</TableHead>
                    <TableHead>Curso</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {dateTime.format(a.createdAt)}
                      </TableCell>
                      <TableCell className="text-xs">{a.course.title}</TableCell>
                      <TableCell className="text-xs">
                        {a.email ?? <span className="text-neutral-400">—</span>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {a.status === "FAILED" ? (
                          <span className="text-red-700">
                            Falló: {a.error ?? "sin detalle"}
                          </span>
                        ) : a.completedAt ? (
                          <span className="text-emerald-700">
                            Completado {dateTime.format(a.completedAt)}
                          </span>
                        ) : (
                          <span className="text-neutral-500">
                            Sin terminar
                            {a.stripeSessionId
                              ? ` · ${a.stripeSessionId.slice(0, 16)}…`
                              : ""}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        {/* ── Incidencias ─────────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              Incidencias abiertas{" "}
              <span className="text-neutral-400 font-normal text-base">
                ({openErrors.length} errores · {openWarns.length} avisos)
              </span>
            </h2>
            <ResolveAllButton count={openEvents.length} />
          </div>
          {openEvents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-600">
              Sin incidencias abiertas.
            </div>
          ) : (
            <ul className="space-y-2">
              {openEvents.map((e) => (
                <li
                  key={e.id}
                  className="rounded-lg border border-neutral-200 bg-white p-4 space-y-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`rounded-full px-2 py-0.5 font-semibold ${levelStyle[e.level]}`}
                        >
                          {e.level}
                        </span>
                        <span className="font-mono text-neutral-500">{e.area}</span>
                        {e.count > 1 && (
                          <span className="text-neutral-500">×{e.count}</span>
                        )}
                        <span className="text-neutral-400">
                          última vez {dateTime.format(e.lastSeenAt)}
                          {e.count > 1 && ` · primera ${dateTime.format(e.firstSeenAt)}`}
                        </span>
                        {e.notifiedAt && (
                          <span className="text-neutral-400">· email enviado</span>
                        )}
                      </div>
                      <p className="text-sm font-medium break-words">{e.message}</p>
                    </div>
                    <ResolveButton id={e.id} />
                  </div>
                  {e.detail != null && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-neutral-500">
                        Detalle
                      </summary>
                      <pre className="mt-2 bg-neutral-50 rounded p-3 whitespace-pre-wrap break-words text-neutral-700">
                        {JSON.stringify(e.detail, null, 2)}
                      </pre>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}

          {resolvedEvents.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-neutral-600">
                Últimas {resolvedEvents.length} cerradas
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-neutral-600">
                {resolvedEvents.map((e) => (
                  <li key={e.id} className="flex flex-wrap gap-2">
                    <span className="text-neutral-400">
                      {e.resolvedAt && dateTime.format(e.resolvedAt)}
                    </span>
                    <span className="font-mono">{e.area}</span>
                    <span>{e.message}</span>
                    {e.count > 1 && <span>×{e.count}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>
    </main>
  );
}

function rank(s: CheckStatus): number {
  return s === "fail" ? 0 : s === "warn" ? 1 : s === "ok" ? 2 : 3;
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "good" | "bad";
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <p className="text-xs text-neutral-600">{label}</p>
      <p
        className={`text-2xl font-semibold mt-1 ${
          tone === "good"
            ? "text-emerald-700"
            : tone === "bad"
              ? "text-red-700"
              : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
