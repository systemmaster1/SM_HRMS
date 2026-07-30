"use client";

import { useEffect, useState } from "react";
import { Save, Building2, Sheet } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Settings — company profile + Google Sheets live-sync configuration. */
export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [company, setCompany] = useState<any>({ name: "", founder: "", email: "", phone: "", website: "", gstin: "", address: "" });
  const [sheet, setSheet] = useState<any>({ appsScriptUrl: "", apiKey: "" });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (data.company) setCompany((c: any) => ({ ...c, ...data.company }));
        if (data.sheetSync) setSheet((s: any) => ({ ...s, ...data.sheetSync }));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company, sheetSync: sheet }),
    });
    const data = await res.json();
    setMsg(res.ok ? "Settings saved." : data.error || "Could not save.");
    setSaving(false);
  }

  if (loading) return <p className="text-sm text-ink-muted">Loading settings…</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink dark:text-slate-100">Settings</h1>
          <p className="text-sm text-ink-muted">Company profile and integrations.</p>
        </div>
        <Button onClick={save} loading={saving}><Save className="h-4 w-4" /> Save changes</Button>
      </div>

      {msg && <p className="rounded-lg bg-brand-50 px-4 py-2.5 text-sm text-brand-700">{msg}</p>}

      {/* Company profile */}
      <Card icon={<Building2 className="h-5 w-5" />} title="Company profile">
        <Field label="Company name" value={company.name} onChange={(v) => setCompany({ ...company, name: v })} />
        <Field label="Founder" value={company.founder} onChange={(v) => setCompany({ ...company, founder: v })} />
        <Field label="Email" value={company.email} onChange={(v) => setCompany({ ...company, email: v })} />
        <Field label="Phone" value={company.phone} onChange={(v) => setCompany({ ...company, phone: v })} />
        <Field label="Website" value={company.website} onChange={(v) => setCompany({ ...company, website: v })} />
        <Field label="GSTIN" value={company.gstin} onChange={(v) => setCompany({ ...company, gstin: v })} />
        <Field label="Address" value={company.address} onChange={(v) => setCompany({ ...company, address: v })} />
      </Card>

      {/* Google Sheets sync */}
      <Card icon={<Sheet className="h-5 w-5" />} title="Google Sheets live sync">
        <Field label="Apps Script Web App URL" value={sheet.appsScriptUrl} onChange={(v) => setSheet({ ...sheet, appsScriptUrl: v })} />
        <Field label="API key" value={sheet.apiKey} onChange={(v) => setSheet({ ...sheet, apiKey: v })} />
        <p className="col-span-full text-xs text-ink-muted">
          Paste the Web App URL from your deployed Apps Script (see google-apps-script/Code.gs) and set an API key that matches the script.
        </p>
      </Card>
    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-white/10 dark:bg-[rgb(var(--surface))]">
      <div className="mb-4 flex items-center gap-2 text-brand-600">
        {icon}<h3 className="font-display text-sm font-semibold text-ink dark:text-slate-100">{title}</h3>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-muted">{label}</span>
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-200 dark:border-white/10 dark:bg-white/5"
      />
    </label>
  );
}
