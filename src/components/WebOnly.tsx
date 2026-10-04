"use client";

import { useEffect, useState } from "react";

/** True inside the SM HRMS Android app (WebView user agent or native bridge). */
export function detectNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  return /SMHRMS-Android/i.test(navigator.userAgent) || !!(window as any).SMHRMSNative;
}

export function useIsNativeApp(): boolean | null {
  const [native, setNative] = useState<boolean | null>(null);
  useEffect(() => { setNative(detectNativeApp()); }, []);
  return native;
}

/**
 * Renders its children only in a normal browser. The Android app has no
 * marketing landing page, so "Back to home" style links are hidden there.
 * Nothing is rendered until the check has run, so the app never flashes them.
 */
export default function WebOnly({ children }: { children: React.ReactNode }) {
  const native = useIsNativeApp();
  if (native !== false) return null;
  return <>{children}</>;
}
