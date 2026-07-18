"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card, inputCls } from "@/components/ui";
import { FadeIn } from "@/components/motion";
import { type Profile, isAdminRole } from "@/lib/types";
import {
  parseCsv, toRecords, downloadText, sampleCsv, sheetIdFromUrl,
  normDate, normTime, normFrequency, normPriority,
  CHECKLIST_FIELDS, DELEGATION_FIELDS, type ImportField,
} from "@/lib/csv";
import {
  Upload, FileSpreadsheet, Download, ArrowLeft, ArrowRight,
  Check, AlertTriangle, Table2, Link2, RefreshCw, Trash2,
} from "lucide-react";
import { useEffect } from "react";

type Kind = "checklist" | "delegation";
type Source = "sheet" | "file";

export default function TaskImportPage() {
  const supabase = createClient();

  const [me, setMe] = useState<Profile | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [ready, setReady] = useState(false);

  const [step, setStep] = useState(1);
  const [kind, setKind] = useState<Kind>("checklist");
  const [source, setSource] = useState<Source>("sheet");
  const [mode, setMode] = useState<"add" | "replace">("add");

  /* Google Sheet */
  const [sheetUrl, setSheetUrl] = useState("");
  const [tabs, setTabs] = useState<{ name: string; gid: string }[]>([]);
  const [tab, setTab] = useState("");
  const [manualTab, setManualTab] = useState("");
  const [useManual, setUseManual] = useState(false);
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  /* Parsed data */
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<Record<number, string>>({});

  /* Result */
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: number; failed: string[] } | null>(null);

  const fields: ImportField[] = kind === "checklist" ? CHECKLIST_FIELDS : DELEGATION_FIELDS;

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: p } = await supabase
        .from("profiles").select("*").eq("id", auth.user.id).single();
      setMe(p as Profile);

      const { data: m } = await supabase
        .from("profiles").select("*").eq("status", "active").order("full_name");
      setMembers((m as Profile[]) || []);
      setReady(true);
    })();
  }, [supabase]);

  /* ---------------- Auto column mapping ---------------- */
  const autoMap = (hs: string[]) => {
    const next: Record<string, string> = {};
    fields.forEach((f) => {
      const target = f.label.toLowerCase().replace(/[^a-z]/g, "");
      const alt = f.key.toLowerCase().replace(/[^a-z]/g, "");
      const hit = hs.find((h) => {
        const n = h.toLowerCase().replace(/[^a-z]/g, "");
        return n === target || n === alt || n.includes(alt) || alt.includes(n);
      });
      if (hit) next[f.key] = hit;
    });
    setMap(next);
  };

  /* ---------------- Load from Google Sheet ---------------- */
  const loadTabs = async () => {
    setError("");
    const id = sheetIdFromUrl(sheetUrl);
    if (!id) return setError("That does not look like a Google Sheets link.");

    setBusy(true);
    const res = await fetch("/api/import/google-sheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sheetId: id, action: "tabs" }),
    });
    const json = await res.json();
    setBusy(false);

    if (!res.ok) return setError(json.error || "Could not open that spreadsheet.");

    const list = (json.tabs || []) as { name: string; gid: string }[];
    setTabs(list);
    setOpened(true);

    if (list.length > 0) {
      setUseManual(false);
      // If the pasted link points at a specific tab, preselect it
      const linkGid = (sheetUrl.match(/[#&?]gid=(\d+)/) || [])[1];
      const match = linkGid && list.find((t) => t.gid === linkGid);
      setTab(match ? match.gid || match.name : list[0].gid || list[0].name);
    } else {
      // Detection failed — let them type the name instead
      setUseManual(true);
      setManualTab("");
    }
  };

  const loadRows = async () => {
    setError("");
    const id = sheetIdFromUrl(sheetUrl);

    let body: any = { sheetId: id, action: "rows" };

    if (useManual) {
      if (!manualTab.trim()) return setError("Type the tab name exactly as it appears in your sheet.");
      body.tab = manualTab.trim();
    } else {
      const chosen = tabs.find((t) => (t.gid || t.name) === tab);
      if (chosen?.gid) body.gid = chosen.gid;
      else body.tab = chosen?.name || tab;
    }

    setBusy(true);
    const res = await fetch("/api/import/google-sheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setBusy(false);

    if (!res.ok) return setError(json.error || "Could not read that tab.");

    const { headers: hs, records: rs } = toRecords(parseCsv(json.csv));
    if (!rs.length) {
      return setError(
        "That tab has no data rows. Make sure the first row holds your column headings and there is at least one task below it."
      );
    }

    setHeaders(hs);
    setRecords(rs);
    autoMap(hs);
    setOverrides({});
    setStep(3);
  };

  /* ---------------- Load from file ---------------- */
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    const text = await file.text();
    const { headers: hs, records: rs } = toRecords(parseCsv(text));
    if (!rs.length) return setError("That file has no data rows.");

    setHeaders(hs);
    setRecords(rs);
    autoMap(hs);
    setOverrides({});
    setStep(3);
  };

  /* ---------------- Resolve an employee ---------------- */
  const findMember = (v: string) => {
    const s = (v || "").trim().toLowerCase();
    if (!s) return null;
    const digits = s.replace(/\D/g, "");
    return (
      members.find((m) => (m.full_name || "").toLowerCase() === s) ||
      members.find((m) => ((m as any).email || "").toLowerCase() === s) ||
      (digits.length >= 10
        ? members.find((m) => ((m as any).phone || "").replace(/\D/g, "").endsWith(digits.slice(-10)))
        : null) ||
      members.find((m) => (m.full_name || "").toLowerCase().includes(s)) ||
      null
    );
  };

  const val = (rec: any, key: string) => {
    const col = map[key];
    return col ? (rec[col] ?? "").trim() : "";
  };

  /* ---------------- Preview validation ---------------- */
  const validated = records.map((rec, idx) => {
    const problems: string[] = [];

    const title = val(rec, "title");
    if (!title) problems.push("Title is missing");

    const who = val(rec, "assignee");
    const member = overrides[idx]
      ? members.find((m) => m.id === overrides[idx]) || null
      : findMember(who);

    if (!member) {
      if (!who) problems.push("Assignee is missing — pick someone");
      else problems.push(`No employee matches “${who}”`);
    }

    let freq = "";
    if (kind === "checklist") {
      freq = normFrequency(val(rec, "frequency"));
      if (!freq) problems.push(`Frequency “${val(rec, "frequency")}” not recognised`);
    }

    const dateKey = kind === "checklist" ? "start_date" : "due_date";
    const date = normDate(val(rec, dateKey));
    if (!date) problems.push(`${kind === "checklist" ? "Start" : "Due"} date is missing or unreadable`);

    return {
      idx, rec, problems, member, title, freq, date,
      time: normTime(val(rec, "due_time")),
      priority: normPriority(val(rec, "priority")),
      description: val(rec, "description"),
      endDate: normDate(val(rec, "end_date")),
      kraId: val(rec, "kra_id"),
    };
  });

  const good = validated.filter((v) => v.problems.length === 0);
  const bad = validated.filter((v) => v.problems.length > 0);

  /* ---------------- Run the import ---------------- */
  const runImport = async () => {
    setImporting(true);
    setError("");

    // Reserve KRA IDs for any row that did not bring its own
    const needing = good.filter((g) => !g.kraId).length;
    let pool: string[] = [];
    if (needing > 0) {
      const { data } = await supabase.rpc("reserve_kra_ids", { p_count: needing });
      pool = ((data as any[]) || []).map((x: any) => (typeof x === "string" ? x : x.reserve_kra_ids));
    }
    let p = 0;
    const nextKra = (own: string) => own || pool[p++] || "";

    // Replace mode — clear what this company already has
    if (mode === "replace") {
      if (kind === "checklist") {
        await supabase.from("checklist_templates").delete().eq("company_id", me!.company_id);
      } else {
        await supabase.from("delegations").delete().eq("company_id", me!.company_id);
      }
    }

    const failed: string[] = [];
    let ok = 0;

    // Insert in batches so a single bad row cannot sink the whole import
    const batchSize = 50;
    for (let i = 0; i < good.length; i += batchSize) {
      const slice = good.slice(i, i + batchSize);

      const payload = slice.map((g) =>
        kind === "checklist"
          ? {
              company_id: me!.company_id,
              title: g.title,
              kra_id: nextKra(g.kraId),
              description: g.description,
              assigned_to: g.member!.id,
              assigned_by: me!.id,
              priority: g.priority,
              frequency: g.freq,
              due_time: g.time || "09:00",
              start_date: g.date,
              end_date: g.endDate || null,
              next_due_date: g.date,
            }
          : {
              company_id: me!.company_id,
              title: g.title,
              kra_id: nextKra(g.kraId),
              description: g.description,
              assigned_to: g.member!.id,
              assigned_by: me!.id,
              priority: g.priority,
              due_date: g.date,
              due_time: g.time || null,
            }
      );

      const { error: err } = await supabase
        .from(kind === "checklist" ? "checklist_templates" : "delegations")
        .insert(payload);

      if (err) {
        failed.push(`Rows ${i + 2}–${i + slice.length + 1}: ${err.message}`);
      } else {
        ok += slice.length;
      }
    }

    // Generate the first occurrences straight away
    if (kind === "checklist") {
      await supabase.rpc("generate_checklist_instances");
    }

    setImporting(false);
    setResult({ ok, failed });
    setStep(4);
  };

  const admin = isAdminRole(me?.role);

  if (!ready) return <p className="text-sm text-slate-400">Loading…</p>;

  if (!admin) {
    return (
      <Card>
        <div className="p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 font-medium text-slate-900 dark:text-slate-100">
            Admins only
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Bulk import is restricted to administrators.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <FadeIn>
        <PageHeader
          title="Import tasks"
          subtitle="Bring your tasks across from another system in one go."
          action={
            <Link href="/tasks"
              className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-700">
              <ArrowLeft className="h-4 w-4" /> Back to tasks
            </Link>
          }
        />
      </FadeIn>

      {/* Stepper */}
      <div className="mb-6 flex items-center gap-2">
        {["What to import", "Where from", "Match columns", "Done"].map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
              step > i + 1 ? "bg-emerald-600 text-white"
              : step === i + 1 ? "bg-brand-700 text-white"
              : "bg-slate-200 text-slate-500 dark:bg-slate-700"
            }`}>
              {step > i + 1 ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={`hidden text-xs font-medium sm:block ${
              step === i + 1 ? "text-slate-900 dark:text-slate-100" : "text-slate-400"
            }`}>{s}</span>
            {i < 3 && <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ---------------- Step 1 ---------------- */}
      {step === 1 && (
        <Card>
          <div className="space-y-6 p-6">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                What are you importing?
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {[
                  { v: "checklist", t: "Checklist tasks", d: "Recurring tasks that repeat on a schedule" },
                  { v: "delegation", t: "Delegation tasks", d: "One-off tasks with a single due date" },
                ].map((o) => (
                  <button key={o.v} onClick={() => setKind(o.v as Kind)}
                    className={`rounded-xl border p-4 text-left transition ${
                      kind === o.v
                        ? "border-brand-600 bg-brand-50/60 ring-2 ring-brand-600/15 dark:bg-brand-500/10"
                        : "border-slate-200 dark:border-slate-600 hover:border-slate-300"
                    }`}>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{o.t}</p>
                    <p className="mt-1 text-xs text-slate-500">{o.d}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                How should existing tasks be treated?
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {[
                  { v: "add", t: "Add to existing", d: "Keep what is already there and append these", icon: Upload },
                  { v: "replace", t: "Replace everything", d: "Delete all current tasks of this type first", icon: RefreshCw },
                ].map((o) => (
                  <button key={o.v} onClick={() => setMode(o.v as any)}
                    className={`rounded-xl border p-4 text-left transition ${
                      mode === o.v
                        ? "border-brand-600 bg-brand-50/60 ring-2 ring-brand-600/15 dark:bg-brand-500/10"
                        : "border-slate-200 dark:border-slate-600 hover:border-slate-300"
                    }`}>
                    <o.icon className="h-4 w-4 text-slate-400" />
                    <p className="mt-2 font-medium text-slate-900 dark:text-slate-100">{o.t}</p>
                    <p className="mt-1 text-xs text-slate-500">{o.d}</p>
                  </button>
                ))}
              </div>
              {mode === "replace" && (
                <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Every existing {kind === "checklist" ? "checklist template" : "delegation"} will be
                  permanently deleted before the new ones are added. This cannot be undone.
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <button onClick={() => setStep(2)}
                className="flex items-center gap-2 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800">
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* ---------------- Step 2 ---------------- */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button onClick={() => setSource("sheet")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
                source === "sheet" ? "bg-white shadow-sm dark:bg-slate-700" : "text-slate-500"
              }`}>
              <Link2 className="h-4 w-4" /> Google Sheet
            </button>
            <button onClick={() => setSource("file")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
                source === "file" ? "bg-white shadow-sm dark:bg-slate-700" : "text-slate-500"
              }`}>
              <FileSpreadsheet className="h-4 w-4" /> CSV file
            </button>
          </div>

          {source === "sheet" ? (
            <Card>
              <div className="space-y-5 p-6">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-700/30">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Before you paste the link
                  </p>
                  <ol className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                    <li>1. Open your Google Sheet.</li>
                    <li>2. Click <strong>Share</strong> (top right).</li>
                    <li>3. Under <strong>General access</strong>, choose <strong>Anyone with the link</strong>.</li>
                    <li>4. Keep the role as <strong>Viewer</strong>, then click <strong>Copy link</strong>.</li>
                    <li>5. Paste it below.</li>
                  </ol>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Google Sheet link
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input className={inputCls} placeholder="https://docs.google.com/spreadsheets/d/…"
                      value={sheetUrl}
                      onChange={(e) => {
                        setSheetUrl(e.target.value);
                        setOpened(false);
                        setTabs([]);
                        setError("");
                      }} />
                    <button onClick={loadTabs} disabled={busy}
                      className="shrink-0 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800 disabled:opacity-60">
                      {busy ? "Opening…" : "Open"}
                    </button>
                  </div>
                </div>

                {opened && (
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Which tab holds the tasks?
                      </label>
                      {tabs.length > 0 && (
                        <button
                          onClick={() => setUseManual((v) => !v)}
                          className="text-xs font-medium text-brand-700 hover:text-brand-800">
                          {useManual ? "Choose from the list" : "Type the name instead"}
                        </button>
                      )}
                    </div>

                    {tabs.length > 0 && !useManual ? (
                      <>
                        <select className={`mt-1.5 ${inputCls}`} value={tab}
                          onChange={(e) => setTab(e.target.value)}>
                          {tabs.map((t) => (
                            <option key={t.gid || t.name} value={t.gid || t.name}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1.5 text-xs text-slate-500">
                          Found {tabs.length} tab{tabs.length === 1 ? "" : "s"} in this
                          spreadsheet.
                        </p>
                      </>
                    ) : (
                      <>
                        <input className={`mt-1.5 ${inputCls}`}
                          placeholder="e.g. Tasks, Sheet2, Checklist Master"
                          value={manualTab}
                          onChange={(e) => setManualTab(e.target.value)} />
                        <p className="mt-1.5 text-xs text-slate-500">
                          {tabs.length === 0
                            ? "We could not read the tab list from Google — this happens with some spreadsheets. Type the tab name exactly as it appears on the tab at the bottom of your sheet (capitals and spaces matter)."
                            : "Type the tab name exactly as it appears at the bottom of your sheet."}
                        </p>
                      </>
                    )}

                    <button onClick={loadRows} disabled={busy}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800 disabled:opacity-60">
                      <Table2 className="h-4 w-4" />
                      {busy ? "Reading…" : "Read this tab"}
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card>
              <div className="space-y-5 p-6">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-700/30">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Not sure about the format?
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Download the sample, fill in your rows, and upload it back. Column
                    order does not matter — you will match them in the next step.
                  </p>
                  <button
                    onClick={() =>
                      downloadText(
                        `SM_HRMS_${kind}_sample.csv`,
                        sampleCsv(
                          kind,
                          members.slice(0, 3).map(
                            (m) => (m as any).email || m.full_name || ""
                          )
                        )
                      )
                    }
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-slate-600 dark:text-slate-300">
                    <Download className="h-4 w-4" /> Download sample file
                  </button>
                  <p className="mt-2 text-[11px] text-slate-400">
                    The sample is filled in with your own employees, so you can upload it
                    straight back to see how the import works.
                  </p>
                </div>

                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-8 text-center transition hover:border-brand-500 hover:bg-brand-50/40 dark:border-slate-600">
                  <Upload className="h-7 w-7 text-slate-400" />
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Choose a CSV file
                  </span>
                  <span className="text-xs text-slate-500">
                    Export from Excel or Google Sheets as .csv
                  </span>
                  <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
                </label>
              </div>
            </Card>
          )}

          <button onClick={() => setStep(1)}
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </div>
      )}

      {/* ---------------- Step 3 ---------------- */}
      {step === 3 && (
        <div className="space-y-5">
          <Card>
            <div className="p-6">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Match your columns
              </p>
              <p className="mt-1 text-xs text-slate-500">
                We matched what we could automatically — correct anything that looks wrong.
                Found <strong>{records.length}</strong> rows.
              </p>

              <div className="mt-5 space-y-3">
                {fields.map((f) => (
                  <div key={f.key} className="grid items-center gap-3 sm:grid-cols-[200px_1fr]">
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {f.label}
                        {f.required && <span className="ml-1 text-rose-500">*</span>}
                      </p>
                      {f.hint && <p className="text-[11px] text-slate-400">{f.hint}</p>}
                    </div>
                    <select className={inputCls} value={map[f.key] || ""}
                      onChange={(e) => setMap((p) => ({ ...p, [f.key]: e.target.value }))}>
                      <option value="">— not in my file —</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Preview */}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-700">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Preview</p>
              <div className="flex gap-2 text-xs">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                  {good.length} ready
                </span>
                {bad.length > 0 && (
                  <span className="rounded-full bg-rose-50 px-2.5 py-1 font-semibold text-rose-700">
                    {bad.length} need attention
                  </span>
                )}
              </div>
            </div>

            {bad.some((b) => !b.member) && (
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-amber-50/60 px-5 py-3 dark:border-slate-700">
                <p className="text-xs text-amber-800">
                  Some names in your file do not match anyone in your team. Pick the right
                  person on each row below, or set them all at once:
                </p>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id) return;
                    const next = { ...overrides };
                    validated.forEach((v) => { if (!v.member) next[v.idx] = id; });
                    setOverrides(next);
                  }}
                  className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs outline-none">
                  <option value="">Assign all unmatched to…</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="max-h-80 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-700/60">
                  <tr className="text-left">
                    <th className="p-3 font-medium text-slate-500">#</th>
                    <th className="p-3 font-medium text-slate-500">Title</th>
                    <th className="p-3 font-medium text-slate-500">Assign to</th>
                    {kind === "checklist" && (
                      <th className="p-3 font-medium text-slate-500">Frequency</th>
                    )}
                    <th className="p-3 font-medium text-slate-500">
                      {kind === "checklist" ? "Starts" : "Due"}
                    </th>
                    <th className="p-3 font-medium text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {validated.slice(0, 100).map((v) => (
                    <tr key={v.idx} className={v.problems.length ? "bg-rose-50/40" : ""}>
                      <td className="p-3 text-slate-400">{v.idx + 2}</td>
                      <td className="p-3 font-medium text-slate-900 dark:text-slate-100">
                        {v.title || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">
                        {v.member ? (
                          <span className="flex items-center gap-1.5">
                            {v.member.full_name}
                            {overrides[v.idx] && (
                              <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
                                set by you
                              </span>
                            )}
                          </span>
                        ) : (
                          <select
                            value={overrides[v.idx] || ""}
                            onChange={(e) =>
                              setOverrides((p) => ({ ...p, [v.idx]: e.target.value }))
                            }
                            className="w-full rounded-md border border-rose-300 bg-white px-2 py-1 text-xs outline-none focus:border-brand-600">
                            <option value="">
                              {val(v.rec, "assignee")
                                ? `“${val(v.rec, "assignee")}” — pick the right person`
                                : "Pick an employee"}
                            </option>
                            {members.map((m) => (
                              <option key={m.id} value={m.id}>{m.full_name}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      {kind === "checklist" && (
                        <td className="p-3 text-slate-600 dark:text-slate-300">{v.freq || "—"}</td>
                      )}
                      <td className="p-3 text-slate-600 dark:text-slate-300">
                        {v.date || "—"}{v.time ? ` ${v.time}` : ""}
                      </td>
                      <td className="p-3">
                        {v.problems.length === 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                            <Check className="h-3 w-3" /> Ready
                          </span>
                        ) : (
                          <span className="text-xs text-rose-600">{v.problems[0]}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {records.length > 100 && (
                <p className="p-3 text-center text-xs text-slate-400">
                  Showing the first 100 of {records.length} rows.
                </p>
              )}
            </div>
          </Card>

          <div className="flex items-center justify-between">
            <button onClick={() => setStep(2)}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>

            <button onClick={runImport} disabled={importing || good.length === 0}
              className="flex items-center gap-2 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800 disabled:opacity-60">
              {mode === "replace" ? <Trash2 className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
              {importing
                ? "Importing…"
                : mode === "replace"
                ? `Replace all with ${good.length} tasks`
                : `Import ${good.length} tasks`}
            </button>
          </div>

          {bad.length > 0 && (
            <p className="text-center text-xs text-slate-500">
              {bad.length} row{bad.length > 1 ? "s" : ""} will be skipped. Where the problem
              is just an unrecognised name, fix it with the dropdown on that row — everything
              else needs correcting in your source file.
            </p>
          )}
        </div>
      )}

      {/* ---------------- Step 4 ---------------- */}
      {step === 4 && result && (
        <Card>
          <div className="p-8 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50">
              <Check className="h-7 w-7 text-emerald-600" />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-slate-900 dark:text-slate-100">
              {result.ok} task{result.ok === 1 ? "" : "s"} imported
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              {kind === "checklist"
                ? "Their first occurrences have already been scheduled."
                : "They are now visible on the Tasks page."}
            </p>

            {bad.length > 0 && (
              <p className="mt-3 text-sm text-amber-600">
                {bad.length} row{bad.length > 1 ? "s were" : " was"} skipped.
              </p>
            )}

            {result.failed.length > 0 && (
              <div className="mx-auto mt-5 max-w-lg rounded-lg border border-rose-200 bg-rose-50 p-4 text-left">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                  Some batches failed
                </p>
                <ul className="mt-2 space-y-1 text-xs text-rose-600">
                  {result.failed.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
            )}

            <div className="mt-7 flex justify-center gap-3">
              <Link href="/tasks"
                className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800">
                View tasks
              </Link>
              <button
                onClick={() => {
                  setStep(1); setResult(null); setRecords([]);
                  setHeaders([]); setMap({}); setTabs([]); setSheetUrl("");
                  setOpened(false); setUseManual(false); setManualTab("");
                  setOverrides({});
                }}
                className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300">
                Import more
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
