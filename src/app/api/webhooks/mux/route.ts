import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isMuxConfigured } from "@/lib/mux";
import { env } from "@/lib/env";
import crypto from "node:crypto";

export const runtime = "nodejs";

/**
 * POST /api/webhooks/mux
 *
 * Receives Mux events. We care about:
 *   - video.upload.asset_created  → maps upload_id → asset_id
 *   - video.asset.ready           → asset has playable URLs
 *
 * We use the Lesson model as the destination: `muxUploadId` set when admin
 * starts the upload, then the webhook fills `muxAssetId` and `muxPlaybackId`.
 *
 * Signature verification: Mux signs with HMAC-SHA256. The header is
 * `mux-signature: t=<timestamp>,v1=<hex>`. Compute HMAC of `${timestamp}.${rawBody}`
 * with `MUX_WEBHOOK_SECRET` and compare.
 */
export async function POST(req: Request) {
  if (!isMuxConfigured()) {
    return new Response("Mux no configurado", { status: 503 });
  }

  const signatureHeader = req.headers.get("mux-signature");
  const rawBody = await req.text();

  if (env.MUX_WEBHOOK_SECRET) {
    if (!signatureHeader) {
      return new Response("Missing mux-signature header", { status: 400 });
    }
    if (!verifyMuxSignature(rawBody, signatureHeader, env.MUX_WEBHOOK_SECRET)) {
      return new Response("Invalid signature", { status: 400 });
    }
  }
  // If MUX_WEBHOOK_SECRET is unset (shouldn't be in prod), we accept the
  // event but log a warning. This lets us test the endpoint locally before
  // configuring webhook signing.

  let event: { type?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Body JSON inválido", { status: 400 });
  }

  try {
    switch (event.type) {
      case "video.upload.asset_created":
        await handleUploadAssetCreated(event.data);
        break;
      case "video.asset.ready":
        await handleAssetReady(event.data);
        break;
      default:
        // Other events ignored. Mux sends quite a few that we don't care about
        // (asset.created, asset.errored, upload.created, etc.).
        break;
    }
  } catch (err) {
    console.error(`[mux webhook] error handling ${event.type}:`, err);
    // Always 200 — Mux retries forever on non-2xx and we don't have an
    // idempotency table for Mux yet (events are infrequent and the field
    // updates are idempotent anyway).
  }

  return NextResponse.json({ received: true });
}

async function handleUploadAssetCreated(
  data: Record<string, unknown> | undefined
) {
  if (!data) return;
  // The `video.upload.asset_created` payload has the upload object with
  // `id` (upload_id) and `asset_id`.
  const uploadId = typeof data.id === "string" ? data.id : null;
  const assetId = typeof data.asset_id === "string" ? data.asset_id : null;
  if (!uploadId || !assetId) return;

  await db.lesson
    .update({
      where: { muxUploadId: uploadId },
      data: { muxAssetId: assetId },
    })
    .catch((err) => {
      // No matching lesson — orphan upload. Log but don't fail.
      console.warn("[mux webhook] no lesson for upload", uploadId, err);
    });
}

async function handleAssetReady(data: Record<string, unknown> | undefined) {
  if (!data) return;
  const assetId = typeof data.id === "string" ? data.id : null;
  const passthrough =
    typeof data.passthrough === "string" ? data.passthrough : null;

  // Extract first playback id (we only create one — public).
  const playbackIds = Array.isArray(data.playback_ids) ? data.playback_ids : [];
  const playbackId =
    playbackIds.length > 0 &&
    typeof (playbackIds[0] as Record<string, unknown>).id === "string"
      ? ((playbackIds[0] as Record<string, unknown>).id as string)
      : null;

  if (!playbackId) return;

  // Prefer matching by assetId (set in upload.asset_created); fall back to
  // passthrough (lessonId).
  if (assetId) {
    const updated = await db.lesson
      .updateMany({
        where: { muxAssetId: assetId },
        data: { muxPlaybackId: playbackId },
      })
      .catch(() => ({ count: 0 }));
    if (updated.count > 0) return;
  }

  if (passthrough) {
    await db.lesson
      .update({
        where: { id: passthrough },
        data: { muxAssetId: assetId, muxPlaybackId: playbackId },
      })
      .catch((err) => {
        console.warn(
          "[mux webhook] no lesson for passthrough",
          passthrough,
          err
        );
      });
  }
}

/**
 * Verify Mux webhook signature.
 * Header format: `t=<unix_timestamp>,v1=<hex_hmac>`
 * Signed payload: `${timestamp}.${rawBody}`
 */
function verifyMuxSignature(
  rawBody: string,
  header: string,
  secret: string
): boolean {
  const parts = header.split(",").reduce<Record<string, string>>((acc, p) => {
    const [k, v] = p.split("=");
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;

  // Reject signatures older than 5 minutes to mitigate replay.
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(t)) > 300) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest("hex");

  // Constant-time comparison
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
