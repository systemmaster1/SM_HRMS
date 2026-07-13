import { createClient } from "@/lib/supabase/server";
import SettingsForm from "@/components/SettingsForm";
import { redirect } from "next/navigation";

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

  return <SettingsForm company={company} activeUsers={activeUsers ?? 0} />;
}
