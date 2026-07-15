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

/** Full multi-page payroll report: cover with policy, one page per employee, executive summary. */
export function printPayrollReport(opts: {
  company: any;
  rows: any[];
  monthName: string;
  year: number;
}) {
  const { company, rows, monthName, year } = opts;
  const money = (n: number) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;

  const css = `
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:-apple-system,'Segoe UI',Arial,sans-serif;color:#1f2937;font-size:11px;}
    .page{page-break-after:always;padding:6px 4px;}
    .page:last-child{page-break-after:auto;}
    .rtitle{text-align:center;font-size:24px;font-weight:800;color:#053A6E;letter-spacing:.5px;}
    .rsub{text-align:center;color:#6b7280;font-size:13px;margin:6px 0 14px;}
    .hr{border:none;border-top:1px solid #e5e7eb;margin:12px 0;}
    .card{border:1px solid #e5e7eb;border-radius:10px;padding:16px 18px;margin:10px 0;background:#fbfcff;}
    .card h3{color:#053A6E;font-size:15px;margin-bottom:10px;}
    .polrow{display:flex;padding:8px 0;border-bottom:1px solid #eef;font-size:11.5px;}
    .polrow:last-child{border-bottom:none;}
    .polrow .k{width:46%;font-weight:700;color:#374151;}
    .polrow .v{width:54%;color:#4b5563;}
    .polrow .v b{color:#053A6E;}
    .emp-head h2{color:#053A6E;font-size:18px;}
    .emp-meta{color:#6b7280;font-size:11px;margin-top:2px;}
    .badges{display:flex;gap:6px;margin:14px 0;}
    .badge{flex:1;text-align:center;border-radius:8px;padding:9px 4px;border:1px solid #e5e7eb;background:#f9fafb;}
    .badge .n{font-size:19px;font-weight:800;line-height:1;}
    .badge .l{font-size:8.5px;text-transform:uppercase;letter-spacing:.4px;color:#6b7280;margin-top:3px;}
    .b-p .n{color:#15803d;} .b-l .n{color:#c2410c;} .b-a .n{color:#b91c1c;}
    .b-v .n{color:#0369a1;} .b-s .n{color:#a16207;}
    table.ded{width:100%;border-collapse:collapse;font-size:11px;margin-top:6px;}
    table.ded th{background:#053A6E;color:#fff;padding:7px 9px;text-align:left;font-size:9.5px;text-transform:uppercase;}
    table.ded td{padding:8px 9px;border-bottom:1px solid #eef;}
    .netbox{margin-top:14px;padding:14px 18px;background:#059669;color:#fff;border-radius:8px;display:flex;justify-content:space-between;align-items:center;}
    .netbox .l{font-size:11px;text-transform:uppercase;opacity:.9;} .netbox .v{font-size:22px;font-weight:800;}
    .sum-title{color:#053A6E;font-size:19px;font-weight:800;border-left:5px solid #053A6E;padding-left:10px;margin-bottom:10px;}
    table.sum{width:100%;border-collapse:collapse;font-size:10.5px;}
    table.sum th{background:#053A6E;color:#fff;padding:9px 8px;text-align:left;font-size:9.3px;text-transform:uppercase;}
    table.sum td{padding:10px 8px;border-bottom:1px solid #eef;}
    table.sum tr:nth-child(even) td{background:#f7f9fc;}
    .nm{font-weight:800;} .dp{color:#6b7280;font-size:9px;}
    .neg{color:#dc2626;font-weight:600;} .pay{color:#053A6E;font-weight:800;}
    .foot{margin-top:14px;padding-top:8px;border-top:1px solid #eee;display:flex;justify-content:space-between;color:#9ca3af;font-size:9px;}
    @page{size:A4;margin:11mm;}
  `;

  const pol = (k: string, v: string) => `<div class="polrow"><div class="k">${k}:</div><div class="v">${v}</div></div>`;

  const cover = `<div class="page">
    <div class="rtitle">ATTENDANCE &amp; PAYROLL REPORT</div>
    <div class="rsub">${monthName} ${year} · ${company?.name || ""}</div>
    <hr class="hr">
    <div class="card"><h3>Deduction Policy</h3>
      ${pol("Late arrivals", `${company?.payroll_late_free_limit ?? 2} free per month, then <b>${company?.payroll_late_deduction ?? 0.5} day</b> for every extra ${company?.payroll_late_step ?? 2}`)}
      ${pol("Full-day leave", `${company?.payroll_leave_free_limit ?? 999} free, then <b>${company?.payroll_leave_deduction ?? 1.0} day</b> per excess`)}
      ${pol("Short leave", `${company?.payroll_short_free_limit ?? 2} free, then <b>${company?.payroll_short_deduction ?? 0.5} day</b> per excess`)}
      ${pol("Absent", `<b>${company?.payroll_absent_deduction ?? 1.0} day</b> deducted per unapproved absence`)}
    </div>
    <div class="card"><h3>Report Summary</h3>
      ${pol("Employees included", String(rows.length))}
      ${pol("Total net payable", `<b>${money(rows.reduce((s, r) => s + Number(r.net_salary || 0), 0))}</b>`)}
    </div>
    ${foot(1)}
  </div>`;

  const empPages = rows.map((r) => `<div class="page">
    <div class="emp-head"><h2>${r.full_name}</h2>
      <div class="emp-meta">${r.designation || "—"}${r.department ? ` · ${r.department}` : ""} · ${r.employee_code || "—"}</div></div>
    <div class="badges">
      ${badge("b-p", r.present_days, "Present")}
      ${badge("b-l", r.late_count, "Late")}
      ${badge("b-a", r.absent_days, "Absent")}
      ${badge("b-v", r.leave_days, "Leave")}
      ${badge("b-s", r.short_count, "Short")}
    </div>
    <table class="ded">
      <thead><tr><th>Component</th><th>Days</th><th>Value</th></tr></thead>
      <tbody>
        <tr><td>Late deduction</td><td>${r.late_deduction}</td><td class="neg">-${money(r.late_deduction * r.per_day_rate)}</td></tr>
        <tr><td>Leave deduction</td><td>${r.leave_deduction}</td><td class="neg">-${money(r.leave_deduction * r.per_day_rate)}</td></tr>
        <tr><td>Short leave deduction</td><td>${r.short_deduction}</td><td class="neg">-${money(r.short_deduction * r.per_day_rate)}</td></tr>
        <tr><td>Absent deduction</td><td>${r.absent_deduction}</td><td class="neg">-${money(r.absent_deduction * r.per_day_rate)}</td></tr>
        <tr><td>Approved salary action</td><td>${r.salary_deduction}</td><td class="neg">-${money(r.salary_deduction * r.per_day_rate)}</td></tr>
        <tr><td><b>Payable days</b></td><td><b>${r.payable_days} / ${r.work_days}</b></td><td><b>${money(r.gross_pay)}</b></td></tr>
      </tbody>
    </table>
    <div class="netbox"><span class="l">Net Salary</span><span class="v">${money(r.net_salary)}</span></div>
    ${foot(r.full_name)}
  </div>`).join("");

  const summaryRows = rows.map((r) => `<tr>
    <td><span class="nm">${r.full_name}</span><div class="dp">${r.department || ""}</div></td>
    <td>${r.late_count}</td><td>${r.short_count}</td><td>${r.leave_days}</td><td>${r.absent_days}</td>
    <td class="neg">-${r.total_deduction} Days</td>
    <td class="pay">${r.payable_days} / ${r.work_days} Days</td>
    <td class="pay">${money(r.net_salary)}</td>
  </tr>`).join("");

  const summary = `<div class="page">
    <div class="sum-title">Executive Payroll Summary</div>
    <table class="sum"><thead><tr>
      <th>Employee</th><th>Lates</th><th>Short</th><th>Leave</th><th>Absent</th>
      <th>Total Ded.</th><th>Payable Days</th><th>Net Salary</th>
    </tr></thead><tbody>${summaryRows}</tbody></table>
    ${foot("Summary")}
  </div>`;

  function badge(cls: string, n: number, label: string) {
    return `<div class="badge ${cls}"><div class="n">${n}</div><div class="l">${label}</div></div>`;
  }
  function foot(page: any) {
    return `<div class="foot"><span>${company?.name || "Company"} · Payroll Report</span><span>${page}</span></div>`;
  }

  const w = window.open("", "_blank", "width=900,height=900");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Payroll Report — ${monthName} ${year}</title>
  <style>${css}</style></head><body>${cover}${empPages}${summary}
  <script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}
