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

  // Fetch the signed-in user's profile. We look at the ERROR separately from
  // the row: a NULL row means the profile genuinely doesn't exist (new user),
  // but an ERROR usually means the token/session couldn't be validated
  // (e.g. a slightly wrong device clock). In that case we must NOT treat the
  // user as "no company" and dump them into onboarding — that's what was
  // wrongly sending existing owners back to setup. We send them to /login so
  // a fresh session is minted instead.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  // A read error is a transient/auth problem, not "profile missing".
  if (profileError) redirect("/login");

  // No profile row yet (signup trigger lag) — send to onboarding
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
    .maybeSingle();

  return (
    <Shell profile={profile as Profile} company={company as Company | null}>
      {children}
    </Shell>
  );
}
