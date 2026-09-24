"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card, inputCls } from "@/components/ui";
import { FadeIn } from "@/components/motion";
import { type Profile, isAdminRole } from "@/lib/types";
import { fmtStampIST } from "@/lib/date";
import {
  Sheet, Copy, Check, AlertTriangle, Save, PlayCircle,
  ShieldCheck, Clock, ExternalLink,
} from "lucide-react";
import { PageLoader } from "@/components/ui";

const SCRIPT_VERSION = "2.0";

const buildScript = (secret: string) => String.raw`/**
 * SM HRMS -> Google Sheets sync receiver  (v${SCRIPT_VERSION})
 * Built by SystemMaster Automations
 *
 * Nothing in this file needs editing. Paste it in as-is.
 *
 * v2: safe writes (old data is restored if a write fails), one sync at a
 * time (lock), mobile numbers / codes kept as text, IST timestamps.
 */

const SHARED_SECRET = '${secret}';

function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(120000)) {
    return reply({ ok: false, error: 'Another sync is still running. Try again in a minute.' });
  }
  try {
    const body = JSON.parse(e.postData.contents);

    if (body.secret !== SHARED_SECRET) {
      return reply({ ok: false, error: 'Bad secret' });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const stamp = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy, hh:mm a');
    let written = 0;

    (body.datasets || []).forEach(function (ds) {
      writeTab(ss, ds, stamp);
      written += (ds.rows || []).length;
    });

    SpreadsheetApp.flush();
    return reply({ ok: true, sheets: (body.datasets || []).length, rows: written, at: stamp });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function writeTab(ss, ds, stamp) {
  const headers = ds.headers || [];
  const rows = ds.rows || [];
  const width = Math.max(headers.length, 1);

  let sheet = ss.getSheetByName(ds.name);
  if (!sheet) sheet = ss.insertSheet(ds.name);

  // Keep a copy of what is there now, so a failed write never leaves the tab empty.
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const previous = lastRow > 0 && lastCol > 0
    ? sheet.getRange(1, 1, lastRow, lastCol).getValues()
    : null;

  try {
    if (sheet.getFilter()) sheet.getFilter().remove();
    sheet.clear();

    sheet.getRange(1, 1).setValue('Last synced: ' + stamp + ' IST  ·  ' + rows.length + ' rows')
         .setFontColor('#888888').setFontSize(9);

    if (headers.length) {
      sheet.getRange(2, 1, 1, headers.length)
           .setValues([headers])
           .setFontWeight('bold')
           .setBackground('#053A6E')
           .setFontColor('#FFFFFF');
    }

    if (rows.length) {
      // Mobile numbers, employee codes and KRA IDs must stay text
      // (otherwise Sheets drops leading zeros).
      (ds.textCols || []).forEach(function (c) {
        sheet.getRange(3, c + 1, rows.length, 1).setNumberFormat('@');
      });
      const clean = rows.map(function (r) {
        const out = [];
        for (let i = 0; i < width; i++) out.push(r[i] === null || r[i] === undefined ? '' : r[i]);
        return out;
      });
      sheet.getRange(3, 1, clean.length, width).setValues(clean);
    }

    sheet.setFrozenRows(2);
    sheet.getRange(2, 1, Math.max(rows.length + 1, 1), width).createFilter();
    if (rows.length <= 5000) sheet.autoResizeColumns(1, width);
  } catch (err) {
    // Put the old data back, then report the problem.
    sheet.clear();
    if (previous) sheet.getRange(1, 1, previous.length, previous[0].length).setValues(previous);
    throw new Error('Tab "' + ds.name + '": ' + err);
  }
}

function doGet() {
  return reply({ ok: true, message: 'SM HRMS sync endpoint is live.', version: '${SCRIPT_VERSION}' });
}

function reply(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}`;

/** Creates a long, readable, random passphrase. */
function makeSecret() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = () => {
    const bytes = new Uint32Array(5);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => chars[b % chars.length]).join("");
  };
  return `SMHRMS-${block()}-${block()}-${block()}`;
}

const STEPS = [
  {
    t: "Create a blank Google Sheet",
    d: "Go to Google Drive, click New → Google Sheets → Blank spreadsheet. Give it a name such as “SM HRMS Backup”. This is the file your data will be written into.",
  },
  {
    t: "Open the script editor",
    d: "Staying inside that same spreadsheet, click Extensions in the top menu, then Apps Script. A code editor opens in a new browser tab.",
  },
  {
    t: "Delete the sample code, paste ours",
    d: "The editor opens with a few sample lines already in it (usually “function myFunction() { }”). Select all of it and delete it so the editor is completely empty. Then click Copy code below and paste it into the empty editor. Press Ctrl+S (or ⌘+S on Mac) to save.",
    note: "Nothing in the code needs to be edited. Your secret key is already filled in for you.",
  },
  {
    t: "Deploy it as a web app",
    d: "In the script editor, click the blue Deploy button (top right) → New deployment. Click the gear icon next to “Select type” and choose Web app. Set “Execute as” to Me, and “Who has access” to Anyone. Click Deploy.",
  },
  {
    t: "Give it permission",
    d: "Google will ask you to authorise the script the first time. Click Review permissions, choose your Google account, then click Advanced → Go to (your project name) → Allow. This is simply Google asking whether your own script may edit your own spreadsheet.",
  },
  {
    t: "Copy the web app URL",
    d: "Once deployment finishes, Google shows a “Web app” URL ending in /exec. Click Copy.",
  },
  {
    t: "Paste it below and save",
    d: "Paste that URL into the Web app URL box below, click Save settings, then click Run a backup now to confirm everything is working.",
  },
];

export default function IntegrationsPage() {
  const supabase = createClient();
  const [me, setMe] = useState<Profile | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [ready, setReady] = useState(false);

  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [enabled, setEnabled] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState("");
  const [testOk, setTestOk] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [logs, setLogs] = useState<any[]>([]);

  const loadLogs = useCallback(async (companyId: string) => {
    const { data } = await supabase
      .from("gsheet_sync_logs")
      .select("id, trigger, started_at, finished_at, ok, tabs, rows_written, error")
      .eq("company_id", companyId)
      .order("started_at", { ascending: false })
      .limit(8);
    setLogs(data || []);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: p } = await supabase
        .from("profiles").select("*").eq("id", auth.user.id).single();
      setMe(p as Profile);

      const { data: c } = await supabase
        .from("companies").select("*").eq("id", (p as Profile).company_id).single();
      setCompany(c);
      setEnabled(!!c?.gsheet_backup_enabled);

      // URL + secret live in an admin-only table (employees cannot read them).
      const { data: integ } = await supabase
        .from("company_integrations")
        .select("gsheet_webhook_url, gsheet_secret")
        .eq("company_id", (p as Profile).company_id)
        .maybeSingle();

      setUrl(integ?.gsheet_webhook_url || "");
      // A secret the customer never has to invent or type
      setSecret(integ?.gsheet_secret || makeSecret());
      if (isAdminRole((p as Profile)?.role)) loadLogs((p as Profile).company_id!);
      setReady(true);
    })();
  }, [supabase, loadLogs]);

  /** Saves the settings. Returns an error message, or "" on success. */
  const persist = async (): Promise<string> => {
    const companyId = me!.company_id!;
    const trimmed = url.trim();
    if (trimmed && !/^https:\/\/script\.google\.com\/(a\/[^/]+\/)?macros\/s\/[^/]+\/exec\/?$/.test(trimmed)) {
      return "The web app URL should look like https://script.google.com/macros/s/…/exec";
    }
    const { error: e1 } = await supabase.from("company_integrations").upsert({
      company_id: companyId,
      gsheet_webhook_url: trimmed || null,
      gsheet_secret: secret.trim(),
      updated_at: new Date().toISOString(),
    });
    if (e1) return e1.message;
    const { error: e2 } = await supabase.from("companies")
      .update({ gsheet_backup_enabled: enabled }).eq("id", companyId);
    if (e2) return e2.message;
    return "";
  };

  const save = async () => {
    setSaving(true);
    setSaveError("");
    const err = await persist();
    setSaving(false);
    if (err) { setSaveError(err); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(buildScript(secret));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const runTest = async () => {
    if (!url.trim()) {
      setTestOk(false);
      setTestMsg("Paste your web app URL first.");
      return;
    }

    setTesting(true);
    setTestMsg("");

    // Always save first, so the secret in the database matches the one
    // shown in the code block above.
    const saveErr = await persist();
    if (saveErr) {
      setTesting(false);
      setTestOk(false);
      setTestMsg(saveErr);
      return;
    }

    const res = await fetch("/api/integrations/gsheet-backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trigger: "manual" }),
    });
    const json = await res.json().catch(() => ({}));
    setTesting(false);
    setTestOk(res.ok);
    setTestMsg(
      res.ok
        ? `Sync complete — ${json.sheets ?? 0} professional tabs written to your spreadsheet.`
        : json.error || "The backup could not be delivered. Check the URL and try again."
    );
    if (me?.company_id) loadLogs(me.company_id);
  };

  // Near-live mirror while an administrator has HRMS open. Server cron remains the
  // reliable background schedule; this gives customers fresher operational sheets.
  useEffect(() => {
    if (!ready || !enabled || !url.trim() || !me?.company_id) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/integrations/gsheet-backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "auto" }),
      }).catch(() => undefined);
    }, 15 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [ready, enabled, url, me?.company_id]);

  const admin = isAdminRole(me?.role);
  if (!ready) return <PageLoader />;

  if (!admin) {
    return (
      <Card>
        <div className="p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 font-medium text-slate-900 dark:text-slate-100">Admins only</p>
          <p className="mt-1 text-sm text-slate-500">
            Integrations are configured by administrators.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <FadeIn>
        <PageHeader
          title="Integrations"
          subtitle="Migration + professional Google Sheets sync for attendance, visits, activity, GPS routes, tasks, leave and employees."
        />
      </FadeIn>

      {/* Why */}
      <Card className="mb-6">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
            <Sheet className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">
              Google Sheets backup
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
              Your operational data is written into a spreadsheet that the client owns. Attendance, visit timestamps, GPS route history, tracking activity, tasks, leave and employees are kept in separate professional tabs. Each sync refreshes the mirror without changing the source records in SM HRMS.
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Your sheet, your Google account
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-emerald-600" />
                Auto-sync every night at 12:00 AM + sync now
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                No Google login needed in SM HRMS
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Steps */}
      <FadeIn delay={0.03}>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Set it up — one time, about five minutes
        </h2>
        <Card className="mb-6">
          <ol className="divide-y divide-slate-100 dark:divide-slate-700">
            {STEPS.map((s, i) => (
              <li key={s.t} className="flex gap-4 p-5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-700 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{s.t}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">{s.d}</p>
                  {(s as any).note && (
                    <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {(s as any).note}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </FadeIn>

      {/* Code */}
      <FadeIn delay={0.06}>
        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 px-5 py-3">
            <div>
              <p className="text-sm font-medium text-white">
                Your Apps Script code — copy all of it
              </p>
              <p className="mt-0.5 text-xs text-white/50">
                Ready to paste. Do not change anything inside it.
              </p>
            </div>
            <button onClick={copyCode}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-white/20">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy code"}
            </button>
          </div>

          <div className="max-h-96 overflow-auto bg-slate-950 p-5">
            <pre className="text-[11.5px] leading-relaxed text-slate-300">
              <code>
                {buildScript(secret).split("\n").map((line, i) => {
                  const isSecret = line.includes("SHARED_SECRET =");
                  return (
                    <div key={i}
                      className={isSecret
                        ? "-mx-2 rounded bg-emerald-500/15 px-2 font-semibold text-emerald-300"
                        : undefined}>
                      {line || "\u00A0"}
                    </div>
                  );
                })}
              </code>
            </pre>
          </div>

          <div className="border-t border-slate-800 bg-slate-900 px-5 py-3">
            <p className="flex items-start gap-2 text-xs text-emerald-300">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              The highlighted line already contains your own unique secret key. Earlier
              versions asked you to type one in yourself — that is no longer needed.
            </p>
          </div>
        </div>
      </FadeIn>

      {/* Config */}
      <FadeIn delay={0.09}>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Connect it
        </h2>
        <Card>
          <div className="space-y-5 p-6">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Web app URL
              </label>
              <input className={`mt-1.5 ${inputCls}`}
                placeholder="https://script.google.com/macros/s/…/exec"
                value={url} onChange={(e) => setUrl(e.target.value)} />
              <p className="mt-1.5 text-xs text-slate-500">
                The URL Google gave you after deploying. It must end in <code>/exec</code>.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Your secret key
              </label>
              <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-slate-600 dark:bg-slate-700/40">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                <code className="flex-1 truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {secret}
                </code>
                <button type="button"
                  onClick={() => setSecret(makeSecret())}
                  title="Generate a new key"
                  className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-white hover:text-slate-900">
                  New key
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                Generated for you and already written into the code above — there is nothing
                to type here. Only generate a new key if you want to re-paste the code into
                Apps Script as well.
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-600">
              <input type="checkbox" checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700" />
              <span>
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Keep Google Sheets sync enabled
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Syncs automatically every night at 12:00 AM (IST). While an admin keeps this page open, it also refreshes every 15 minutes. You can sync manually anytime.
                </span>
              </span>
            </label>

            {company?.gsheet_last_backup && (
              <p className="text-xs text-slate-500">
                Last backup:{" "}
                <strong className="text-slate-700 dark:text-slate-300">
                  {fmtStampIST(company.gsheet_last_backup)}
                </strong>
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5 dark:border-slate-700">
              <button onClick={save} disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800 disabled:opacity-60">
                {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {saving ? "Saving…" : saved ? "Saved" : "Save settings"}
              </button>

              <button onClick={runTest} disabled={testing || !url}
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300">
                <PlayCircle className="h-4 w-4" />
                {testing ? "Syncing…" : "Sync Google Sheet now"}
              </button>

              {url && (
                <a href={url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800">
                  Test the URL <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            {saveError && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {saveError}
              </p>
            )}

            {testMsg && (
              <p className={`rounded-lg border px-4 py-3 text-sm ${
                testOk
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}>
                {testMsg}
              </p>
            )}
          </div>
        </Card>
      </FadeIn>

      {/* Sync history */}
      <FadeIn delay={0.1}>
        <h2 className="mb-4 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Sync history
        </h2>
        <Card>
          {logs.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">
              No syncs yet. The first automatic sync runs tonight at 12:00 AM, or click
              “Sync Google Sheet now”.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {logs.map((l) => {
                const running = l.ok === null && !l.finished_at;
                return (
                  <li key={l.id} className="flex items-start gap-3 px-5 py-3.5 text-sm">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      running ? "bg-amber-400" : l.ok ? "bg-emerald-500" : "bg-rose-500"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {fmtStampIST(l.started_at)}
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                          {l.trigger === "cron" ? "Nightly" : l.trigger === "auto" ? "Auto" : "Manual"}
                        </span>
                      </p>
                      <p className={`mt-0.5 text-xs ${l.ok === false ? "text-rose-600" : "text-slate-500"}`}>
                        {running
                          ? "Running…"
                          : l.ok
                            ? `${l.tabs} tabs · ${Number(l.rows_written || 0).toLocaleString("en-IN")} rows written`
                            : l.error || "Failed"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </FadeIn>

      {/* Support */}
      <FadeIn delay={0.12}>
        <div className="mt-8 rounded-2xl bg-brand-900 p-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
            Need a hand?
          </p>
          <p className="mt-1.5 text-sm text-white/70">
            SystemMaster Automations can set this up for you — write to{" "}
            <a href="mailto:Connect@systemmaster.in" className="font-medium text-white underline">
              Connect@systemmaster.in
            </a>{" "}
            or call{" "}
            <a href="tel:+919027965956" className="font-medium text-white underline">
              +91 90279 65956
            </a>.
          </p>
        </div>
      </FadeIn>
    </div>
  );
}
