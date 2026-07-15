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

/** Opens a printable salary slip for one employee/month. */
export function printSalarySlip(opts: {
  company: any;
  row: any;
  monthName: string;
  year: number;
}) {
  const { company, row, monthName, year } = opts;

  const money = (n: number) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;

  const numberToWords = (num: number): string => {
    num = Math.round(num || 0);
    if (num === 0) return "Zero Rupees Only";
    const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten",
      "Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
    const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
    const below100 = (n: number): string => n < 20 ? ones[n] : tens[Math.floor(n/10)] + (n % 10 ? " " + ones[n%10] : "");
    const below1000 = (n: number): string => n < 100 ? below100(n) : ones[Math.floor(n/100)] + " Hundred" + (n % 100 ? " " + below100(n%100) : "");
    let crore = Math.floor(num / 10000000); num %= 10000000;
    let lakh = Math.floor(num / 100000); num %= 100000;
    let thou = Math.floor(num / 1000); num %= 1000;
    let out = "";
    if (crore) out += below100(crore) + " Crore ";
    if (lakh) out += below100(lakh) + " Lakh ";
    if (thou) out += below100(thou) + " Thousand ";
    if (num) out += below1000(num);
    return out.trim() + " Rupees Only";
  };

  const dayCut = Math.round((row.work_days - row.payable_days) * row.per_day_rate);

  const html = `
    <div style="max-width:720px;margin:0 auto;border:1px solid #d6d6e0;border-radius:8px;overflow:hidden;font-family:-apple-system,'Segoe UI',sans-serif;">
      <div style="background:#053A6E;color:#fff;padding:22px 26px;">
        <h1 style="font-size:20px;font-weight:700;margin:0;">${company?.name || "Company"}</h1>
        <p style="font-size:12px;opacity:.85;margin-top:4px;">${company?.address || ""}</p>
      </div>
      <div style="background:#f5f5f7;padding:12px 26px;display:flex;justify-content:space-between;border-bottom:1px solid #e6e6ee;">
        <strong style="color:#053A6E;">Salary Slip</strong>
        <span style="font-weight:600;">${monthName} ${year}</span>
      </div>
      <div style="padding:22px 26px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;border:1px solid #d6d6e0;border-radius:6px;overflow:hidden;margin-bottom:16px;font-size:12px;">
          ${cell("Employee Name", row.full_name)}${cell("Employee Code", row.employee_code || "—")}
          ${cell("Designation", row.designation || "—")}${cell("Department", row.department || "—")}
          ${cell("Mobile", row.phone || "—")}${cell("Pay Period", `${monthName} ${year}`)}
        </div>

        <p style="font-size:12px;font-weight:700;color:#053A6E;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #053A6E;padding-bottom:4px;margin-bottom:8px;">Attendance Summary</p>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:16px;">
          ${att("Work Days", row.work_days)}${att("Present", row.present_days)}${att("Late", row.late_count)}
          ${att("Absent", row.absent_days)}${att("Leave", row.leave_days)}
        </div>

        <p style="font-size:12px;font-weight:700;color:#053A6E;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #053A6E;padding-bottom:4px;margin-bottom:8px;">Salary Calculation</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div style="border:1px solid #d6d6e0;border-radius:6px;overflow:hidden;">
            <div style="background:#053A6E;color:#fff;padding:8px 12px;font-size:11px;font-weight:700;text-transform:uppercase;">Earnings</div>
            ${row2("Monthly Salary", money(row.monthly_salary))}
            ${row2("Per Day Rate", money(row.per_day_rate))}
            ${row2("Payable Days", `${row.payable_days} / ${row.work_days}`)}
            ${row2("Gross Pay", money(row.gross_pay), true)}
          </div>
          <div style="border:1px solid #d6d6e0;border-radius:6px;overflow:hidden;">
            <div style="background:#053A6E;color:#fff;padding:8px 12px;font-size:11px;font-weight:700;text-transform:uppercase;">Deductions</div>
            ${row2("PF", money(row.pf))}
            ${row2("Other Deduction", money(row.other_deduction))}
            ${row2("Days Deducted", `${row.total_deduction} day(s)`)}
            ${row2("Value of Days", money(dayCut), true)}
          </div>
        </div>

        <div style="margin-top:16px;padding:16px 20px;background:#059669;color:#fff;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:12px;text-transform:uppercase;opacity:.9;">Net Salary Payable</span>
          <span style="font-size:24px;font-weight:700;">${money(row.net_salary)}</span>
        </div>
        <p style="margin-top:8px;padding:8px 12px;background:#fff8e1;color:#6d4c00;font-size:11px;border-radius:6px;font-style:italic;">
          In words: ${numberToWords(row.net_salary)}
        </p>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:40px;">
          <div style="text-align:center;border-top:1px solid #999;padding-top:6px;font-size:11px;color:#555;">Employee Signature</div>
          <div style="text-align:center;border-top:1px solid #999;padding-top:6px;font-size:11px;color:#555;">Authorised Signatory</div>
        </div>

        <p style="margin-top:20px;padding-top:10px;border-top:1px dashed #ccc;font-size:10px;color:#888;text-align:center;">
          System-generated salary slip. No physical signature required for digital records.
        </p>
      </div>
    </div>
  `;

  function cell(label: string, value: string) {
    return `<div style="padding:9px 14px;border-bottom:1px solid #ececf3;display:flex;justify-content:space-between;">
      <span style="color:#777;font-weight:600;text-transform:uppercase;font-size:10px;">${label}</span>
      <span style="font-weight:600;">${value}</span></div>`;
  }
  function att(label: string, value: number) {
    return `<div style="background:#f5f5f7;border:1px solid #ececf3;border-radius:6px;padding:10px;text-align:center;">
      <div style="font-size:10px;color:#777;text-transform:uppercase;font-weight:700;">${label}</div>
      <div style="font-size:18px;font-weight:700;color:#053A6E;margin-top:2px;">${value}</div></div>`;
  }
  function row2(label: string, value: string, total = false) {
    return `<div style="display:flex;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #ececf3;font-size:12px;${total ? "background:#f5f5f7;font-weight:700;" : ""}">
      <span>${label}</span><span style="font-weight:600;">${value}</span></div>`;
  }

  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Salary Slip — ${row.full_name}</title>
  <style>body{margin:24px;background:#f0f2f5;} @media print{body{background:#fff;margin:0;} @page{size:A4;margin:12mm;}}</style>
  </head><body>${html}<script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}
