"use client";

import { useEffect, useState } from "react";
import { signedUrl } from "@/lib/storage";
import { toast } from "@/components/Dialogs";

/** <img> for a file in a private Supabase bucket (e.g. attendance selfies). */
export function PrivateImage({
  bucket, value, alt = "", className = "", fallback = null,
}: {
  bucket: string;
  value: string | null | undefined;
  alt?: string;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setSrc(null);
    setFailed(false);
    signedUrl(bucket, value).then((u) => {
      if (!alive) return;
      if (u) setSrc(u); else setFailed(true);
    });
    return () => { alive = false; };
  }, [bucket, value]);

  if (failed) return <>{fallback}</>;
  if (!src) return <span className={`inline-block animate-pulse bg-slate-200 dark:bg-slate-700 ${className}`} />;

  return (
    <a href={src} target="_blank" rel="noreferrer" title="Open full size">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className={className} />
    </a>
  );
}

/** A link that opens a private file (e.g. an employee document) via a fresh signed URL. */
export function PrivateLink({
  bucket, value, className = "", children,
}: {
  bucket: string;
  value: string | null | undefined;
  className?: string;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);

  const open = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (busy) return;
    // In the Android app there are no browser tabs: navigating away hands the
    // link to the phone's browser/viewer. On the web, open the tab synchronously
    // so pop-up blockers allow it, then point it at the file.
    const native = typeof window !== "undefined" && !!(window as any).SMHRMSNative;
    const win = native ? null : window.open("", "_blank");
    setBusy(true);
    const u = await signedUrl(bucket, value);
    setBusy(false);
    if (!u) {
      win?.close();
      toast("You do not have access to this file, or it no longer exists.", "error");
      return;
    }
    if (win) win.location.href = u; else window.location.href = u;
  };

  return (
    <a href="#" onClick={open} className={className} aria-busy={busy}>
      {children}
    </a>
  );
}
