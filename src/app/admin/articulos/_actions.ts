"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ZodError } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ArticleInputSchema, type ArticleInput } from "@/lib/validations/article";
import { sanitizeRichHtml } from "@/lib/html";

type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

async function ensureAdmin(): Promise<{ userId: string }> {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("No autorizado");
  }
  return { userId: session.user.id };
}

export async function createArticle(raw: ArticleInput): Promise<ActionResult> {
  const { userId } = await ensureAdmin();

  const parsed = ArticleInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Datos no válidos",
      fieldErrors: flattenErrors(parsed.error),
    };
  }

  // Sanitize the TipTap HTML body before it ever touches the DB.
  const data = { ...parsed.data, body: sanitizeRichHtml(parsed.data.body) };

  let created;
  try {
    created = await db.article.create({
      data: {
        ...data,
        authorId: userId,
        publishedAt: data.published ? new Date() : null,
      },
      select: { id: true },
    });
  } catch (err: unknown) {
    if (isUniqueConstraint(err, "slug")) {
      return { ok: false, error: "Ese slug ya existe. Usa otro." };
    }
    throw err;
  }

  revalidatePath("/admin/articulos");
  revalidatePath("/articulos");
  redirect(`/admin/articulos/${created.id}`);
}

export async function updateArticle(
  id: string,
  raw: ArticleInput
): Promise<ActionResult> {
  await ensureAdmin();

  const parsed = ArticleInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Datos no válidos",
      fieldErrors: flattenErrors(parsed.error),
    };
  }

  // Preserve publishedAt: set on first publish, keep on subsequent saves,
  // null out on unpublish.
  const current = await db.article.findUnique({
    where: { id },
    select: { publishedAt: true },
  });

  const publishedAt = parsed.data.published
    ? current?.publishedAt ?? new Date()
    : null;

  // Sanitize the TipTap HTML body before it ever touches the DB.
  const data = { ...parsed.data, body: sanitizeRichHtml(parsed.data.body) };

  try {
    await db.article.update({
      where: { id },
      data: { ...data, publishedAt },
    });
  } catch (err: unknown) {
    if (isUniqueConstraint(err, "slug")) {
      return { ok: false, error: "Ese slug ya existe. Usa otro." };
    }
    throw err;
  }

  revalidatePath("/admin/articulos");
  revalidatePath(`/admin/articulos/${id}`);
  revalidatePath("/articulos");
  if (parsed.data.slug) revalidatePath(`/articulos/${parsed.data.slug}`);
  return { ok: true };
}

export async function togglePublishArticle(id: string): Promise<void> {
  await ensureAdmin();
  const a = await db.article.findUniqueOrThrow({
    where: { id },
    select: { published: true, publishedAt: true, slug: true },
  });
  const next = !a.published;
  await db.article.update({
    where: { id },
    data: {
      published: next,
      publishedAt: next ? a.publishedAt ?? new Date() : null,
    },
  });
  revalidatePath("/admin/articulos");
  revalidatePath("/articulos");
  revalidatePath(`/articulos/${a.slug}`);
}

export async function deleteArticle(id: string): Promise<void> {
  await ensureAdmin();
  const a = await db.article.findUnique({
    where: { id },
    select: { slug: true },
  });
  await db.article.delete({ where: { id } });
  revalidatePath("/admin/articulos");
  revalidatePath("/articulos");
  if (a?.slug) revalidatePath(`/articulos/${a.slug}`);
}

function flattenErrors(err: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const path = issue.path.join(".") || "_";
    if (!out[path]) out[path] = [];
    out[path]!.push(issue.message);
  }
  return out;
}

function isUniqueConstraint(err: unknown, field: string): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: string; meta?: { target?: string[] | string } };
  if (e.code !== "P2002") return false;
  const target = e.meta?.target;
  if (Array.isArray(target)) return target.includes(field);
  return target === field;
}
