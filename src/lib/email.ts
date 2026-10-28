import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";
import { getAllContent, pickContent } from "@/lib/site-content";

let _client: Resend | null = null;

function getResend(): Resend {
  if (_client) return _client;
  _client = new Resend(env.RESEND_API_KEY);
  return _client;
}

const SITE_URL =
  env.AUTH_URL?.replace(/\/$/, "") ?? "https://bienvenidoatuplaza.com";

/**
 * Replace `{{placeholder}}` tokens with sanitized values. The replacement is
 * HTML-escaped by default so a malicious course title (admin-controlled, but
 * still) can't break out of the template.
 *
 * For values that need to render as raw HTML (e.g. a URL inside an `href`
 * already escaped in the template), pass them via `rawVars` instead.
 */
function interpolate(
  template: string,
  vars: Record<string, string>,
  rawVars: Record<string, string> = {}
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => {
    if (name in rawVars) return rawVars[name]!;
    if (name in vars) return escapeHtml(vars[name]!);
    return "";
  });
}

/**
 * Welcome email sent right after a successful Stripe purchase.
 *
 * Subject and body are editable from /admin/contenido (SiteContent keys
 * `email.purchase.subject`, `email.purchase.body_new`,
 * `email.purchase.body_existing`, `email.purchase.cta_label`).
 *
 * The body is TipTap rich text with `{{courseTitle}}` and `{{loginUrl}}`
 * placeholders. The shell HTML around it (header, button, footer with brand)
 * is fixed here so admin can't break the email rendering by editing copy.
 */
export async function sendPurchaseWelcomeEmail(opts: {
  to: string;
  courseTitle: string;
  isNewUser: boolean;
}): Promise<void> {
  const content = await getAllContent();
  const loginUrl = `${SITE_URL}/login`;

  // Subject: plain text, single-line. Strip HTML escaping that interpolate()
  // applies — a subject with `&amp;` looks broken.
  const subjectTpl = pickContent(content, "email.purchase.subject");
  const subject = interpolate(subjectTpl, {
    courseTitle: opts.courseTitle,
  })
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');

  const bodyKey = opts.isNewUser
    ? "email.purchase.body_new"
    : "email.purchase.body_existing";
  const bodyTpl = pickContent(content, bodyKey);
  // {{loginUrl}} is rendered raw because it's a URL we control and we want it
  // to interpolate inside `href="..."` attributes that the admin may have
  // typed. {{courseTitle}} stays escaped.
  const body = interpolate(
    bodyTpl,
    { courseTitle: opts.courseTitle },
    { loginUrl }
  );

  const ctaLabelTpl = pickContent(content, "email.purchase.cta_label");
  const ctaLabel = escapeHtml(
    interpolate(ctaLabelTpl, { courseTitle: opts.courseTitle })
  );

  const html = renderShell({ body, ctaLabel, loginUrl });

  const result = await getResend().emails.send({
    from: env.EMAIL_FROM,
    to: opts.to,
    subject,
    html,
  });

  if (result.error) {
    throw new Error(
      `No se pudo enviar el email de bienvenida: ${result.error.message}`
    );
  }
}

/**
 * Brand shell around the editable body. Inline styles only — most email
 * clients (Outlook, Gmail) strip <style> blocks. Tablero centrado, paleta
 * celeste/magenta sutil, footer con la marca.
 */
function renderShell(opts: {
  body: string;
  ctaLabel: string;
  loginUrl: string;
}): string {
  const domain = SITE_URL.replace(/^https?:\/\//, "");
  return `<!doctype html>
<html lang="es">
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;margin:0;padding:32px;color:#0f172a">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
    <tr><td style="padding:32px 32px 8px">
      <h1 style="margin:0 0 16px;font-size:24px;color:#0f172a">¡Bienvenido a tu plaza!</h1>
      <div style="color:#334155;line-height:1.6;font-size:15px">
        ${opts.body}
      </div>
      <p style="margin:24px 0 0">
        <a href="${opts.loginUrl}" style="display:inline-block;background:#0284c7;color:#fff;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:500">
          ${opts.ctaLabel}
        </a>
      </p>
    </td></tr>
    <tr><td style="background:#f1f5f9;padding:16px 32px;color:#64748b;font-size:12px">
      Bienvenido a tu plaza · ${domain}
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Destinatarios de las alertas técnicas: OPS_ALERT_EMAILS o, si no, ADMIN_EMAIL. */
export function opsAlertRecipients(): string[] {
  const raw = env.OPS_ALERT_EMAILS?.trim() ? env.OPS_ALERT_EMAILS : env.ADMIN_EMAIL;
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@"))
    )
  );
}

/**
 * Email de alerta técnica (sistema propio de monitorización, ver
 * src/lib/ops.ts). Texto plano dentro de un shell mínimo: lo importante es
 * que llegue y se lea en el móvil, no que sea bonito. No pasa por
 * SiteContent a propósito: no debe depender de la DB.
 */
export async function sendOpsAlertEmail(opts: {
  area: string;
  message: string;
  detail: Record<string, unknown>;
  count: number;
  eventId: string | null;
}): Promise<void> {
  const to = opsAlertRecipients();
  if (to.length === 0) return;

  const saludUrl = `${SITE_URL}/admin/salud`;
  const detailJson = escapeHtml(JSON.stringify(opts.detail, null, 2)).slice(
    0,
    6000
  );
  const repeated =
    opts.count > 1
      ? ` (repetida ${opts.count} veces en las últimas 24 h)`
      : "";

  const html = `<!doctype html>
<html lang="es"><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;padding:24px;background:#f8fafc">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0">
    <p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#b91c1c;font-weight:600">Alerta · ${escapeHtml(opts.area)}</p>
    <h1 style="margin:0 0 12px;font-size:20px">${escapeHtml(opts.message)}</h1>
    <p style="margin:0 0 16px;color:#334155;font-size:14px">Detectado por la propia web${repeated}. Revísalo en
      <a href="${saludUrl}" style="color:#0284c7">${saludUrl}</a>.</p>
    <pre style="background:#0f172a;color:#e2e8f0;padding:16px;border-radius:8px;font-size:12px;white-space:pre-wrap;word-break:break-word;margin:0">${detailJson}</pre>
    ${opts.eventId ? `<p style="margin:16px 0 0;color:#94a3b8;font-size:11px">Incidencia ${escapeHtml(opts.eventId)}</p>` : ""}
  </div>
</body></html>`;

  const result = await getResend().emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: `⚠️ [tu plaza] ${opts.area}: ${opts.message}`.slice(0, 180),
    html,
  });
  if (result.error) {
    throw new Error(`No se pudo enviar la alerta: ${result.error.message}`);
  }
}
