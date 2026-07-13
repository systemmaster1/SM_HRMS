import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import { MapPin } from "lucide-react";

export default async function FieldVisitsPage() {
  const supabase = await createClient();
  const { data: visits } = await supabase
    .from("field_visits")
    .select("*, profiles:employee_id(full_name)")
    .order("visit_date", { ascending: false })
    .limit(50);

  const time = (t: string | null) =>
    t ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <div>
      <PageHeader
        title="Field visits"
        subtitle="GPS-verified client visits across your team."
      />
      <Card>
        {visits && visits.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {visits.map((v: any) => (
              <li key={v.id} className="flex items-start gap-3 px-4 py-3.5">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {v.profiles?.full_name || "Unknown"}
                      {v.client_name && ` · ${v.client_name}`}
                    </p>
                    <Badge value={v.status} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {v.address || "No address recorded"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {v.visit_date}
                    {time(v.check_in_at) && ` · In ${time(v.check_in_at)}`}
                    {time(v.check_out_at) && ` · Out ${time(v.check_out_at)}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={MapPin}
            title="No field visits yet"
            hint="Visits logged from the mobile app will appear here with GPS location."
          />
        )}
      </Card>
    </div>
  );
}
