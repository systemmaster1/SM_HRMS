/* ------------------------------------------------------------------ *
 *  CSV helpers for bulk task import                                    *
 * ------------------------------------------------------------------ */

/** Parses CSV text (handles quoted fields, embedded commas and newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  // Strip a UTF-8 BOM if present
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') { inQuotes = true; continue; }
    if (c === ",") { row.push(field); field = ""; continue; }
    if (c === "\r") continue;
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += c;
  }

  row.push(field);
  rows.push(row);

  // Drop trailing blank lines
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

/** Turns a parsed grid into header + object rows. */
export function toRecords(grid: string[][]) {
  if (grid.length === 0) return { headers: [] as string[], records: [] as any[] };
  const headers = grid[0].map((h) => h.trim());
  const records = grid.slice(1).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, idx) => { o[h] = (r[idx] ?? "").trim(); });
    return o;
  });
  return { headers, records };
}

/** Triggers a browser download of a text file. */
export function downloadText(filename: string, content: string, mime = "text/csv;charset=utf-8;") {
  const blob = new Blob(["\uFEFF" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ *
 *  Import field definitions                                            *
 * ------------------------------------------------------------------ */

export type ImportField = {
  key: string;
  label: string;
  required?: boolean;
  hint?: string;
};

export const CHECKLIST_FIELDS: ImportField[] = [
  { key: "title",       label: "Title", required: true, hint: "What the task is called" },
  { key: "assignee",    label: "Assign to", required: true, hint: "Employee name, email or mobile" },
  { key: "frequency",   label: "Frequency", required: true, hint: "daily / weekly / monthly / quarterly / half_yearly / yearly" },
  { key: "start_date",  label: "Start date", required: true, hint: "YYYY-MM-DD or DD/MM/YYYY" },
  { key: "due_time",    label: "Due time", hint: "HH:MM — defaults to 09:00" },
  { key: "priority",    label: "Priority", hint: "low / medium / high — defaults to medium" },
  { key: "description", label: "Description" },
  { key: "end_date",    label: "End date", hint: "Optional — leave blank to repeat forever" },
  { key: "kra_id",      label: "KRA ID", hint: "Leave blank to auto-generate" },
];

export const DELEGATION_FIELDS: ImportField[] = [
  { key: "title",       label: "Title", required: true },
  { key: "assignee",    label: "Assign to", required: true, hint: "Employee name, email or mobile" },
  { key: "due_date",    label: "Due date", required: true, hint: "YYYY-MM-DD or DD/MM/YYYY" },
  { key: "due_time",    label: "Due time", hint: "HH:MM" },
  { key: "priority",    label: "Priority", hint: "low / medium / high" },
  { key: "description", label: "Description" },
  { key: "kra_id",      label: "KRA ID", hint: "Leave blank to auto-generate" },
];

/** Builds the downloadable sample CSV for a given import type. */
export function sampleCsv(kind: "checklist" | "delegation") {
  if (kind === "checklist") {
    return [
      "Title,Assign to,Frequency,Start date,Due time,Priority,Description,End date,KRA ID",
      "Daily sales report,rahul@company.com,daily,2026-08-01,09:00,high,Send the previous day's numbers,,",
      "Weekly stock audit,Priya Sharma,weekly,2026-08-03,11:00,medium,Count and reconcile warehouse stock,,",
      "Monthly GST filing,9876543210,monthly,2026-08-05,16:00,high,File GSTR-3B,,",
    ].join("\r\n");
  }
  return [
    "Title,Assign to,Due date,Due time,Priority,Description,KRA ID",
    "Submit vendor invoice,rahul@company.com,2026-08-12,17:00,high,Invoice for the July order,",
    "Renew office insurance,Priya Sharma,2026-08-20,,medium,Policy expires end of August,",
  ].join("\r\n");
}

/* ------------------------------------------------------------------ *
 *  Value normalisation                                                 *
 * ------------------------------------------------------------------ */

/** Accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY. Returns YYYY-MM-DD or "". */
export function normDate(v: string): string {
  const s = (v || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return "";
}

/** Accepts 9:00, 09:00, 9:00 AM, 5 PM. Returns HH:MM or "". */
export function normTime(v: string): string {
  const s = (v || "").trim();
  if (!s) return "";

  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return "";

  let h = parseInt(m[1], 10);
  const min = m[2] ?? "00";
  const ap = (m[3] || "").toLowerCase();

  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (h > 23) return "";

  return `${String(h).padStart(2, "0")}:${min}`;
}

const FREQ_ALIASES: Record<string, string> = {
  daily: "daily", day: "daily", everyday: "daily",
  weekly: "weekly", week: "weekly",
  monthly: "monthly", month: "monthly",
  quarterly: "quarterly", quarter: "quarterly", "3 monthly": "quarterly",
  half_yearly: "half_yearly", "half yearly": "half_yearly",
  halfyearly: "half_yearly", "6 monthly": "half_yearly", semiannual: "half_yearly",
  yearly: "yearly", year: "yearly", annual: "yearly", annually: "yearly",
};

export function normFrequency(v: string): string {
  const s = (v || "").trim().toLowerCase().replace(/-/g, "_");
  return FREQ_ALIASES[s] || FREQ_ALIASES[s.replace(/_/g, " ")] || "";
}

export function normPriority(v: string): string {
  const s = (v || "").trim().toLowerCase();
  if (["low", "l", "3"].includes(s)) return "low";
  if (["high", "h", "1", "urgent", "critical"].includes(s)) return "high";
  return "medium";
}

/** Extracts the spreadsheet ID out of any Google Sheets URL. */
export function sheetIdFromUrl(url: string): string {
  const m = (url || "").match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : "";
}
