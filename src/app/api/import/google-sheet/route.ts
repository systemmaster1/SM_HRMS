import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Tab = { name: string; gid: string };

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function grab(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,*/*" },
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

/** Pulls {name, gid} pairs out of whatever Google gave us, using several patterns. */
function extractTabs(html: string): Tab[] {
  const found = new Map<string, Tab>();
  const add = (name: string, gid: string) => {
    const n = name
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .trim();
    if (!n || n.length > 120) return;

    // Dedupe by name — the same tab can surface from more than one pattern,
    // and only some of those patterns carry a real gid.
    const key = n.toLowerCase();
    const existing = found.get(key);
    if (!existing) found.set(key, { name: n, gid: gid || "" });
    else if (!existing.gid && gid) existing.gid = gid;
  };

  // 1. htmlview / pubhtml sheet menu:  <a href="#gid=0">Sheet1</a>
  let m: RegExpExecArray | null;
  const reAnchor = /href=["']#gid=(\d+)["'][^>]*>([^<]{1,120})</g;
  while ((m = reAnchor.exec(html))) add(m[2], m[1]);

  // 2. sheet-button list items. The number here is a menu index, NOT a gid,
  //    so we take the name only and let pattern 1 supply the gid.
  const reButton = /id=["']sheet-button-\d+["'][^>]*>(?:\s*<a[^>]*>)?\s*([^<]{1,120})</g;
  while ((m = reButton.exec(html))) add(m[1], "");

  // 3. bootstrap JSON on the /edit page:  {"name":"Sheet1", ... "gid":0
  const reJson = /\{"name":"((?:[^"\\]|\\.){1,120})"[^{}]{0,200}?"(?:gid|sheetId)":"?(\d+)/g;
  while ((m = reJson.exec(html))) add(m[1].replace(/\\u([\da-f]{4})/gi,
    (_, h) => String.fromCharCode(parseInt(h, 16))), m[2]);

  // 4. array form used by newer bootstrap payloads:  ,"Sheet1",0,...  next to gid
  const reArr = /"([^"\\]{1,80})",(\d{1,12}),\d+,\d+,\d+,\[\]/g;
  while ((m = reArr.exec(html))) add(m[1], m[2]);

  return Array.from(found.values());
}

export async function POST(req: Request) {
  try {
    const { sheetId, action, tab, gid } = await req.json();

    if (!sheetId) {
      return NextResponse.json({ error: "No spreadsheet ID supplied." }, { status: 400 });
    }

    const base = `https://docs.google.com/spreadsheets/d/${sheetId}`;

    /* ---------------- List the tabs ---------------- */
    if (action === "tabs") {
      // Confirm the sheet is actually readable before anything else
      const probe = await fetch(`${base}/gviz/tq?tqx=out:csv`, {
        cache: "no-store",
        headers: { "User-Agent": UA },
      });

      const probeText = probe.ok ? await probe.text() : "";

      if (!probe.ok || probeText.trim().startsWith("<")) {
        return NextResponse.json(
          {
            error:
              "That spreadsheet is not publicly readable. Open it, click Share, set General access to 'Anyone with the link' with the role 'Viewer', then try again.",
          },
          { status: 400 }
        );
      }

      // Try several pages — different sheets expose their tab list differently
      const pages = await Promise.all([
        grab(`${base}/htmlview`),
        grab(`${base}/pubhtml`),
        grab(`${base}/edit`),
      ]);

      const tabs: Tab[] = [];
      const seen = new Set<string>();
      for (const html of pages) {
        if (!html) continue;
        for (const t of extractTabs(html)) {
          const key = t.gid || t.name;
          if (!seen.has(key)) { seen.add(key); tabs.push(t); }
        }
      }

      // Drop obvious junk that the looser patterns can pick up
      const clean = tabs.filter(
        (t) => !/^(true|false|null|undefined|function|var|https?:)/i.test(t.name)
      );

      return NextResponse.json({
        tabs: clean,
        detected: clean.length > 0,
      });
    }

    /* ---------------- Read one tab ---------------- */
    let url = `${base}/gviz/tq?tqx=out:csv`;
    if (gid) url += `&gid=${encodeURIComponent(gid)}`;
    else if (tab) url += `&sheet=${encodeURIComponent(tab)}`;

    const res = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": UA },
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          error:
            "Could not read that tab. Check the tab name is spelled exactly as it appears in your spreadsheet.",
        },
        { status: 400 }
      );
    }

    const csv = await res.text();

    if (csv.trim().startsWith("<")) {
      return NextResponse.json(
        {
          error:
            "The spreadsheet is not publicly readable. Set sharing to 'Anyone with the link — Viewer' and try again.",
        },
        { status: 400 }
      );
    }

    if (!csv.trim()) {
      return NextResponse.json(
        { error: "That tab came back empty. Check you picked the right one." },
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
