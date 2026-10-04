import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LandingPage from "@/components/LandingPage";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  // The Android app opens straight to sign-in; the marketing page is web only.
  const ua = (await headers()).get("user-agent") || "";
  if (/SMHRMS-Android/i.test(ua)) redirect("/login");

  return <LandingPage />;
}
