import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Shell from "@/components/Shell";
import AccountLocked from "@/components/AccountLocked";
import type { Profile, Company } from "@/lib/types";
import ActiveVisitTracker from "@/components/ActiveVisitTracker";
import NativeSessionSync from "@/components/NativeSessionSync";
import PushRegistrar from "@/components/PushRegistrar";
import DialogHost from "@/components/Dialogs";
import FirstLoginGuide from "@/components/FirstLoginGuide";
import OrgAdmin2FARecommendation from "@/components/OrgAdmin2FARecommendation";
import OrganizationSuspended from "@/components/OrganizationSuspended";
import { EntitlementsProvider } from "@/lib/features/client";
import { getEntitlements } from "@/lib/features/server";
import { hasVerifiedOrgAdmin2fa } from "@/lib/org-admin-2fa";
import { friendlyError } from "@/lib/errors";
import { PROFILE_COLUMNS, COMPANY_COLUMNS } from "@/lib/profile-columns";

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

  // Fetch the signed-in user's profile.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .maybeSingle();

  // If the profile read errors, DO NOT redirect — that can bounce the user
  // between /login and /dashboard in a loop. Show a clear, self-contained
  // message instead so they can retry.
  if (profileError) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 p-6 dark:bg-slate-950">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            We couldn&apos;t load your workspace
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Something went wrong reading your account. Please refresh the page,
            or sign out and sign back in.
          </p>
          <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-left text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-400">
            {friendlyError(profileError, "load your account")}
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <a href="/dashboard"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700">
              Refresh
            </a>
            <a href="/login"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200">
              Sign in again
            </a>
          </div>
        </div>
      </div>
    );
  }

  // No profile row yet (signup trigger lag) — send to onboarding
  if (!profile) redirect("/onboarding");

  // Account suspended or offboarded — block everything except this screen
  if (profile.status === "disabled" || profile.status === "left") {
    return <AccountLocked status={profile.status} />;
  }

  // Profile exists but no company -> must create one
  if (!profile.company_id) redirect("/onboarding");

  // Temporary password set by an Owner/Admin -> employee must choose their own.
  if (profile.must_change_password) redirect("/change-password");

  const { data: company } = await supabase
    .from("companies")
    .select(COMPANY_COLUMNS)
    .eq("id", profile.company_id)
    .maybeSingle();

  // Optional Organization Admin 2FA becomes mandatory at sign-in once enabled.
  if (profile.role === "owner" || profile.role === "admin") {
    const org2fa = await hasVerifiedOrgAdmin2fa(profile.id, profile.company_id);
    if (org2fa.required && !org2fa.verified) redirect("/org-admin-verify");
  }

  // Organization entitlements (modules, plan, suspension) — enforced again
  // in the database for every read and write.
  const entitlements = await getEntitlements();
  if (entitlements.organization?.account_status === "suspended") {
    return (
      <OrganizationSuspended
        orgName={entitlements.organization.name}
        orgCode={entitlements.organization.org_code}
        reason={entitlements.organization.suspended_reason}
      />
    );
  }

  return (
    <EntitlementsProvider value={entitlements}>
      <Shell profile={profile as Profile} company={company as Company | null}>
        {children}
        <NativeSessionSync />
        <ActiveVisitTracker />
        <PushRegistrar />
        <DialogHost />
        <FirstLoginGuide userId={profile.id} />
        {(profile.role === "owner" || profile.role === "admin") && <OrgAdmin2FARecommendation />}
      </Shell>
    </EntitlementsProvider>
  );
}
