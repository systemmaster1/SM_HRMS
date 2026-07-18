import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Reads a Google Sheet that has been shared as "Anyone with the link — Viewer".
 *
 *  POST { sheetId, action: "tabs" }              -> list of sheet tab names
 *  POST { sheetId, action: "rows", tab: "..." }  -> raw CSV text of that tab
 *
 * Everything is fetched server-side so the browser never hits Google's
 * CORS restrictions, and no Google credentials are ever required.
 */
export async function POST(req: Request) {
  try {
    const { sheetId, action, tab } = await req.json();

    if (!sheetId) {
      return NextResponse.json({ error: "No spreadsheet ID supplied." }, { status: 400 });
    }

    /* ---------- List the tabs ---------- */
    if (action === "tabs") {
      const res = await fetch(
        `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&tq=${encodeURIComponent(
          "select * limit 1"
        )}`,
        { cache: "no-store" }
      );

      if (!res.ok) {
        return NextResponse.json(
          { error: "Could not open that spreadsheet. Make sure link sharing is set to 'Anyone with the link — Viewer'." },
          { status: 400 }
        );
      }

      // The HTML page carries the tab list; fall back to the default tab.
      const htmlRes = await fetch(
        `https://docs.google.com/spreadsheets/d/${sheetId}/htmlview`,
        { cache: "no-store" }
      );
      const html = htmlRes.ok ? await htmlRes.text() : "";

      const names = new Set<string>();
      const re = /<li[^>]*id="sheet-button-[^"]*"[^>]*>(?:<a[^>]*>)?([^<]+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(html))) {
        const n = m[1].trim();
        if (n) names.add(n);
      }

      return NextResponse.json({
        tabs: names.size ? Array.from(names) : ["Sheet1"],
      });
    }

    /* ---------- Read the rows of one tab ---------- */
    const url = tab
      ? `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`
      : `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;

    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Could not read that tab. Check the sheet name and that link sharing is enabled." },
        { status: 400 }
      );
    }

    const csv = await res.text();

    if (csv.trim().startsWith("<")) {
      return NextResponse.json(
        { error: "The spreadsheet is not publicly readable. Set sharing to 'Anyone with the link — Viewer' and try again." },
        { status: 400 }
      );
    }

    return NextResponse.json({ csv });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Something went wrong reading the spreadsheet." },
      { status: 500 }
    );
  }
}
