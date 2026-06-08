/**
 * Cloudflare R2 storage helpers.
 *
 * R2 exposes an S3-compatible API. We use @aws-sdk/client-s3 with a custom
 * endpoint pointing at the account-specific R2 host.
 *
 * All R2 env vars are optional in env.ts so the app works without R2 configured.
 * Code paths that need R2 should call assertStorage() first.
 */

import "server-only";
import { S3Client } from "@aws-sdk/client-s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

export function isStorageConfigured(): boolean {
  return Boolean(
    env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET
  );
}

type StorageConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string | null;
};

function readConfig(): StorageConfig {
  if (!isStorageConfigured()) {
    throw new Error(
      "R2 no está configurado. Define R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY y R2_BUCKET."
    );
  }
  return {
    accountId: env.R2_ACCOUNT_ID!,
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    bucket: env.R2_BUCKET!,
    publicUrl: env.R2_PUBLIC_URL ?? null,
  };
}

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;
  const cfg = readConfig();
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  return _client;
}

/**
 * Generate a signed PUT URL the browser can use to upload directly to R2.
 * The browser must send the same Content-Type when uploading.
 */
export async function createUploadUrl(opts: {
  key: string;
  contentType: string;
  expiresInSec?: number;
}): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  const cfg = readConfig();
  const client = getClient();

  const cmd = new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: opts.key,
    ContentType: opts.contentType,
  });

  const uploadUrl = await getSignedUrl(client, cmd, {
    expiresIn: opts.expiresInSec ?? 60 * 5,
  });

  // If a public custom domain is configured, hand back a public URL the
  // browser can fetch unauthenticated. Otherwise the key alone is stored
  // and the app must sign download URLs on demand (Fase 4).
  const publicUrl = cfg.publicUrl
    ? `${cfg.publicUrl.replace(/\/$/, "")}/${opts.key}`
    : `https://${cfg.accountId}.r2.cloudflarestorage.com/${cfg.bucket}/${opts.key}`;

  return { uploadUrl, publicUrl, key: opts.key };
}

/**
 * Build a key for a cover image. Uses a random suffix to avoid collisions.
 */
export function buildCoverKey(filename: string): string {
  return buildKey("covers", filename);
}

/**
 * Build a key for a site-content image (e.g. the "Sobre mí" portrait edited
 * from /admin/contenido). Stored under `site/` to keep them apart from course
 * covers when listing the bucket.
 */
export function buildSiteImageKey(filename: string): string {
  return buildKey("site", filename);
}

/**
 * Build a key for a lesson file (PDF). Stored under `lesson-files/<lessonId>/`
 * so files are obviously associated with their lesson when listing the bucket.
 */
export function buildLessonFileKey(opts: {
  lessonId: string;
  filename: string;
}): string {
  return buildKey(`lesson-files/${opts.lessonId}`, opts.filename);
}

function buildKey(prefix: string, filename: string): string {
  const ext = (filename.match(/\.[a-z0-9]+$/i)?.[0] ?? "").toLowerCase();
  const safe = filename
    .replace(/\.[a-z0-9]+$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}/${ts}-${rand}-${safe}${ext}`;
}
