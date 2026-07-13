"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card, Badge, Modal, EmptyState, inputCls } from "@/components/ui";
import { type Profile, isAdminRole } from "@/lib/types";
import { Plus, ListChecks } from "lucide-react";

export default function TasksPage() {
  const supabase = createClient();
  const [me, setMe] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState("medium");
  const [due, setDue] = useState("");

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const { data: mine } = await supabase
      .from("profiles").select("*").eq("id", auth.user!.id).single();
    setMe(mine as Profile);

    const { data: t } = await supabase
      .from("tasks")
      .select("*, profiles:assignee_id(full_name)")
      .order("created_at", { ascending: false });
    setTasks(t || []);

    const { data: m } = await supabase
      .from("profiles").select("*").eq("status", "active").order("full_name");
    setMembers((m as Profile[]) || []);

    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const addTask = async () => {
    if (!title.trim() || !me?.company_id) return;
    setSaving(true);
    await supabase.from("tasks").insert({
      company_id: me.company_id,
      title: title.trim(),
      description: desc,
      assignee_id: assignee || null,
      created_by: me.id,
      priority,
      due_date: due || null,
    });
    setSaving(false);
    setOpen(false);
    setTitle(""); setDesc(""); setAssignee(""); setPriority("medium"); setDue("");
    load();
  };

  const cycle = async (t: any) => {
    const next =
      t.status === "todo" ? "in_progress" : t.status === "in_progress" ? "done" : "todo";
    await supabase
      .from("tasks")
      .update({ status: next, completed_at: next === "done" ? new Date().toISOString() : null })
      .eq("id", t.id);
    load();
  };

  const admin = isAdminRole(me?.role);
  const openCount = tasks.filter((t) => t.status !== "done").length;

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle={`${openCount} open · ${tasks.length} total`}
        action={
          admin && (
            <button
              onClick={() => setOpen(true)}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800"
            >
              <Plus className="h-4 w-4" /> New task
            </button>
          )
        }
      />

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <Card>
          {tasks.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={`text-sm font-medium ${
                          t.status === "done"
                            ? "text-slate-400 line-through"
                            : "text-slate-900"
                        }`}
                      >
                        {t.title}
                      </p>
                      <Badge value={t.priority} />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {t.profiles?.full_name ? `Assigned to ${t.profiles.full_name}` : "Unassigned"}
                      {t.due_date && ` · Due ${t.due_date}`}
                    </p>
                  </div>
                  <button onClick={() => cycle(t)} title="Change status">
                    <Badge value={t.status} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={ListChecks}
              title="No tasks yet"
              hint={admin ? "Create a task to assign work to your team." : "Tasks assigned to you will appear here."}
            />
          )}
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New task">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              className={`mt-1.5 ${inputCls}`}
              placeholder="Follow up with client"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Description</label>
            <textarea
              className={`mt-1.5 ${inputCls}`}
              rows={3}
              placeholder="Optional details"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Assign to</label>
            <select
              className={`mt-1.5 ${inputCls}`}
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Priority</label>
              <select
                className={`mt-1.5 ${inputCls}`}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Due date</label>
              <input
                type="date"
                className={`mt-1.5 ${inputCls}`}
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </div>
          </div>
          <button
            onClick={addTask}
            disabled={saving}
            className="w-full rounded-lg bg-brand-700 py-2.5 font-medium text-white transition hover:bg-brand-800 disabled:opacity-60"
          >
            {saving ? "Creating…" : "Create task"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
