import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { SITE_CONTENT_KEYS, type SiteContentKey } from "@/lib/site-content-keys";

export { SITE_CONTENT_KEYS };
export type { SiteContentKey };

/**
 * Load every site-content row in one query, returning a Map for O(1) lookup
 * by key. Cached per-request via React `cache()` so multiple components in
 * the same render only hit the DB once.
 */
export const getAllContent = cache(async (): Promise<Map<string, string>> => {
  const rows = await db.siteContent.findMany({
    select: { key: true, value: true },
  });
  return new Map(rows.map((r) => [r.key, r.value]));
});

/**
 * Read a single content key with default fallback. Use this in server
 * components when you only need one or two values.
 */
export async function getContent(key: SiteContentKey): Promise<string> {
  const all = await getAllContent();
  return all.get(key) ?? SITE_CONTENT_KEYS[key].default;
}

/**
 * Synchronous lookup against a pre-loaded map. Use when you've already called
 * getAllContent() and want to avoid awaiting per key.
 */
export function pickContent(
  map: Map<string, string>,
  key: SiteContentKey
): string {
  return map.get(key) ?? SITE_CONTENT_KEYS[key].default;
}
