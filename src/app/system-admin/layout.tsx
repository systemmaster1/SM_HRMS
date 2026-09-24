import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import DialogHost from "@/components/Dialogs";

export const metadata: Metadata = {
  title: "SystemMaster Super Admin",
  robots: { index: false, follow: false },
};

/**
 * Server-side authorization for the SystemMaster panel. The page is never
 * sent to anyone who is not a platform administrator, and every database
 * function it calls checks the same thing again.
 */
export default async function SystemAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let allowed = false;
  const a = await supabase.rpc("is_platform_admin");
  if (!a.error) allowed = a.data === true;
  else {
    const b = await supabase.rpc("is_system_admin");
    allowed = !b.error && b.data === true;
  }

  if (!allowed) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 px-5 text-white">
        <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-amber-300" />
          <h1 className="mt-4 text-2xl font-bold">SystemMaster Super Admin</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            This account is not authorized as a platform administrator.
          </p>
          <p className="mt-4 text-xs text-slate-500">Signed in as {user.email}</p>
          <a href="/dashboard" className="mt-6 inline-block rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950">
            Back to dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      <DialogHost />
    </>
  );
}
