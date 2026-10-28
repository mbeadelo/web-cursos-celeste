import { env } from "@/lib/env";

/**
 * Admins fijos ("pinned"): ADMIN_EMAIL + ADMIN_EMAILS (coma-separados).
 *
 * Estos emails son SIEMPRE admin, pase lo que pase en la base de datos:
 *  - pueden iniciar sesión aunque no exista su fila en User (registro cerrado),
 *  - su fila se crea/repara con role=ADMIN al iniciar sesión (sin seed manual),
 *  - su JWT lleva role=ADMIN en cada petición, aunque alguien cambie el rol en DB.
 *
 * Para añadir o quitar un admin: editar la variable en Vercel (Production) y
 * redeploy. Nada que tocar en la base de datos.
 */
const pinned = new Set(
  [env.ADMIN_EMAIL, ...(env.ADMIN_EMAILS ?? "").split(",")]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

export const pinnedAdminEmails: readonly string[] = [...pinned];

export function isPinnedAdmin(email: string | null | undefined): boolean {
  return !!email && pinned.has(email.trim().toLowerCase());
}
