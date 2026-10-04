import { NextResponse } from "next/server";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgActor } from "@/lib/server/org-actor";
import { rateLimit } from "@/lib/server/rate-limit";
import { friendlyError } from "@/lib/errors";
import { sendGmailMessage } from "@/lib/gmail";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ownership & Administration.
 *  GET  -> current owner, pending request (if visible to the caller), eligible admins (Owner only)
 *  POST -> { action: "initiate" | "accept" | "cancel" | "decline", password, to_user_id?, transfer_id?, note? }
 * Every POST re-verifies the caller's password. The database functions are
 * service-role only and re-check every rule atomically.
 */
export async function GET() {
  const actor = await getOrgActor();
  if (!actor) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (actor.role !== "owner" && actor.role !== "admin") {
    return NextResponse.json({ error: "Only Owner/Admin can view ownership settings." }, { status: 403 });
  }
  const s = actor.supabase;
  const [{ data: owner }, { data: transfers }, { data: admins }] = await Promise.all([
    s.from("profiles").select("id, full_name, email").eq("company_id", actor.companyId).eq("role", "owner").maybeSingle(),
    s.from("ownership_transfers")
      .select("id, from_user, to_user, status, note, created_at, expires_at")
      .eq("company_id", actor.companyId).eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .limit(1),
    actor.role === "owner"
      ? s.from("profiles").select("id, full_name, email").eq("company_id", actor.companyId)
          .eq("role", "admin").eq("status", "active").order("full_name")
      : Promise.resolve({ data: [] as { id: string; full_name: string; email: string }[] }),
  ]);
  const pending = transfers?.[0] || null;
  let pendingNames: Record<string, string> = {};
  if (pending) {
    const { data: people } = await s.from("profiles").select("id, full_name, email")
      .in("id", [pending.from_user, pending.to_user]);
    pendingNames = Object.fromEntries((people || []).map((p) => [p.id, p.full_name || p.email || "Member"]));
  }
  return NextResponse.json({
    me: { id: actor.userId, role: actor.role },
    owner,
    pending: pending ? { ...pending, from_name: pendingNames[pending.from_user], to_name: pendingNames[pending.to_user] } : null,
    admins: admins || [],
  });
}

async function passwordIsValid(email: string, password: string): Promise<boolean> {
  const client = createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) return false;
  // Revoke only the temporary session created for this check.
  await client.auth.signOut({ scope: "local" }).catch(() => undefined);
  return true;
}

function mailHtml(title: string, lines: string[]) {
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  return `<div style="font-family:Arial;max-width:560px;margin:auto"><h2>${esc(title)}</h2>${lines
    .map((l) => `<p>${esc(l)}</p>`).join("")}<p style="color:#64748b;font-size:12px">If you did not expect this, contact your organization Owner or Connect@systemmaster.in.</p></div>`;
}

async function notifyByEmail(admin: ReturnType<typeof createAdminClient>, userIds: string[], subject: string, lines: string[]) {
  try {
    const { data } = await admin.from("profiles").select("email").in("id", userIds);
    await Promise.all((data || []).filter((p) => p.email).map((p) =>
      sendGmailMessage(p.email as string, subject, mailHtml(subject, lines)).catch(() => undefined)));
  } catch {
    /* email is best effort; the in-app notification is already created */
  }
}

export async function POST(req: Request) {
  const actor = await getOrgActor();
  if (!actor) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const password = typeof body.password === "string" ? body.password : "";
  if (!["initiate", "accept", "cancel", "decline"].includes(action)) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
  if (!password) return NextResponse.json({ error: "Please enter your password to confirm." }, { status: 400 });

  if (!(await rateLimit(`ownership:${actor.userId}`, 5, 900))) {
    return NextResponse.json({ error: "Too many attempts. Please try again in 15 minutes." }, { status: 429 });
  }

  const { data: { user } } = await actor.supabase.auth.getUser();
  if (!user?.email || !(await passwordIsValid(user.email, password))) {
    return NextResponse.json({
      error: "Password is incorrect. If you sign in with Google, set a password first with Forgot password.",
    }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: company } = await admin.from("companies").select("name").eq("id", actor.companyId).maybeSingle();
  const orgName = company?.name || "your organization";

  try {
    if (action === "initiate") {
      const to = String(body.to_user_id || "");
      if (!UUID.test(to)) return NextResponse.json({ error: "Choose the new owner." }, { status: 400 });
      const { data, error } = await admin.rpc("ownership_transfer_initiate", {
        p_actor: actor.userId, p_to: to, p_note: String(body.note || "").slice(0, 300),
      });
      if (error) throw error;
      await notifyByEmail(admin, [to], `Ownership transfer request — ${orgName}`, [
        `You have been asked to become the Owner of ${orgName} on SM HRMS.`,
        "Sign in and open Settings → Ownership & Administration to accept or decline. The request is valid for 72 hours.",
      ]);
      return NextResponse.json({ ok: true, transfer: data });
    }

    const transferId = String(body.transfer_id || "");
    if (!UUID.test(transferId)) return NextResponse.json({ error: "Transfer request not found." }, { status: 400 });

    if (action === "accept") {
      const { data, error } = await admin.rpc("ownership_transfer_accept", { p_actor: actor.userId, p_transfer: transferId });
      if (error) throw error;
      const t = data as { from_user: string; to_user: string };
      await notifyByEmail(admin, [t.from_user, t.to_user], `Ownership of ${orgName} transferred`, [
        `Ownership of ${orgName} on SM HRMS has been transferred.`,
        "The previous Owner is now an Admin. The new Owner controls billing, Admin roles and organization deletion.",
      ]);
      return NextResponse.json({ ok: true, transfer: data });
    }

    const { data, error } = await admin.rpc("ownership_transfer_cancel", { p_actor: actor.userId, p_transfer: transferId });
    if (error) throw error;
    return NextResponse.json({ ok: true, transfer: data });
  } catch (e) {
    return NextResponse.json({ error: friendlyError(e) }, { status: 400 });
  }
}
