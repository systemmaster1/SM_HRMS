// ============================================================================
//  /api/settings  —  read/write company profile + Google Sheets sync config.
// ============================================================================
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

async function readSetting(key: string) {
  const s = await prisma.setting.findUnique({ where: { key } });
  return s ? JSON.parse(s.value) : {};
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [company, sheetSync] = await Promise.all([readSetting("company"), readSetting("sheetSync")]);
  return NextResponse.json({ company, sheetSync });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !can(session.role, "settings.manage")) {
    return NextResponse.json({ error: "You don't have permission to change settings." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const ops = [];
    if (body.company) {
      ops.push(prisma.setting.upsert({
        where: { key: "company" },
        update: { value: JSON.stringify(body.company) },
        create: { key: "company", value: JSON.stringify(body.company) },
      }));
    }
    if (body.sheetSync) {
      ops.push(prisma.setting.upsert({
        where: { key: "sheetSync" },
        update: { value: JSON.stringify(body.sheetSync) },
        create: { key: "sheetSync", value: JSON.stringify(body.sheetSync) },
      }));
    }
    await Promise.all(ops);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not save settings." }, { status: 500 });
  }
}
