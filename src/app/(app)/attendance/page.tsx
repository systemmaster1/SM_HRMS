import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import { CalendarCheck } from "lucide-react";

export default async function AttendancePage() {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("attendance")
    .select("*, profiles:employee_id(full_name)")
    .order("work_date", { ascending: false })
    .limit(60);

  const fmt = (t: string | null) =>
    t ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Recent check-ins and check-outs." />
      <Card>
        {rows && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Employee</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Check in</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Check out</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r: any) => (
                  <tr key={r.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {r.profiles?.full_name || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.work_date}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{fmt(r.check_in)}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{fmt(r.check_out)}</td>
                    <td className="px-4 py-3"><Badge value={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={CalendarCheck}
            title="No attendance records"
            hint="Records will appear as your team checks in from the mobile app."
          />
        )}
      </Card>
    </div>
  );
}
