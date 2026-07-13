"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card, inputCls } from "@/components/ui";
import { Building2, CreditCard, Upload, Check, ImageIcon, Clock } from "lucide-react";

export default function SettingsForm({
  company,
  activeUsers,
}: {
  company: any;
  activeUsers: number;
}) {
  const supabase = createClient();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [f, setF] = useState({
    name: company?.name || "",
    industry: company?.industry || "",
    size: company?.size || "",
    address: company?.address || "",
    city: company?.city || "",
    state: company?.state || "",
    pincode: company?.pincode || "",
    phone: company?.phone || "",
    email: company?.email || "",
    website: company?.website || "",
    gst_number: company?.gst_number || "",
    work_start: company?.work_start?.slice(0, 5) || "09:30",
    work_end: company?.work_end?.slice(0, 5) || "18:30",
    grace_minutes: String(company?.grace_minutes ?? 15),
    half_day_minutes: String(company?.half_day_minutes ?? 240),
    casual_leave_annual: String(company?.casual_leave_annual ?? 12),
    sick_leave_annual: String(company?.sick_leave_annual ?? 6),
    earned_leave_annual: String(company?.earned_leave_annual ?? 15),
    short_leave_per_month: String(company?.short_leave_per_month ?? 2),
    short_leave_hours: String(company?.short_leave_hours ?? 2),
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const [logoUrl, setLogoUrl] = useState<string | null>(company?.logo_url || null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const uploadLogo = async (file: File) => {
    setError("");
    if (file.size > 2 * 1024 * 1024) {
      return setError("Logo must be under 2 MB.");
    }
    setUploading(true);

    const ext = file.name.split(".").pop();
    const path = `${company.id}/logo-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("company-logos")
      .upload(path, file, { upsert: true });

    if (upErr) {
      setUploading(false);
      return setError(upErr.message);
    }

    const { data } = supabase.storage.from("company-logos").getPublicUrl(path);
    const url = data.publicUrl;

    await supabase.from("companies").update({ logo_url: url }).eq("id", company.id);

    setLogoUrl(url);
    setUploading(false);
    router.refresh();
  };

  const save = async () => {
    setSaving(true);
    setError("");
    const payload = {
      ...f,
      grace_minutes: parseInt(f.grace_minutes) || 0,
      half_day_minutes: parseInt(f.half_day_minutes) || 240,
      casual_leave_annual: parseFloat(f.casual_leave_annual) || 0,
      sick_leave_annual: parseFloat(f.sick_leave_annual) || 0,
      earned_leave_annual: parseFloat(f.earned_leave_annual) || 0,
      short_leave_per_month: parseInt(f.short_leave_per_month) || 0,
      short_leave_hours: parseFloat(f.short_leave_hours) || 0,
    };
    const { error } = await supabase
      .from("companies")
      .update(payload)
      .eq("id", company.id);
    setSaving(false);

    if (error) return setError(error.message);

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    router.refresh();
  };

  const monthly = activeUsers * (company?.price_per_user ?? 99);

  return (
    <div>
      <PageHeader title="Settings" subtitle="Organization details, branding and billing." />

      <div className="space-y-5">
        {/* Branding */}
        <Card>
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
            <ImageIcon className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Company logo</h2>
          </div>
          <div className="flex items-center gap-5 p-5">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Company logo" className="h-full w-full object-contain" />
              ) : (
                <Building2 className="h-7 w-7 text-slate-300" />
              )}
            </div>
            <div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading…" : logoUrl ? "Change logo" : "Upload logo"}
              </button>
              <p className="mt-2 text-xs text-slate-500">PNG or JPG, up to 2 MB.</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadLogo(file);
                }}
              />
            </div>
          </div>
        </Card>

        {/* Organization details */}
        <Card>
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
            <Building2 className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Organization details</h2>
          </div>

          <div className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Organization name</label>
                <input className={`mt-1.5 ${inputCls}`} value={f.name} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Industry</label>
                <input className={`mt-1.5 ${inputCls}`} value={f.industry} onChange={(e) => set("industry", e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Address</label>
              <input className={`mt-1.5 ${inputCls}`} placeholder="Street address"
                value={f.address} onChange={(e) => set("address", e.target.value)} />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-sm font-medium text-slate-700">City</label>
                <input className={`mt-1.5 ${inputCls}`} value={f.city} onChange={(e) => set("city", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">State</label>
                <input className={`mt-1.5 ${inputCls}`} value={f.state} onChange={(e) => set("state", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">PIN code</label>
                <input className={`mt-1.5 ${inputCls}`} value={f.pincode} onChange={(e) => set("pincode", e.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Phone</label>
                <input className={`mt-1.5 ${inputCls}`} value={f.phone} onChange={(e) => set("phone", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Email</label>
                <input className={`mt-1.5 ${inputCls}`} value={f.email} onChange={(e) => set("email", e.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Website</label>
                <input className={`mt-1.5 ${inputCls}`} placeholder="https://" value={f.website} onChange={(e) => set("website", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">GST number</label>
                <input className={`mt-1.5 ${inputCls}`} value={f.gst_number} onChange={(e) => set("gst_number", e.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Work start</label>
                <input type="time" className={`mt-1.5 ${inputCls}`} value={f.work_start} onChange={(e) => set("work_start", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Work end</label>
                <input type="time" className={`mt-1.5 ${inputCls}`} value={f.work_end} onChange={(e) => set("work_end", e.target.value)} />
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
            )}

            <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
              <button
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
              {saved && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                  <Check className="h-4 w-4" /> Saved
                </span>
              )}
            </div>
          </div>
        </Card>


        {/* Attendance & leave policy */}
        <Card>
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
            <Clock className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Attendance & leave policy</h2>
          </div>

          <div className="space-y-5 p-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Attendance</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Grace period (min)</label>
                  <input type="number" className={`mt-1.5 ${inputCls}`} value={f.grace_minutes}
                    onChange={(e) => set("grace_minutes", e.target.value)} />
                  <p className="mt-1 text-xs text-slate-400">Late marked after this.</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Half-day after (min)</label>
                  <input type="number" className={`mt-1.5 ${inputCls}`} value={f.half_day_minutes}
                    onChange={(e) => set("half_day_minutes", e.target.value)} />
                  <p className="mt-1 text-xs text-slate-400">Below this = half day.</p>
                </div>
                <div />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Annual leave quota</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Casual (CL)</label>
                  <input type="number" step="0.5" className={`mt-1.5 ${inputCls}`} value={f.casual_leave_annual}
                    onChange={(e) => set("casual_leave_annual", e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Sick (SL)</label>
                  <input type="number" step="0.5" className={`mt-1.5 ${inputCls}`} value={f.sick_leave_annual}
                    onChange={(e) => set("sick_leave_annual", e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Earned (PL)</label>
                  <input type="number" step="0.5" className={`mt-1.5 ${inputCls}`} value={f.earned_leave_annual}
                    onChange={(e) => set("earned_leave_annual", e.target.value)} />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Short leave</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Allowed per month</label>
                  <input type="number" className={`mt-1.5 ${inputCls}`} value={f.short_leave_per_month}
                    onChange={(e) => set("short_leave_per_month", e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Max hours each</label>
                  <input type="number" step="0.5" className={`mt-1.5 ${inputCls}`} value={f.short_leave_hours}
                    onChange={(e) => set("short_leave_hours", e.target.value)} />
                </div>
                <div />
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
              <button onClick={save} disabled={saving}
                className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800 disabled:opacity-60">
                {saving ? "Saving…" : "Save policy"}
              </button>
              {saved && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                  <Check className="h-4 w-4" /> Saved
                </span>
              )}
            </div>
          </div>
        </Card>

        {/* Billing */}
        <Card>
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
            <CreditCard className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Billing</h2>
          </div>
          <div className="p-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm text-slate-500">Current plan</p>
                <p className="mt-0.5 text-lg font-semibold capitalize text-slate-900">
                  {company?.plan}
                  {company?.plan === "trial" && company?.trial_ends_on && (
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      ends {company.trial_ends_on}
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">Estimated monthly</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
                  ₹{monthly.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
            <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
              {activeUsers} active {activeUsers === 1 ? "user" : "users"} × ₹
              {company?.price_per_user ?? 99} per user / month
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
