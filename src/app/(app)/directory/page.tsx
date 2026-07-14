"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { Users, Mail, Phone, Search, Building2 } from "lucide-react";

export default function DirectoryPage() {
  const supabase = createClient();
  const [people, setPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("directory");
    setPeople(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const depts = useMemo(
    () => Array.from(new Set(people.map((p) => p.department).filter(Boolean))).sort(),
    [people]
  );

  const list = people.filter((p) => {
    const matchQ = !q ||
      p.full_name?.toLowerCase().includes(q.toLowerCase()) ||
      p.designation?.toLowerCase().includes(q.toLowerCase()) ||
      p.department?.toLowerCase().includes(q.toLowerCase());
    const matchD = !dept || p.department === dept;
    return matchQ && matchD;
  });

  const initials = (n: string) =>
    (n || "U").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div>
      <PageHeader title="Employee directory" subtitle={`${people.length} colleagues`} />

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, role or department"
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10"
          />
        </div>
        {depts.length > 0 && (
          <select value={dept} onChange={(e) => setDept(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-600">
            <option value="">All departments</option>
            {depts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon={Users} title="No colleagues found"
            hint="Try a different search, or ask your admin to enable the directory." />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <div key={p.id}
              className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-brand-600 hover:shadow-sm">
              <div className="flex items-center gap-3.5">
                {p.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatar_url} alt=""
                    className="h-14 w-14 shrink-0 rounded-full border border-slate-200 object-cover" />
                ) : (
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-50 text-base font-semibold text-brand-700">
                    {initials(p.full_name)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{p.full_name}</p>
                  <p className="truncate text-sm text-slate-500">{p.designation || "—"}</p>
                  {p.department && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                      <Building2 className="h-3 w-3" /> {p.department}
                    </p>
                  )}
                </div>
              </div>

              {(p.email || p.phone) && (
                <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3.5">
                  {p.email && (
                    <a href={`mailto:${p.email}`}
                      className="flex items-center gap-2 text-xs text-slate-500 transition hover:text-brand-700">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{p.email}</span>
                    </a>
                  )}
                  {p.phone && (
                    <a href={`tel:${p.phone}`}
                      className="flex items-center gap-2 text-xs text-slate-500 transition hover:text-brand-700">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span className="tabular-nums">{p.phone}</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
