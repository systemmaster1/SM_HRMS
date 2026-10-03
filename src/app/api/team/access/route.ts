import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { friendlyError } from "@/lib/errors";
import { getOrgActor, isOrgAdmin } from "@/lib/server/org-actor";

const LEVELS = new Set(["none", "self", "team", "company"]);

export async function POST(req: Request) {
  const actor = await getOrgActor();
  if (!actor) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (!isOrgAdmin(actor.role)) return NextResponse.json({ error: "Owner/Admin only" }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  // Only known module keys and access levels are stored.
  const raw = body?.access_permissions;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return NextResponse.json({ error: "Invalid access settings." }, { status: 400 });
  }
  const access: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (/^[a-z_.]{1,40}$/.test(k) && typeof v === "string" && LEVELS.has(v)) access[k] = v;
  }

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("company_id,role").eq("id", body.user_id).maybeSingle();
  if (!target || target.company_id !== actor.companyId) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  if (target.role === "owner") return NextResponse.json({ error: "Owner access cannot be restricted here." }, { status: 400 });
  if (target.role === "admin" && actor.role !== "owner") {
    return NextResponse.json({ error: "Only the Organization Owner can change an Admin's access." }, { status: 403 });
  }
  const { error } = await admin.from("profiles").update({ access_permissions: access })
    .eq("id", body.user_id).eq("company_id", actor.companyId);
  if (error) return NextResponse.json({ error: friendlyError(error, "save access settings") }, { status: 400 });
  return NextResponse.json({ ok: true });
}
