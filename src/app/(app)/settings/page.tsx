import { createClient } from "@/lib/supabase/server";
import SettingsForm from "@/components/SettingsForm";
import PlanFeaturesCard from "@/components/PlanFeaturesCard";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles").select("company_id, role").eq("id", user!.id).single();

  if (!["owner", "admin"].includes(profile?.role || "")) redirect("/dashboard");

  const { data: company } = await supabase
    .from("companies").select("*").eq("id", profile!.company_id).single();

  const { count: activeUsers } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  return (
    <>
      <PlanFeaturesCard />
      <SettingsForm company={company} activeUsers={activeUsers ?? 0} />
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Privacy & account</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Review the policies used by the Android app and Google Play listing.</p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm font-medium">
          <Link href="/privacy" className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">Privacy Policy</Link>
          <Link href="/terms" className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">Terms & Conditions</Link>
          <Link href="/delete-account" className="rounded-lg border border-slate-200 px-3 py-2 text-rose-700 dark:border-slate-700 dark:text-rose-300">Account deletion</Link>
        </div>
      </section>
    </>
  );
}
