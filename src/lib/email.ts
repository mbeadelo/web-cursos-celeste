import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";

let _client: Resend | null = null;

function getResend(): Resend {
  if (_client) return _client;
  _client = new Resend(env.RESEND_API_KEY);
  return _client;
}

const SITE_URL =
  env.AUTH_URL?.replace(/\/$/, "") ?? "https://bienvenidoatuplaza.com";

/**
 * Welcome email sent right after a successful Stripe purchase. Tells the
 * student the account is ready and how to log in.
 */
export async function sendPurchaseWelcomeEmail(opts: {
  to: string;
  courseTitle: string;
  isNewUser: boolean;
}): Promise<void> {
  const subject = opts.isNewUser
    ? `Tu acceso a ${opts.courseTitle} está listo`
    : `Has comprado ${opts.courseTitle} — tu acceso está listo`;

  const introNew = `<p style="margin:0 0 16px">
    Acabamos de procesar tu compra de <strong>${escapeHtml(opts.courseTitle)}</strong>.
    Tu cuenta está creada y lista. Para entrar:
  </p>`;

  const introExisting = `<p style="margin:0 0 16px">
    Acabamos de añadir <strong>${escapeHtml(opts.courseTitle)}</strong> a tu cuenta.
    Para acceder al curso:
  </p>`;

  const html = `<!doctype html>
<html lang="es">
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;margin:0;padding:32px">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
    <tr><td style="padding:32px 32px 8px">
      <h1 style="margin:0 0 8px;font-size:24px;color:#0f172a">¡Bienvenido a tu plaza!</h1>
      ${opts.isNewUser ? introNew : introExisting}
      <ol style="margin:0 0 24px;padding-left:20px;color:#334155;line-height:1.6">
        <li>Entra en <a href="${SITE_URL}/login" style="color:#0284c7">${SITE_URL.replace(/^https?:\/\//, "")}/login</a></li>
        <li>Escribe este mismo email (<strong>${escapeHtml(opts.to)}</strong>) y pulsa "Enviar enlace"</li>
        <li>Te llegará un email con un enlace de un solo uso para entrar</li>
      </ol>
      <a href="${SITE_URL}/login" style="display:inline-block;background:#0284c7;color:#fff;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:500">
        Acceder ahora
      </a>
      <p style="margin:24px 0 0;color:#64748b;font-size:14px;line-height:1.6">
        Tu acceso al curso es permanente. Puedes verlo cuando quieras desde tu panel.
      </p>
    </td></tr>
    <tr><td style="background:#f1f5f9;padding:16px 32px;color:#64748b;font-size:12px">
      Bienvenido a tu plaza · ${SITE_URL.replace(/^https?:\/\//, "")}
    </td></tr>
  </table>
</body>
</html>`;

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
