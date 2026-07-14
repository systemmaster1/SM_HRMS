"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Bell, Check } from "lucide-react";

export default function NotificationBell() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(15);
    setItems(data || []);
  }, [supabase]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const unread = items.filter((n) => !n.is_read).length;

  const markAll = async () => {
    const ids = items.filter((n) => !n.is_read).map((n) => n.id);
    if (!ids.length) return;
    await supabase.from("notifications").update({ is_read: true }).in("id", ids);
    load();
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
      <button onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white">
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-50 mb-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
              {unread > 0 && (
                <button onClick={markAll}
                  className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800">
                  <Check className="h-3 w-3" /> Mark all read
                </button>
              )}
            </div>

            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
              {items.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-slate-400">
                  Nothing new.
                </li>
              ) : (
                items.map((n) => (
                  <li key={n.id} className={n.is_read ? "" : "bg-brand-50/40"}>
                    <Link href={n.link || "#"} onClick={() => setOpen(false)}
                      className="block px-4 py-3 transition hover:bg-slate-50">
                      <p className="text-sm font-medium text-slate-900">{n.title}</p>
                      {n.body && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{n.body}</p>}
                      <p className="mt-1 text-[11px] text-slate-400">{ago(n.created_at)}</p>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
