"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Cake, Plane, MessageCircle, Users } from "lucide-react";

export default function TodayUpdates() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"company" | "department">("company");
  const [myDepartment, setMyDepartment] = useState("");

  const load = useCallback(async () => {
    const [{ data }, { data: auth }] = await Promise.all([
      supabase.rpc("today_updates"),
      supabase.auth.getUser(),
    ]);
    setItems(data || []);
    if (auth.user) {
      const { data: me } = await supabase.from("profiles")
        .select("department, company_id").eq("id", auth.user.id).maybeSingle();
      setMyDepartment(String(me?.department || ""));
      if (me?.company_id) {
        const { data: company } = await supabase.from("companies")
          .select("today_scope").eq("id", me.company_id).maybeSingle();
        setScope(company?.today_scope === "department" ? "department" : "company");
      }
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  if (loading || items.length === 0) return null;

  const visible = scope === "department" && myDepartment
    ? items.filter((i) => String(i.department || "") === myDepartment)
    : items;
  const birthdays = visible.filter((i) => i.kind === "birthday");
  const onLeave = visible.filter((i) => i.kind === "on_leave");

  const initials = (n: string) =>
    (n || "U").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const Avatar = ({ p, ring }: { p: any; ring: string }) =>
    p.avatar_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={p.avatar_url} alt=""
        className={`h-9 w-9 shrink-0 rounded-full border-2 object-cover ${ring}`} />
    ) : (
      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 bg-white text-xs font-semibold text-slate-600 ${ring}`}>
        {initials(p.full_name)}
      </div>
    );

  return (
    <div className="mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <Users className="h-3.5 w-3.5" /> Today updates
        </p>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
          {scope === "department" && myDepartment ? `${myDepartment} department` : "Whole company"}
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
      {birthdays.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <Cake className="h-4 w-4" /> Birthdays today
          </p>
          <ul className="mt-3 space-y-2.5">
            {birthdays.map((b) => (
              <li key={b.employee_id} className="flex items-center gap-3">
                <Avatar p={b} ring="border-amber-300" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{b.full_name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {b.designation || "—"}{b.department && ` · ${b.department}`}
                  </p>
                </div>
                <a
                  href={b.phone
                    ? `https://wa.me/${String(b.phone).replace(/\D/g, "")}?text=${encodeURIComponent(`Happy Birthday ${b.full_name}! Wishing you a wonderful year ahead. 🎉`)}`
                    : `https://wa.me/?text=${encodeURIComponent(`Happy Birthday ${b.full_name}! Wishing you a wonderful year ahead. 🎉`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Wish
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {onLeave.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Plane className="h-4 w-4 text-slate-400" /> On leave today
          </p>
          <ul className="mt-3 space-y-2.5">
            {onLeave.map((l) => (
              <li key={l.employee_id} className="flex items-center gap-3">
                <Avatar p={l} ring="border-slate-200" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{l.full_name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {l.designation || "—"}{l.department && ` · ${l.department}`}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  {l.detail}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      </div>
    </div>
  );
}
