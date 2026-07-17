"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SignOutLink() {
  const supabase = createClient();
  const router = useRouter();

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <button
      onClick={signOut}
      className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
    >
      Back to sign in
    </button>
  );
}
