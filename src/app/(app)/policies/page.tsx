"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card, Modal, EmptyState, inputCls } from "@/components/ui";
import { type Profile, isAdminRole } from "@/lib/types";
import { FileText, Upload, Download, Trash2, Plus } from "lucide-react";

const CATEGORIES = [
  { v: "policy", l: "Policy" },
  { v: "handbook", l: "Handbook" },
  { v: "form", l: "Form" },
  { v: "notice", l: "Notice" },
  { v: "other", l: "Other" },
];

export default function PoliciesPage() {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [me, setMe] = useState<Profile | null>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("policy");
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const { data: p } = await supabase
      .from("profiles").select("*").eq("id", auth.user!.id).single();
    setMe(p as Profile);

    const { data: d } = await supabase
      .from("documents")
      .select("*, profiles:uploaded_by(full_name)")
      .order("created_at", { ascending: false });
    setDocs(d || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const upload = async () => {
    setError("");
    if (!title.trim()) return setError("Please enter a title.");
    if (!file) return setError("Please choose a file.");
    if (file.size > 10 * 1024 * 1024) return setError("File must be under 10 MB.");

    setSaving(true);
    const ext = file.name.split(".").pop();
    const path = `${me!.company_id}/${Date.now()}-${title.trim().replace(/[^a-z0-9]/gi, "-").toLowerCase()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("company-docs").upload(path, file);

    if (upErr) { setSaving(false); return setError(upErr.message); }

    const { data } = supabase.storage.from("company-docs").getPublicUrl(path);

    const { error: dbErr } = await supabase.from("documents").insert({
      company_id: me!.company_id,
      title: title.trim(),
      description: desc,
      category,
      file_url: data.publicUrl,
      file_name: file.name,
      file_size: file.size,
      uploaded_by: me!.id,
    });
    setSaving(false);
    if (dbErr) return setError(dbErr.message);

    setOpen(false);
    setTitle(""); setDesc(""); setCategory("policy"); setFile(null);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("documents").delete().eq("id", id);
    load();
  };

  const admin = isAdminRole(me?.role);
  const size = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

  return (
    <div>
      <PageHeader
        title="Policies & documents"
        subtitle="Company policies, handbooks and forms — available to everyone."
        action={
          admin && (
            <button onClick={() => setOpen(true)}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800">
              <Plus className="h-4 w-4" /> Upload
            </button>
          )
        }
      />

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <Card>
          {docs.length === 0 ? (
            <EmptyState icon={FileText} title="No documents yet"
              hint={admin ? "Upload your company policy so every employee can read it." : "Your admin has not uploaded any documents yet."} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-slate-900">{d.title}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                        {d.category}
                      </span>
                    </div>
                    {d.description && (
                      <p className="mt-0.5 truncate text-xs text-slate-500">{d.description}</p>
                    )}
                    <p className="mt-0.5 text-xs text-slate-400">
                      {d.file_name} · {size(d.file_size)}
                      {d.profiles?.full_name && ` · ${d.profiles.full_name}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <a href={d.file_url} target="_blank" rel="noreferrer" title="Open"
                      className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-brand-600 hover:text-brand-700">
                      <Download className="h-4 w-4" />
                    </a>
                    {admin && (
                      <button onClick={() => remove(d.id)} title="Delete"
                        className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-rose-300 hover:text-rose-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Upload document">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Title *</label>
            <input className={`mt-1.5 ${inputCls}`} placeholder="Leave Policy 2026"
              value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Description</label>
            <textarea className={`mt-1.5 ${inputCls}`} rows={2} placeholder="Optional"
              value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Category</label>
            <select className={`mt-1.5 ${inputCls}`} value={category}
              onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">File *</label>
            <button type="button" onClick={() => fileRef.current?.click()}
              className="mt-1.5 flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3.5 py-4 text-sm text-slate-500 transition hover:border-brand-600 hover:text-brand-700">
              <Upload className="h-4 w-4" />
              {file ? file.name : "Choose a file (PDF, DOC, up to 10 MB)"}
            </button>
            <input ref={fileRef} type="file" className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>

          {error && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
          )}

          <button onClick={upload} disabled={saving}
            className="w-full rounded-lg bg-brand-700 py-2.5 font-medium text-white transition hover:bg-brand-800 disabled:opacity-60">
            {saving ? "Uploading…" : "Upload document"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
