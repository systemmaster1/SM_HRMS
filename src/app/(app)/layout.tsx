import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Shell from "@/components/Shell";
import AccountLocked from "@/components/AccountLocked";
import type { Profile, Company } from "@/lib/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // No profile row yet (trigger lag) — send to onboarding
  if (!profile) redirect("/onboarding");

  // Account suspended or offboarded — block everything except this screen
  if (profile.status === "disabled" || profile.status === "left") {
    return <AccountLocked status={profile.status} />;
  }

  // Profile exists but no company -> must create one
  if (!profile.company_id) redirect("/onboarding");

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", profile.company_id)
    .single();

  return (
    <Shell profile={profile as Profile} company={company as Company | null}>
      {children}
    </Shell>
  );
}
