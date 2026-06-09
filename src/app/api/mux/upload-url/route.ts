import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isMuxConfigured, createDirectUpload } from "@/lib/mux";

export const runtime = "nodejs";

/**
 * POST /api/mux/upload-url
 * Body (JSON): { lessonId: string }
 *
 * Creates a Direct Upload for the given lesson and saves the upload id on
 * the Lesson row. The admin then PUTs the video file to the returned URL.
 * Mux webhooks will fill `muxAssetId` and `muxPlaybackId` once the asset is
 * processed and ready.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return new Response("No autorizado", { status: 403 });
  }
  if (!isMuxConfigured()) {
    return new Response("Mux no configurado", { status: 503 });
  }

  let body: { lessonId?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("Body JSON requerido", { status: 400 });
  }
  const lessonId = typeof body.lessonId === "string" ? body.lessonId : null;
  const origin = new URL(req.url).origin;

  // Editing an existing lesson: verify it's a video and persist the upload id
  // on the row so the webhook can fill muxAssetId/muxPlaybackId.
  if (lessonId) {
    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, type: true },
    });
    if (!lesson) return new Response("Lección no encontrada", { status: 404 });
    if (lesson.type !== "VIDEO") {
      return new Response("La lección no es de tipo VIDEO", { status: 400 });
    }
    const { uploadId, uploadUrl } = await createDirectUpload({
      lessonId: lesson.id,
      corsOrigin: origin,
    });
    await db.lesson.update({
      where: { id: lesson.id },
      data: { muxUploadId: uploadId },
    });
    return NextResponse.json({ uploadUrl, uploadId });
  }

  // Creating a lesson: the row doesn't exist yet. Return the upload id and let
  // the client store it on the lesson at creation time; the webhook links the
  // asset to the lesson via that muxUploadId.
  const { uploadId, uploadUrl } = await createDirectUpload({ corsOrigin: origin });
  return NextResponse.json({ uploadUrl, uploadId });
}
