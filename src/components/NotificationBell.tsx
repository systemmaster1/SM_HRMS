"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Bell, Check, Send } from "lucide-react";

/**
 * Header bell. Updates instantly through Supabase Realtime (with a slow
 * fallback refresh), marks an item read when it is opened, and can send a
 * test notification to check that phone push works.
 */
export default function NotificationBell({
  userId, companyId,
}: {
  userId: string;
  companyId: string | null;
}) {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [testState, setTestState] = useState<"" | "sending" | "sent" | "error">("");
  const loading = useRef(false);

  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    setItems(data || []);
    loading.current = false;
  }, [supabase, userId]);

  useEffect(() => {
    load();

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => load())
      .subscribe();

    // Fallback in case the realtime connection drops.
    const t = setInterval(load, 5 * 60 * 1000);
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [load, supabase, userId]);

  const unread = items.filter((n) => !n.is_read).length;

  const markAll = async () => {
    const ids = items.filter((n) => !n.is_read).map((n) => n.id);
    if (!ids.length) return;
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase.from("notifications").update({ is_read: true }).in("id", ids);
  };

  const markOne = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  };

  const sendTest = async () => {
    if (!companyId) return;
    setTestState("sending");
    const { error } = await supabase.from("notifications").insert({
      company_id: companyId,
      user_id: userId,
      title: "Test notification",
      body: "Push notifications are working on this device.",
      kind: "test",
      link: "/dashboard",
    });
    setTestState(error ? "error" : "sent");
    setTimeout(() => setTestState(""), 6000);
  };

  const ago = (d: string) => {
    const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    if (m < 1440) return `${Math.round(m / 60)}h ago`;
    return `${Math.round(m / 1440)}d ago`;
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Notifications"
        className="relative grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-2 top-[calc(3.75rem+env(safe-area-inset-top))] z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notifications</p>
              {unread > 0 && (
                <button onClick={markAll}
                  className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800 dark:text-brand-300">
                  <Check className="h-3 w-3" /> Mark all read
                </button>
              )}
            </div>

            <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
              {items.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-slate-400">Nothing new.</li>
              ) : (
                items.map((n) => (
                  <li key={n.id} className={n.is_read ? "" : "bg-brand-50/50 dark:bg-brand-500/10"}>
                    <Link href={n.link || "/dashboard"}
                      onClick={() => { setOpen(false); if (!n.is_read) markOne(n.id); }}
                      className="block px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/60">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{n.title}</p>
                      {n.body && <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{n.body}</p>}
                      <p className="mt-1 text-[11px] text-slate-400">{ago(n.created_at)}</p>
                    </Link>
                  </li>
                ))
              )}
            </ul>

            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
              <button onClick={sendTest} disabled={testState === "sending"}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-brand-700 disabled:opacity-60 dark:text-slate-400">
                <Send className="h-3 w-3" />
                {testState === "sending" ? "Sending…" : "Send me a test notification"}
              </button>
              {testState === "sent" && <span className="text-[11px] text-emerald-600">Sent — check your phone</span>}
              {testState === "error" && <span className="text-[11px] text-rose-600">Could not send</span>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
