import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("company_id,role").eq("id", user.id).single();
  if (!me?.company_id || !["owner","admin"].includes(me.role)) return NextResponse.json({ error: "Owner/Admin only" }, { status: 403 });
  const body = await req.json();
  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("company_id,role").eq("id", body.user_id).single();
  if (!target || target.company_id !== me.company_id) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  if (target.role === "owner") return NextResponse.json({ error: "Owner access cannot be restricted here." }, { status: 400 });
  const { error } = await admin.from("profiles").update({ access_permissions: body.access_permissions }).eq("id", body.user_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}



