import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { backupCompany } from "@/lib/gsheet-backup";

export const dynamic = "force-dynamic";

/** Runs the Google Sheet backup on demand for the signed-in admin's company. */
export async function POST() {
  try {
    const supabase = await createClient();

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles").select("company_id, role").eq("id", auth.user.id).single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    if (!["owner", "admin", "hr"].includes(String(profile.role))) {
      return NextResponse.json({ error: "Admins only." }, { status: 403 });
    }

    const sheets = await backupCompany(profile.company_id);
    return NextResponse.json({ ok: true, sheets });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "The backup could not be delivered." },
      { status: 500 }
    );
  }
}
