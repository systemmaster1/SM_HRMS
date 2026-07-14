/** Downloads rows as a CSV file that Excel opens cleanly. */
export function exportCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: any) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\r\n");

  // BOM so Excel reads UTF-8 correctly
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Opens a print-ready window; the user saves it as PDF. */
export function printReport(title: string, bodyHtml: string) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #0F172A; margin: 28px; }
  h1 { font-size: 19px; margin: 0 0 2px; }
  .sub { font-size: 12px; color: #64748B; margin-bottom: 18px; }
  .emp { page-break-after: always; }
  .emp:last-child { page-break-after: auto; }
  .card { border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px; margin-bottom: 16px; }
  .grid { display: flex; gap: 26px; font-size: 12px; }
  .grid div span { display: block; color: #64748B; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
  .grid div strong { font-size: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; padding: 7px 8px; border-bottom: 1.5px solid #CBD5E1; color: #475569;
       font-size: 9px; text-transform: uppercase; letter-spacing: .05em; }
  td { padding: 7px 8px; border-bottom: 1px solid #F1F5F9; }
  .out { color: #E11D48; font-weight: 600; }
  .in  { color: #059669; }
  .late { color: #D97706; font-weight: 600; }
  @media print { body { margin: 12mm; } }
</style></head><body>${bodyHtml}
<script>window.onload = () => { window.print(); }<\/script>
</body></html>`);
  w.document.close();
}
