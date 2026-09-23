import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Skip the auth check for:
     *  - Next.js internals and static files
     *  - public assets: APK, PDF user guide, service worker, manifest, icons
     *  - /.well-known (Android app-link verification)
     *  - /api/cron (Vercel Cron has no login cookie; protected by CRON_SECRET)
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|robots.txt|sitemap.xml|\\.well-known|downloads/|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|pdf|apk|sha256|txt|xml|json)$).*)",
  ],
};
