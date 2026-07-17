"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal, inputCls, Badge } from "@/components/ui";
import { MotionButton } from "@/components/motion";
import {
  User, CreditCard, FileText, Upload, Trash2, Download,
  ShieldOff, ShieldCheck, UserMinus, UserCheck, AlertTriangle,
} from "lucide-react";

const CATEGORIES = [
  { v: "id_proof", l: "ID proof" },
  { v: "address_proof", l: "Address proof" },
  { v: "bank_proof", l: "Bank proof" },
  { v: "offer_letter", l: "Offer letter" },
  { v: "education", l: "Education" },
  { v: "other", l: "Other" },
];

export default function EmployeeDetail({
  employee,
  onClose,
  onChanged,
}: {
  employee: any;
  onClose: () => void;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<"details" | "documents">("details");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [docs, setDocs] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docCategory, setDocCategory] = useState("id_proof");
  const [confirming, setConfirming] = useState<"disabled" | "left" | null>(null);

  const [f, setF] = useState({
    address: employee.address || "",
    city: employee.city || "",
    state: employee.state || "",
    pincode: employee.pincode || "",
    bank_account_name: employee.bank_account_name || "",
    bank_account_number: employee.bank_account_number || "",
    bank_ifsc: employee.bank_ifsc || "",
    bank_name: employee.bank_name || "",
    emergency_contact_name: employee.emergency_contact_name || "",
    emergency_contact_phone: employee.emergency_contact_phone || "",
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const loadDocs = useCallback(async () => {
    const { data } = await supabase
      .from("employee_documents")
      .select("*")
      .eq("employee_id", employee.id)
      .order("created_at", { ascending: false });
    setDocs(data || []);
  }, [supabase, employee.id]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const saveDetails = async () => {
    setSaving(true);
    setError("");
    const { error } = await supabase.from("profiles").update(f).eq("id", employee.id);
    setSaving(false);
    if (error) return setError(error.message);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onChanged();
  };

  const upload = async (file: File) => {
    setError("");
    if (!docTitle.trim()) return setError("Give the document a title first.");
    if (file.size > 8 * 1024 * 1024) return setError("File must be under 8 MB.");
    setUploading(true);

    const ext = file.name.split(".").pop();
    const path = `${employee.company_id}/${employee.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("employee-docs").upload(path, file);
    if (upErr) { setUploading(false); return setError(upErr.message); }

    const url = supabase.storage.from("employee-docs").getPublicUrl(path).data.publicUrl;
    const { error: dbErr } = await supabase.from("employee_documents").insert({
      company_id: employee.company_id,
      employee_id: employee.id,
      category: docCategory,
      title: docTitle.trim(),
      file_url: url,
      file_name: file.name,
      file_size: file.size,
    });
    setUploading(false);
    if (dbErr) return setError(dbErr.message);
    setDocTitle("");
    loadDocs();
  };

  const removeDoc = async (id: string) => {
    await supabase.from("employee_documents").delete().eq("id", id);
    loadDocs();
  };

  const changeStatus = async (status: "active" | "disabled" | "left") => {
    setSaving(true);
    const { error } = await supabase.rpc("set_employee_status", {
      p_employee: employee.id, p_status: status, p_note: "",
    });
    setSaving(false);
    setConfirming(null);
    if (error) return setError(error.message);
    onChanged();
    onClose();
  };

  const isOwner = employee.role === "owner";

  return (
    <Modal open={!!employee} onClose={onClose} title={employee.full_name || "Employee"}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge value={employee.status} />
          {!isOwner && (
            <div className="flex gap-2">
              {employee.status === "active" ? (
                <button onClick={() => setConfirming("disabled")}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-100">
                  <ShieldOff className="h-3.5 w-3.5" /> Disable
                </button>
              ) : employee.status === "disabled" ? (
                <button onClick={() => changeStatus("active")}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100">
                  <ShieldCheck className="h-3.5 w-3.5" /> Enable
                </button>
              ) : null}
              {employee.status !== "left" ? (
                <button onClick={() => setConfirming("left")}
                  className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100">
                  <UserMinus className="h-3.5 w-3.5" /> Mark as left
                </button>
              ) : (
                <button onClick={() => changeStatus("active")}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100">
                  <UserCheck className="h-3.5 w-3.5" /> Restore
                </button>
              )}
            </div>
          )}
        </div>

        {confirming && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
            <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              {confirming === "disabled" ? "Disable this account?" : "Mark this employee as left?"}
            </p>
            <p className="mt-1 text-xs text-amber-700">
              {confirming === "disabled"
                ? "They won't be able to sign in or do anything in the organization until re-enabled. Their records are kept."
                : "They won't be able to sign in. Their records stay on file under the Left tab."}
            </p>
            <div className="mt-2.5 flex gap-2">
              <button onClick={() => changeStatus(confirming)} disabled={saving}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-700">
                Confirm
              </button>
              <button onClick={() => setConfirming(null)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-white">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-1 rounded-lg bg-slate-100 dark:bg-slate-700 p-1">
          <button onClick={() => setTab("details")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              tab === "details" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-500"
            }`}>
            <User className="h-3.5 w-3.5" /> Details
          </button>
          <button onClick={() => setTab("documents")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              tab === "documents" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-500"
            }`}>
            <FileText className="h-3.5 w-3.5" /> Documents {docs.length > 0 && `(${docs.length})`}
          </button>
        </div>

        {tab === "details" && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <User className="h-3.5 w-3.5" /> Address
              </p>
              <div className="space-y-3">
                <input className={inputCls} placeholder="Street address" value={f.address}
                  onChange={(e) => set("address", e.target.value)} />
                <div className="grid grid-cols-3 gap-2">
                  <input className={inputCls} placeholder="City" value={f.city} onChange={(e) => set("city", e.target.value)} />
                  <input className={inputCls} placeholder="State" value={f.state} onChange={(e) => set("state", e.target.value)} />
                  <input className={inputCls} placeholder="PIN" value={f.pincode} onChange={(e) => set("pincode", e.target.value)} />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <CreditCard className="h-3.5 w-3.5" /> Bank details
              </p>
              <div className="space-y-3">
                <input className={inputCls} placeholder="Account holder name" value={f.bank_account_name}
                  onChange={(e) => set("bank_account_name", e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <input className={inputCls} placeholder="Account number" value={f.bank_account_number}
                    onChange={(e) => set("bank_account_number", e.target.value)} />
                  <input className={inputCls} placeholder="IFSC code" value={f.bank_ifsc}
                    onChange={(e) => set("bank_ifsc", e.target.value)} />
                </div>
                <input className={inputCls} placeholder="Bank name" value={f.bank_name}
                  onChange={(e) => set("bank_name", e.target.value)} />
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Emergency contact</p>
              <div className="grid grid-cols-2 gap-2">
                <input className={inputCls} placeholder="Name" value={f.emergency_contact_name}
                  onChange={(e) => set("emergency_contact_name", e.target.value)} />
                <input className={inputCls} placeholder="Phone" value={f.emergency_contact_phone}
                  onChange={(e) => set("emergency_contact_phone", e.target.value)} />
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
            )}

            <div className="flex items-center gap-3 border-t border-slate-100 dark:border-slate-700 pt-4">
              <MotionButton onClick={saveDetails} disabled={saving}
                className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-800 disabled:opacity-60">
                {saving ? "Saving…" : "Save details"}
              </MotionButton>
              {saved && <span className="text-sm font-medium text-emerald-600">Saved ✓</span>}
            </div>
          </div>
        )}

        {tab === "documents" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3.5">
              <div className="grid grid-cols-2 gap-2">
                <input className={inputCls} placeholder="Document title" value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)} />
                <select className={inputCls} value={docCategory} onChange={(e) => setDocCategory(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
                </select>
              </div>
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 px-3.5 py-3 text-sm text-slate-500 transition hover:border-brand-600 hover:text-brand-700 disabled:opacity-60">
                <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : "Choose a file"}
              </button>
              <input ref={fileRef} type="file" className="hidden"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file); }} />
            </div>

            {error && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
            )}

            {docs.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No documents uploaded yet.</p>
            ) : (
              <ul className="space-y-2">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300">
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{d.title}</p>
                      <p className="text-xs text-slate-400">
                        {CATEGORIES.find((c) => c.v === d.category)?.l} · {d.file_name}
                      </p>
                    </div>
                    <a href={d.file_url} target="_blank" rel="noreferrer"
                      className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 transition hover:border-brand-600 hover:text-brand-700">
                      <Download className="h-4 w-4" />
                    </a>
                    <button onClick={() => removeDoc(d.id)}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 dark:border-slate-600 text-slate-400 transition hover:border-rose-300 hover:text-rose-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
