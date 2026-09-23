"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Private-bucket helpers.
 *
 * Attendance selfies and employee documents are stored in PRIVATE buckets.
 * The database keeps only the file path (older rows may still hold a full
 * "public" URL - both formats are understood). To show a file we ask
 * Supabase for a short-lived signed URL. Requests made in the same moment are
 * batched into one call, and results are cached until shortly before expiry.
 */
const TTL_SECONDS = 60 * 60; // 1 hour
const cache = new Map<string, { url: string; exp: number }>();
const queues = new Map<string, { path: string; resolve: (u: string | null) => void }[]>();
let timer: ReturnType<typeof setTimeout> | null = null;

/** Extracts the object path from a stored value (path, public URL or signed URL). */
export function storagePath(value: string | null | undefined, bucket: string): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) return v.replace(/^\/+/, "");
  const marker = new RegExp(`/storage/v1/object/(?:public|sign|authenticated)/${bucket}/([^?#]+)`);
  const m = v.match(marker);
  return m ? decodeURIComponent(m[1]) : null;
}

async function flush() {
  timer = null;
  const batches = Array.from(queues.entries());
  queues.clear();
  const supabase = createClient();

  for (const [bucket, items] of batches) {
    const paths = Array.from(new Set(items.map((i) => i.path)));
    const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, TTL_SECONDS);
    const byPath = new Map<string, string | null>();
    (data || []).forEach((d: any) => {
      byPath.set(d.path, d.signedUrl || null);
      if (d.signedUrl) {
        cache.set(`${bucket}/${d.path}`, { url: d.signedUrl, exp: Date.now() + (TTL_SECONDS - 120) * 1000 });
      }
    });
    items.forEach((i) => i.resolve(byPath.get(i.path) ?? null));
  }
}

/** Returns a temporary URL for a private file, or null if not allowed/not found. */
export function signedUrl(bucket: string, stored: string | null | undefined): Promise<string | null> {
  const path = storagePath(stored, bucket);
  if (!path) return Promise.resolve(null);

  const hit = cache.get(`${bucket}/${path}`);
  if (hit && hit.exp > Date.now()) return Promise.resolve(hit.url);

  return new Promise((resolve) => {
    const q = queues.get(bucket) || [];
    q.push({ path, resolve });
    queues.set(bucket, q);
    if (!timer) timer = setTimeout(flush, 15);
  });
}
