"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card, inputCls } from "@/components/ui";
import type { Profile } from "@/lib/types";
import { Upload, Check, User, Camera } from "lucide-react";

export default function ProfilePage() {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [me, setMe] = useState<Profile | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [f, setF] = useState({ full_name: "", phone: "", date_of_birth: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const { data: p } = await supabase
      .from("profiles").select("*").eq("id", auth.user!.id).single();
    setMe(p as Profile);
    setAvatar(p?.avatar_url || null);
    setF({
      full_name: p?.full_name || "",
      phone: p?.phone || "",
      date_of_birth: p?.date_of_birth || "",
    });
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const upload = async (file: File) => {
    setError("");
    if (file.size > 3 * 1024 * 1024) return setError("Photo must be under 3 MB.");
    setUploading(true);

    const ext = file.name.split(".").pop();
    const path = `${me!.id}/avatar-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("avatars").upload(path, file, { upsert: true });

    if (upErr) { setUploading(false); return setError(upErr.message); }

    const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    await supabase.from("profiles").update({ avatar_url: url }).eq("id", me!.id);

    setAvatar(url);
    setUploading(false);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    const { error } = await supabase.from("profiles").update({
      full_name: f.full_name,
      phone: f.phone || null,
      date_of_birth: f.date_of_birth || null,
    }).eq("id", me!.id);
    setSaving(false);
    if (error) return setError(error.message);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    load();
  };

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>;

  return (
    <div>
      <PageHeader title="My profile" subtitle="Your photo and personal details." />

      <div className="max-w-2xl space-y-5">
        <Card>
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
            <Camera className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Profile photo</h2>
          </div>
          <div className="flex items-center gap-5 p-5">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="h-20 w-20 rounded-full border border-slate-200 object-cover" />
            ) : (
              <div className="grid h-20 w-20 place-items-center rounded-full bg-slate-100">
                <User className="h-8 w-8 text-slate-300" />
              </div>
            )}
            <div>
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading…" : avatar ? "Change photo" : "Upload photo"}
              </button>
              <p className="mt-2 text-xs text-slate-500">
                JPG or PNG, up to 3 MB. Visible in the employee directory.
              </p>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file); }} />
            </div>
          </div>
        </Card>

        <Card>
          <div className="border-b border-slate-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-900">Personal details</h2>
          </div>
          <div className="space-y-4 p-5">
            <div>
              <label className="text-sm font-medium text-slate-700">Full name</label>
              <input className={`mt-1.5 ${inputCls}`} value={f.full_name}
                onChange={(e) => set("full_name", e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Mobile number</label>
                <input className={`mt-1.5 ${inputCls}`} value={f.phone}
                  onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Date of birth</label>
                <input type="date" className={`mt-1.5 ${inputCls}`} value={f.date_of_birth}
                  onChange={(e) => set("date_of_birth", e.target.value)} />
                <p className="mt-1 text-xs text-slate-500">Used for birthday wishes.</p>
              </div>
            </div>

            <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
              <ReadOnly label="Email" value={me?.email || "—"} />
              <ReadOnly label="Employee code" value={me?.employee_code || "—"} />
              <ReadOnly label="Department" value={me?.department || "—"} />
              <ReadOnly label="Designation" value={me?.designation || "—"} />
            </div>

            {error && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
            )}

            <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
              <button onClick={save} disabled={saving}
                className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800 disabled:opacity-60">
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
      </div>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-slate-700">{value}</p>
    </div>
  );
}
