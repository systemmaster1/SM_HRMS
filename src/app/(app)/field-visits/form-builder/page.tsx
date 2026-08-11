"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  GripVertical,
  Plus,
  Save,
  Settings2,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "phone"
  | "date"
  | "datetime"
  | "select"
  | "checkbox";

type FieldDef = {
  id: string;
  company_id: string;
  field_key: string;
  label: string;
  field_type: FieldType;
  placeholder: string;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  options: string[];
};

const fieldCls =
  "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10";

const standardFields = [
  ["client_name", "Client / Site Name", "Required core field"],
  ["company_name", "Company Name", "Standard contact field"],
  ["contact_person", "Contact Person", "Standard contact field"],
  ["contact_number", "Contact Number", "Standard contact field"],
  ["contact_email", "Email", "Standard contact field"],
  ["purpose", "Purpose", "Standard visit field"],
  ["address", "Address", "Standard visit field"],
];

export default function VisitFormBuilderPage() {
  const supabase = useMemo(() => createClient(), []);
  const [me, setMe] = useState<any>(null);
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    label: "",
    field_type: "text" as FieldType,
    placeholder: "",
    is_required: false,
    options_text: "",
  });

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id,company_id,role")
      .eq("id", auth.user.id)
      .single();
    setMe(profile);

    const { data } = await supabase
      .from("visit_custom_fields")
      .select("*")
      .order("sort_order")
      .order("created_at");

    setFields(
      ((data || []) as any[]).map((x) => ({
        ...x,
        options: Array.isArray(x.options) ? x.options : [],
      }))
    );
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const canManage = ["owner","admin","manager"].includes(me?.role || "");

  const add = async () => {
    if (!draft.label.trim() || !me?.company_id) return;
    setSaving(true);
    setMessage("");

    const base =
      draft.label
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "") || "custom_field";

    const key = `${base}_${Date.now().toString().slice(-6)}`;
    const options =
      draft.field_type === "select"
        ? draft.options_text.split("\n").map((x) => x.trim()).filter(Boolean)
        : [];

    const { error } = await supabase.from("visit_custom_fields").insert({
      company_id: me.company_id,
      field_key: key,
      label: draft.label.trim(),
      field_type: draft.field_type,
      placeholder: draft.placeholder.trim(),
      is_required: draft.is_required,
      is_active: true,
      sort_order: fields.length ? Math.max(...fields.map((x) => x.sort_order || 0)) + 10 : 100,
      options,
      created_by: me.id,
    });

    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setDraft({ label: "", field_type: "text", placeholder: "", is_required: false, options_text: "" });
    setMessage("Custom visit field added.");
    await load();
  };

  const update = async (field: FieldDef, patch: Partial<FieldDef>) => {
    const { error } = await supabase
      .from("visit_custom_fields")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", field.id);
    if (error) setMessage(error.message);
    else await load();
  };

  const remove = async (field: FieldDef) => {
    if (!confirm(`Delete "${field.label}" from future visit forms? Existing visit data will remain preserved.`)) return;
    const { error } = await supabase.from("visit_custom_fields").delete().eq("id", field.id);
    if (error) setMessage(error.message);
    else {
      setMessage("Field removed from future visit forms.");
      await load();
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/field-visits" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-brand-700">
            <ArrowLeft className="h-4 w-4" /> Back to Field Visits
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-950">Visit Form Builder</h1>
          <p className="mt-1 text-sm text-slate-500">
            Admin/Manager can add, disable or change custom fields used when a new field visit is created.
          </p>
        </div>
      </div>

      {message && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Settings2 className="h-5 w-5 text-brand-700" />
          <div>
            <h2 className="font-semibold">Standard visit information</h2>
            <p className="text-xs text-slate-500">These are stored in reporting-friendly database columns.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {standardFields.map(([key,label,note]) => (
            <div key={key} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold">{label}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{note}</p>
            </div>
          ))}
        </div>
      </section>

      {canManage && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold">Add custom field</h2>
          <p className="mt-1 text-xs text-slate-500">
            Add company-specific visit information without changing code.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-medium">
              Field label
              <input className={fieldCls} value={draft.label} onChange={(e)=>setDraft((p)=>({...p,label:e.target.value}))} placeholder="Dealer Category" />
            </label>

            <label className="text-sm font-medium">
              Data type
              <select className={fieldCls} value={draft.field_type} onChange={(e)=>setDraft((p)=>({...p,field_type:e.target.value as FieldType}))}>
                <option value="text">Text</option>
                <option value="textarea">Long Text</option>
                <option value="number">Number</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="date">Date</option>
                <option value="datetime">Date & Time</option>
                <option value="select">Dropdown</option>
                <option value="checkbox">Yes / No</option>
              </select>
            </label>

            <label className="text-sm font-medium">
              Placeholder
              <input className={fieldCls} value={draft.placeholder} onChange={(e)=>setDraft((p)=>({...p,placeholder:e.target.value}))} placeholder="Optional hint" />
            </label>

            <label className="flex items-center gap-2 pt-7 text-sm font-medium">
              <input type="checkbox" checked={draft.is_required} onChange={(e)=>setDraft((p)=>({...p,is_required:e.target.checked}))} />
              Required field
            </label>
          </div>

          {draft.field_type === "select" && (
            <label className="mt-4 block text-sm font-medium">
              Dropdown options — one option per line
              <textarea className={fieldCls} rows={5} value={draft.options_text} onChange={(e)=>setDraft((p)=>({...p,options_text:e.target.value}))} placeholder={"Retailer\nDistributor\nDealer"} />
            </label>
          )}

          <button disabled={saving || !draft.label.trim()} onClick={add} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
            <Plus className="h-4 w-4" /> {saving ? "Adding…" : "Add field"}
          </button>
        </section>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold">Custom visit fields</h2>
        <p className="mt-1 text-xs text-slate-500">Changes apply to future New Visit forms immediately.</p>

        <div className="mt-5 space-y-3">
          {fields.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              No custom fields yet.
            </div>
          )}

          {fields.map((field) => (
            <div key={field.id} className="grid gap-3 rounded-2xl border border-slate-200 p-4 lg:grid-cols-[auto_1.2fr_.8fr_.8fr_auto] lg:items-center">
              <GripVertical className="hidden h-4 w-4 text-slate-300 lg:block" />

              <div>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold"
                  value={field.label}
                  onChange={(e)=>setFields((prev)=>prev.map((x)=>x.id===field.id?{...x,label:e.target.value}:x))}
                  onBlur={()=>update(field,{label:fields.find((x)=>x.id===field.id)?.label || field.label})}
                />
                <p className="mt-1 text-[11px] text-slate-400">{field.field_key}</p>
              </div>

              <select
                value={field.field_type}
                onChange={(e)=>update(field,{field_type:e.target.value as FieldType})}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="text">Text</option>
                <option value="textarea">Long Text</option>
                <option value="number">Number</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="date">Date</option>
                <option value="datetime">Date & Time</option>
                <option value="select">Dropdown</option>
                <option value="checkbox">Yes / No</option>
              </select>

              <div className="flex flex-wrap gap-3 text-xs">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={field.is_required} onChange={(e)=>update(field,{is_required:e.target.checked})} />
                  Required
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={field.is_active} onChange={(e)=>update(field,{is_active:e.target.checked})} />
                  Active
                </label>
              </div>

              <button onClick={()=>remove(field)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
