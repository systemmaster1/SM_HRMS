"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card, Badge, Modal, EmptyState, inputCls } from "@/components/ui";
import { type Profile, isAdminRole } from "@/lib/types";
import { LifeBuoy, Plus, Send, MessageSquare, HelpCircle } from "lucide-react";

const CATEGORIES = [
  { v: "general", l: "General" }, { v: "it", l: "IT" }, { v: "hr", l: "HR" },
  { v: "payroll", l: "Payroll" }, { v: "facilities", l: "Facilities" }, { v: "other", l: "Other" },
];
const STATUSES = ["open", "in_progress", "on_hold", "resolved", "closed"];

export default function HelpDeskPage() {
  const supabase = createClient();

  const [me, setMe] = useState<Profile | null>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"mine" | "assigned" | "all">("mine");

  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [f, setF] = useState({ subject: "", description: "", category: "general", priority: "medium" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const [reply, setReply] = useState("");
  const [isRequest, setIsRequest] = useState(false);
  const [plan, setPlan] = useState("");
  const [target, setTarget] = useState("");

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const { data: p } = await supabase
      .from("profiles").select("*").eq("id", auth.user!.id).single();
    setMe(p as Profile);

    const { data: t } = await supabase
      .from("tickets")
      .select("*, raiser:raised_by(full_name, department), assignee:assigned_to(full_name)")
      .order("created_at", { ascending: false });
    setTickets(t || []);

    if (isAdminRole((p as Profile)?.role)) {
      const { data: m } = await supabase
        .from("profiles").select("*").eq("status", "active").order("full_name");
      setMembers((m as Profile[]) || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (t: any) => {
    setDetail(t);
    setPlan(t.plan || "");
    setTarget(t.target_date || "");
    setReply("");
    setIsRequest(false);
    const { data } = await supabase
      .from("ticket_comments")
      .select("*, author:author_id(full_name)")
      .eq("ticket_id", t.id)
      .order("created_at");
    setComments(data || []);
  };

  const create = async () => {
    setError("");
    if (!f.subject.trim()) return setError("Please enter a subject.");
    setSaving(true);

    const { data: created, error: err } = await supabase.from("tickets").insert({
      company_id: me!.company_id,
      raised_by: me!.id,
      subject: f.subject.trim(),
      description: f.description,
      category: f.category,
      priority: f.priority,
    }).select().single();

    if (err) { setSaving(false); return setError(err.message); }

    // Notify admins
    const { data: admins } = await supabase
      .from("profiles").select("id").in("role", ["owner", "admin"]);

    if (admins?.length) {
      await supabase.from("notifications").insert(
        admins.map((a: any) => ({
          company_id: me!.company_id,
          user_id: a.id,
          title: `New ticket #${created.ticket_no}`,
          body: `${me!.full_name}: ${f.subject}`,
          kind: "ticket",
          link: "/helpdesk",
        }))
      );
    }

    setSaving(false);
    setOpen(false);
    setF({ subject: "", description: "", category: "general", priority: "medium" });
    load();
  };

  const updateTicket = async (patch: any) => {
    await supabase.from("tickets").update(patch).eq("id", detail.id);

    if (patch.status) {
      await supabase.from("notifications").insert({
        company_id: me!.company_id,
        user_id: detail.raised_by,
        title: `Ticket #${detail.ticket_no} — ${patch.status.replace("_", " ")}`,
        body: detail.subject,
        kind: "ticket",
        link: "/helpdesk",
      });
    }
    await load();
    const updated = { ...detail, ...patch };
    setDetail(updated);
  };

  const send = async () => {
    if (!reply.trim()) return;
    await supabase.from("ticket_comments").insert({
      ticket_id: detail.id,
      company_id: me!.company_id,
      author_id: me!.id,
      body: reply.trim(),
      is_request: isRequest,
    });

    const notifyUser = detail.raised_by === me!.id ? detail.assigned_to : detail.raised_by;
    if (notifyUser) {
      await supabase.from("notifications").insert({
        company_id: me!.company_id,
        user_id: notifyUser,
        title: isRequest
          ? `Information requested on #${detail.ticket_no}`
          : `New reply on #${detail.ticket_no}`,
        body: reply.trim().slice(0, 90),
        kind: "ticket",
        link: "/helpdesk",
      });
    }

    setReply("");
    setIsRequest(false);
    openDetail(detail);
  };

  const admin = isAdminRole(me?.role);
  const list = tab === "mine"
    ? tickets.filter((t) => t.raised_by === me?.id)
    : tab === "assigned"
      ? tickets.filter((t) => t.assigned_to === me?.id)
      : tickets;

  const openCount = tickets.filter((t) => ["open", "in_progress"].includes(t.status)).length;

  return (
    <div>
      <PageHeader
        title="Help desk"
        subtitle={`${openCount} open ticket${openCount === 1 ? "" : "s"}`}
        action={
          <button onClick={() => setOpen(true)}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800">
            <Plus className="h-4 w-4" /> Raise ticket
          </button>
        }
      />

      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
        <Tab on={tab === "mine"} onClick={() => setTab("mine")}>My tickets</Tab>
        <Tab on={tab === "assigned"} onClick={() => setTab("assigned")}>Assigned to me</Tab>
        {admin && <Tab on={tab === "all"} onClick={() => setTab("all")}>All tickets</Tab>}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <Card>
          {list.length === 0 ? (
            <EmptyState icon={LifeBuoy} title="No tickets"
              hint="Raise a ticket and the team will pick it up." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {list.map((t) => (
                <li key={t.id}>
                  <button onClick={() => openDetail(t)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50">
                    <span className="grid h-9 w-12 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-bold tabular-nums text-slate-600">
                      #{t.ticket_no}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-slate-900">{t.subject}</p>
                        <Badge value={t.priority} />
                        <Badge value={t.status} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {t.raiser?.full_name}
                        {t.assignee?.full_name && ` → ${t.assignee.full_name}`}
                        {" · "}
                        {CATEGORIES.find((c) => c.v === t.category)?.l}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* New ticket */}
      <Modal open={open} onClose={() => setOpen(false)} title="Raise a ticket">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Subject *</label>
            <input className={`mt-1.5 ${inputCls}`} placeholder="Laptop not booting"
              value={f.subject} onChange={(e) => set("subject", e.target.value)} autoFocus />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Description</label>
            <textarea className={`mt-1.5 ${inputCls}`} rows={4}
              placeholder="Describe the issue in detail"
              value={f.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Category</label>
              <select className={`mt-1.5 ${inputCls}`} value={f.category}
                onChange={(e) => set("category", e.target.value)}>
                {CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Priority</label>
              <select className={`mt-1.5 ${inputCls}`} value={f.priority}
                onChange={(e) => set("priority", e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
          )}

          <button onClick={create} disabled={saving}
            className="w-full rounded-lg bg-brand-700 py-2.5 font-medium text-white transition hover:bg-brand-800 disabled:opacity-60">
            {saving ? "Submitting…" : "Submit ticket"}
          </button>
        </div>
      </Modal>

      {/* Ticket detail */}
      <Modal open={!!detail} onClose={() => setDetail(null)}
        title={detail ? `Ticket #${detail.ticket_no}` : ""}>
        {detail && (
          <div className="space-y-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-slate-900">{detail.subject}</p>
                <Badge value={detail.priority} />
                <Badge value={detail.status} />
              </div>
              {detail.description && (
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-600">
                  {detail.description}
                </p>
              )}
              <p className="mt-2 text-xs text-slate-400">
                Raised by {detail.raiser?.full_name} ·{" "}
                {new Date(detail.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </p>
            </div>

            {/* Admin controls */}
            {admin && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Resolution
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Status</label>
                    <select className={`mt-1 ${inputCls}`} value={detail.status}
                      onChange={(e) => updateTicket({
                        status: e.target.value,
                        resolved_at: e.target.value === "resolved" ? new Date().toISOString() : null,
                      })}>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s.replace("_", " ")}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Assign to</label>
                    <select className={`mt-1 ${inputCls}`} value={detail.assigned_to || ""}
                      onChange={(e) => updateTicket({ assigned_to: e.target.value || null })}>
                      <option value="">Unassigned</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>{m.full_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600">Resolution plan</label>
                  <textarea className={`mt-1 ${inputCls}`} rows={3}
                    placeholder="Steps to resolve this ticket"
                    value={plan} onChange={(e) => setPlan(e.target.value)} />
                </div>

                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-slate-600">Target date</label>
                    <input type="date" className={`mt-1 ${inputCls}`} value={target}
                      onChange={(e) => setTarget(e.target.value)} />
                  </div>
                  <button onClick={() => updateTicket({ plan, target_date: target || null })}
                    className="rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800">
                    Save plan
                  </button>
                </div>
              </div>
            )}

            {/* Plan visible to raiser */}
            {!admin && detail.plan && (
              <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
                  Resolution plan
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-700">{detail.plan}</p>
                {detail.target_date && (
                  <p className="mt-2 text-xs text-slate-500">Target: {detail.target_date}</p>
                )}
              </div>
            )}

            {/* Conversation */}
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <MessageSquare className="h-4 w-4" /> Conversation
              </p>

              <ul className="max-h-52 space-y-2 overflow-y-auto">
                {comments.length === 0 && (
                  <li className="text-xs text-slate-400">No messages yet.</li>
                )}
                {comments.map((c) => (
                  <li key={c.id}
                    className={`rounded-lg p-3 ${
                      c.is_request ? "border border-amber-200 bg-amber-50" : "bg-slate-50"
                    }`}>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-slate-900">{c.author?.full_name}</p>
                      {c.is_request && (
                        <span className="flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          <HelpCircle className="h-2.5 w-2.5" /> Needs input
                        </span>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{c.body}</p>
                  </li>
                ))}
              </ul>

              <div className="mt-3">
                <textarea className={inputCls} rows={2} placeholder="Write a message…"
                  value={reply} onChange={(e) => setReply(e.target.value)} />
                <div className="mt-2 flex items-center justify-between">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                    <input type="checkbox" checked={isRequest}
                      onChange={(e) => setIsRequest(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-brand-700" />
                    Request information
                  </label>
                  <button onClick={send} disabled={!reply.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-800 disabled:opacity-50">
                    <Send className="h-3.5 w-3.5" /> Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Tab({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
        on ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
      }`}>
      {children}
    </button>
  );
}
