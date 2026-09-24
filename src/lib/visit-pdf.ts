"use client";

import {
  arrivalDelayMinutes, visitMinutes, visitState, STATE_LABEL, fmtMins, visitArrival,
} from "@/lib/tracking";
import { saveBlob } from "@/lib/download";

export type DaySummary = {
  date: string;              // YYYY-MM-DD
  km: number;
  first: number | null;      // epoch ms
  last: number | null;
  fieldMinutes: number;
  stops: number;
  gaps: number;
  gapMinutes: number;
};

type Opts = {
  company: { name?: string | null; logo_url?: string | null; address?: string | null; city?: string | null };
  employee: { full_name?: string | null; employee_code?: string | null; department?: string | null;
              designation?: string | null; phone?: string | null };
  from: string;
  to: string;
  visits: any[];
  days: DaySummary[];
  generatedBy?: string | null;
};

const NAVY: [number, number, number] = [5, 58, 110];
const ORANGE: [number, number, number] = [232, 121, 42];
const GREY: [number, number, number] = [100, 116, 139];

const TZ = "Asia/Kolkata";
const dDate = (ymd: string) =>
  new Date(`${ymd}T00:00:00+05:30`).toLocaleDateString("en-IN", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" });
const dTime = (ts: string | number | null | undefined) =>
  ts == null || ts === "" ? "—"
    : new Date(ts).toLocaleTimeString("en-IN", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: true });
const dStamp = (ts: string | null | undefined) =>
  !ts ? "—" : new Date(ts).toLocaleString("en-IN", {
    timeZone: TZ, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true,
  });
/** Standard PDF fonts only cover Latin text; keep the file readable if a name uses another script. */
const clean = (v: any) => String(v ?? "").replace(/[^\x20-\x7E\u00A0-\u00FF\u2013\u2014\u2019\u2022]/g, "?").trim();

async function loadLogo(url?: string | null): Promise<{ data: string; fmt: "PNG" | "JPEG"; w: number; h: number } | null> {
  if (!url) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, { signal: ctrl.signal, cache: "force-cache" });
    clearTimeout(t);
    if (!res.ok) return null;
    const blob = await res.blob();
    const fmt = blob.type.includes("png") ? "PNG" : blob.type.includes("jpeg") || blob.type.includes("jpg") ? "JPEG" : null;
    if (!fmt) return null;
    const data: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
    const dims: { w: number; h: number } = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = data;
    });
    return { data, fmt, ...dims };
  } catch {
    return null;
  }
}

/** Builds the PDF and hands it to the browser / Android app. */
export async function downloadVisitLogPdf(o: Opts): Promise<void> {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = (autoTableMod as any).default || (autoTableMod as any).autoTable;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 12;

  /* ---------- Header band ---------- */
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 24, "F");
  doc.setFillColor(...ORANGE);
  doc.rect(0, 24, W, 1.2, "F");

  let textX = M;
  const logo = await loadLogo(o.company.logo_url);
  if (logo) {
    const h = 14, w = Math.min(34, (logo.w / logo.h) * h);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(M - 1, 4, w + 2, h + 2, 1.5, 1.5, "F");
    doc.addImage(logo.data, logo.fmt, M, 5, w, h);
    textX = M + w + 5;
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(clean(o.company.name || "SM HRMS"), textX, 11.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const addr = [o.company.address, o.company.city].filter(Boolean).map(clean).join(", ");
  if (addr) doc.text(addr.slice(0, 110), textX, 17);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("FIELD VISIT LOG", W - M, 11.5, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`${dDate(o.from)}  to  ${dDate(o.to)}`, W - M, 17, { align: "right" });

  /* ---------- Employee block ---------- */
  doc.setTextColor(15, 23, 42);
  let y = 33;
  const kv = (label: string, value: string, x: number) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...GREY);
    doc.text(label.toUpperCase(), x, y);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(15, 23, 42);
    doc.text(clean(value) || "—", x, y + 5);
  };
  kv("Employee", o.employee.full_name || "", M);
  kv("Employee code", o.employee.employee_code || "", M + 70);
  kv("Department", o.employee.department || "", M + 115);
  kv("Designation", o.employee.designation || "", M + 165);
  kv("Mobile", o.employee.phone || "", M + 220);

  /* ---------- Summary tiles ---------- */
  const states = o.visits.map(visitState);
  const planned = o.visits.length;
  const completed = states.filter((s) => s === "completed").length;
  const inProgress = states.filter((s) => s === "in_progress").length;
  const missed = states.filter((s) => s === "missed").length;
  const withDelay = o.visits.map(arrivalDelayMinutes).filter((d): d is number => d != null);
  const onTime = withDelay.filter((d) => d <= 15).length;
  const onTimePct = withDelay.length ? Math.round((onTime / withDelay.length) * 100) : null;
  const clientMins = o.visits.map(visitMinutes).filter((m): m is number => m != null).reduce((a, b) => a + b, 0);
  const totalKm = o.days.reduce((a, d) => a + d.km, 0);

  y = 46;
  const tiles: [string, string][] = [
    ["Visits planned", String(planned)],
    ["Completed", String(completed)],
    ["In progress", String(inProgress)],
    ["Missed / pending", String(missed)],
    ["On time (±15 min)", onTimePct == null ? "—" : `${onTimePct}%`],
    ["Distance travelled", `${totalKm.toFixed(1)} km`],
    ["Time at clients", fmtMins(clientMins)],
  ];
  const tw = (W - 2 * M - 6 * 3) / 7;
  tiles.forEach(([label, value], i) => {
    const x = M + i * (tw + 3);
    doc.setFillColor(246, 248, 251);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, tw, 16, 2, 2, "FD");
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...GREY);
    doc.text(label.toUpperCase(), x + 3, y + 5.5);
    doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.setTextColor(...(label === "Missed / pending" && missed > 0 ? [225, 29, 72] as [number, number, number] : NAVY));
    doc.text(value, x + 3, y + 12.5);
  });

  /* ---------- Visits table ---------- */
  const sorted = [...o.visits].sort((a, b) =>
    String(a.scheduled_at || a.visit_date).localeCompare(String(b.scheduled_at || b.visit_date)));

  autoTable(doc, {
    startY: y + 22,
    margin: { left: M, right: M, bottom: 16 },
    head: [["#", "Date", "Client / company", "Purpose", "Planned", "Reached", "Finished",
            "At client", "vs plan", "Status", "Outcome & notes"]],
    body: sorted.map((v, i) => {
      const delay = arrivalDelayMinutes(v);
      const orig = v.original_scheduled_at && v.scheduled_at && v.original_scheduled_at !== v.scheduled_at
        ? `\n(first planned ${dStamp(v.original_scheduled_at)})` : "";
      const client = [v.client_name, v.company_name && v.company_name !== v.client_name ? v.company_name : null,
                      v.contact_person ? `Contact: ${v.contact_person}` : null].filter(Boolean).map(clean).join("\n");
      const notes = [v.outcome ? `Outcome: ${String(v.outcome).replace(/_/g, " ")}` : null,
                     v.person_met ? `Met: ${v.person_met}` : null,
                     v.completion_notes || null,
                     v.next_followup_at ? `Follow-up: ${dStamp(v.next_followup_at)}` : null]
        .filter(Boolean).map(clean).join("\n");
      return [
        String(i + 1),
        dDate(v.visit_date),
        client || "—",
        clean(v.purpose) || "—",
        (v.scheduled_at ? dTime(v.scheduled_at) : "—") + orig,
        dTime(visitArrival(v)),
        dTime(v.completed_at),
        fmtMins(visitMinutes(v)),
        delay == null ? "—" : delay > 0 ? `${delay} min late` : delay < 0 ? `${-delay} min early` : "On time",
        STATE_LABEL[visitState(v)],
        notes || "—",
      ];
    }),
    styles: { font: "helvetica", fontSize: 7.6, cellPadding: 1.8, valign: "top", lineColor: [226, 232, 240], lineWidth: 0.1 },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 7.8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 7, halign: "center" },
      1: { cellWidth: 20 },
      2: { cellWidth: 40 },
      3: { cellWidth: 32 },
      4: { cellWidth: 24 },
      5: { cellWidth: 17 },
      6: { cellWidth: 19 },
      7: { cellWidth: 15 },
      8: { cellWidth: 19 },
      9: { cellWidth: 20 },
      10: { cellWidth: "auto" },
    },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.column.index === 9) {
        const t = String(data.cell.raw);
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor =
          t === "Completed" ? [5, 150, 105] : t.startsWith("Missed") ? [225, 29, 72] : t === "In progress" ? [37, 99, 235] : [71, 85, 105];
      }
      // Arrivals within 15 minutes count as on time (same rule as the summary).
      if (data.section === "body" && data.column.index === 8 && /(\d+) min late/.test(String(data.cell.raw))) {
        const late = Number(String(data.cell.raw).match(/(\d+) min late/)![1]);
        if (late > 15) data.cell.styles.textColor = [194, 65, 12];
      }
    },
  });

  /* ---------- Daily movement ---------- */
  if (o.days.length) {
    let startY = (doc as any).lastAutoTable.finalY + 8;
    if (startY > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); startY = 16; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...NAVY);
    doc.text("Daily movement (GPS)", M, startY);

    autoTable(doc, {
      startY: startY + 3,
      margin: { left: M, right: M, bottom: 16 },
      head: [["Date", "First GPS", "Last GPS", "Time in field", "Distance", "Stops (10+ min)", "GPS gaps", "Visits done / planned"]],
      body: o.days.map((d) => {
        const dayVisits = o.visits.filter((v) => v.visit_date === d.date);
        const done = dayVisits.filter((v) => visitState(v) === "completed").length;
        return [
          dDate(d.date), dTime(d.first), dTime(d.last), fmtMins(d.fieldMinutes),
          `${d.km.toFixed(1)} km`, String(d.stops),
          d.gaps ? `${d.gaps} (${fmtMins(d.gapMinutes)})` : "None",
          `${done} / ${dayVisits.length}`,
        ];
      }),
      foot: [["Total", "", "", fmtMins(o.days.reduce((a, d) => a + d.fieldMinutes, 0)),
              `${totalKm.toFixed(1)} km`, String(o.days.reduce((a, d) => a + d.stops, 0)),
              String(o.days.reduce((a, d) => a + d.gaps, 0)), `${completed} / ${planned}`]],
      styles: { font: "helvetica", fontSize: 8, cellPadding: 1.8, lineColor: [226, 232, 240], lineWidth: 0.1 },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
  }

  /* ---------- Footer on every page ---------- */
  const pages = doc.getNumberOfPages();
  const H = doc.internal.pageSize.getHeight();
  const generated = new Date().toLocaleString("en-IN", {
    timeZone: TZ, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
  });
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.line(M, H - 11, W - M, H - 11);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...GREY);
    doc.text(
      `Generated ${generated}${o.generatedBy ? ` by ${clean(o.generatedBy)}` : ""} · Times are system-recorded (IST) and cannot be edited once captured. Distance is estimated from GPS.`,
      M, H - 6.5,
    );
    doc.text(`Page ${p} of ${pages}`, W - M, H - 6.5, { align: "right" });
  }

  const name = clean(o.employee.full_name || "Employee").replace(/\s+/g, "_");
  const file = `Visit_Log_${name}_${o.from}${o.from !== o.to ? `_to_${o.to}` : ""}.pdf`;
  await saveBlob(doc.output("blob"), file);
}
