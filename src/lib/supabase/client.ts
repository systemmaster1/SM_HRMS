import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Keep the session fresh and auto-recover from token issues.
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        // Refresh a little earlier so a slightly fast device clock is less
        // likely to trip Supabase's "issued at future" / expiry checks.
        flowType: "pkce",
      },
    }
  );
}
