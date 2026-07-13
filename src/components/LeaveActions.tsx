"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Check, X } from "lucide-react";

export default function LeaveActions({ leaveId }: { leaveId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const decide = async (status: "approved" | "rejected") => {
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase
      .from("leaves")
      .update({ status, decided_by: user?.id })
      .eq("id", leaveId);
    setBusy(false);
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => decide("approved")}
        disabled={busy}
        title="Approve"
        className="grid place-items-center h-8 w-8 rounded-lg bg-emerald-50 text-present hover:bg-emerald-100 disabled:opacity-50"
      >
        <Check className="h-4 w-4" />
      </button>
      <button
        onClick={() => decide("rejected")}
        disabled={busy}
        title="Reject"
        className="grid place-items-center h-8 w-8 rounded-lg bg-rose-50 text-absent hover:bg-rose-100 disabled:opacity-50"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
