"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card, inputCls } from "@/components/ui";
import { FadeIn } from "@/components/motion";
import { type Profile, isAdminRole } from "@/lib/types";
import {
  Sheet, Copy, Check, AlertTriangle, Save, PlayCircle,
  ShieldCheck, Clock, ExternalLink,
} from "lucide-react";

const APPS_SCRIPT = String.raw`/**
 * SM HRMS -> Google Sheets backup receiver
 * Built by SystemMaster Automations
 *
 * Paste this whole file into Apps Script, deploy it as a Web app,
 * then paste the deployment URL back into SM HRMS.
 */

// Keep this secret. Paste the SAME value into SM HRMS.
const SHARED_SECRET = 'CHANGE-ME-TO-SOMETHING-LONG-AND-RANDOM';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    if (body.secret !== SHARED_SECRET) {
      return reply({ ok: false, error: 'Bad secret' });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const stamp = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy HH:mm');

    // Each dataset arrives as { name, headers, rows }
    (body.datasets || []).forEach(function (ds) {
      let sheet = ss.getSheetByName(ds.name);
      if (!sheet) sheet = ss.insertSheet(ds.name);

      sheet.clear();
      sheet.getRange(1, 1).setValue('Last updated: ' + stamp);
      sheet.getRange(1, 1).setFontColor('#888888').setFontSize(9);

      if (ds.headers && ds.headers.length) {
        sheet.getRange(2, 1, 1, ds.headers.length)
             .setValues([ds.headers])
             .setFontWeight('bold')
             .setBackground('#053A6E')
             .setFontColor('#FFFFFF');
      }

      if (ds.rows && ds.rows.length) {
        sheet.getRange(3, 1, ds.rows.length, ds.headers.length).setValues(ds.rows);
      }

      sheet.setFrozenRows(2);
      sheet.autoResizeColumns(1, Math.max(ds.headers.length, 1));
    });

    return reply({ ok: true, sheets: (body.datasets || []).length, at: stamp });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

function doGet() {
  return reply({ ok: true, message: 'SM HRMS backup endpoint is live.' });
}

function reply(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}`;

const STEPS = [
  {
    t: "Create the spreadsheet",
    d: "In Google Drive, create a new blank Google Sheet and name it something like “SM HRMS Backup”. This is where your data will land.",
  },
  {
    t: "Open Apps Script",
    d: "In that sheet, go to Extensions → Apps Script. A code editor opens in a new tab.",
  },
  {
    t: "Paste the code",
    d: "Delete whatever is in the editor, paste the code below in its place, then change SHARED_SECRET to a long random phrase of your own. Press the save icon.",
  },
  {
    t: "Deploy as a web app",
    d: "Click Deploy → New deployment. For type choose Web app. Set “Execute as” to Me, and “Who has access” to Anyone. Click Deploy.",
  },
  {
    t: "Authorise it",
    d: "Google will ask for permission the first time. Choose your account, click Advanced → Go to (project name), then Allow. This is Google asking whether your own script may edit your own sheet.",
  },
  {
    t: "Copy the web app URL",
    d: "After deploying, Google shows a URL ending in /exec. Copy it.",
  },
  {
    t: "Paste it below",
    d: "Paste the URL and the same secret phrase into the form below, save, then run a test backup.",
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
      setUrl(c?.gsheet_webhook_url || "");
      setSecret(c?.gsheet_secret || "");
      setEnabled(!!c?.gsheet_backup_enabled);
      setReady(true);
    })();
  }, [supabase]);

  const save = async () => {
    setSaving(true);
    await supabase.from("companies").update({
      gsheet_webhook_url: url.trim(),
      gsheet_secret: secret.trim(),
      gsheet_backup_enabled: enabled,
    }).eq("id", me!.company_id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const runTest = async () => {
    setTesting(true);
    setTestMsg("");
    const res = await fetch("/api/integrations/gsheet-backup", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setTesting(false);
    setTestOk(res.ok);
    setTestMsg(
      res.ok
        ? `Backup sent — ${json.sheets ?? 0} tabs written to your spreadsheet.`
        : json.error || "The backup could not be delivered. Check the URL and secret."
    );
  };

  const copyCode = () => {
    navigator.clipboard.writeText(APPS_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const admin = isAdminRole(me?.role);
  if (!ready) return <p className="text-sm text-slate-400">Loading…</p>;

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
          subtitle="Keep a live copy of your HRMS data in your own Google Sheet."
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
              Every night your checklist tasks, delegations, attendance, leave and
              employee records are written into a spreadsheet that you own. Each
              module gets its own tab, and each run replaces the previous contents
              so the sheet is always a clean, current mirror of your data.
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Your sheet, your Google account
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-emerald-600" />
                Runs automatically each night
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
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </FadeIn>

      {/* Code */}
      <FadeIn delay={0.06}>
        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between bg-slate-900 px-5 py-3">
            <p className="text-sm font-medium text-white">Apps Script code — copy all of this</p>
            <button onClick={copyCode}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy code"}
            </button>
          </div>
          <pre className="max-h-96 overflow-auto bg-slate-950 p-5 text-[11.5px] leading-relaxed text-slate-300">
            <code>{APPS_SCRIPT}</code>
          </pre>
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
                Shared secret
              </label>
              <input className={`mt-1.5 ${inputCls}`}
                placeholder="The same phrase you put in SHARED_SECRET"
                value={secret} onChange={(e) => setSecret(e.target.value)} />
              <p className="mt-1.5 text-xs text-slate-500">
                Must match the value at the top of your Apps Script exactly, so that
                nobody else can write to your sheet.
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-600">
              <input type="checkbox" checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700" />
              <span>
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Run the backup automatically every night
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Around 1:30 AM IST. You can always run it manually below.
                </span>
              </span>
            </label>

            {company?.gsheet_last_backup && (
              <p className="text-xs text-slate-500">
                Last backup:{" "}
                <strong className="text-slate-700 dark:text-slate-300">
                  {new Date(company.gsheet_last_backup).toLocaleString("en-IN")}
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
                {testing ? "Sending…" : "Run a backup now"}
              </button>

              {url && (
                <a href={url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800">
                  Test the URL <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

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
