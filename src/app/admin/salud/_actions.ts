"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { reportOps } from "@/lib/ops";
import { opsAlertRecipients } from "@/lib/email";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("No autorizado");
  }
  return session;
}

export async function resolveOpsEvent(id: string) {
  await requireAdmin();
  await db.opsEvent.updateMany({
    where: { id, resolvedAt: null },
    data: { resolvedAt: new Date() },
  });
  revalidatePath("/admin/salud");
  revalidatePath("/admin");
}

export async function resolveAllOpsEvents() {
  await requireAdmin();
  await db.opsEvent.updateMany({
    where: { resolvedAt: null },
    data: { resolvedAt: new Date() },
  });
  revalidatePath("/admin/salud");
  revalidatePath("/admin");
}

/**
 * Dispara una incidencia ERROR de prueba para verificar de punta a punta que
 * el email de alerta llega. Se cierra sola para no ensuciar el panel.
 */
export async function sendTestAlert(): Promise<{ ok: true; to: string[] }> {
  const session = await requireAdmin();
  const to = opsAlertRecipients();
  await reportOps({
    level: "ERROR",
    area: "health",
    message: "Prueba de alerta enviada desde /admin/salud",
    detail: { by: session.user.email, at: new Date().toISOString() },
  });
  await db.opsEvent.updateMany({
    where: {
      area: "health",
      message: "Prueba de alerta enviada desde /admin/salud",
      resolvedAt: null,
    },
    data: { resolvedAt: new Date() },
  });
  revalidatePath("/admin/salud");
  return { ok: true, to };
}
