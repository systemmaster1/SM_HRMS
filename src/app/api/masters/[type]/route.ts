// ============================================================================
//  /api/masters/[type]  —  generic CRUD for simple master lists.
//  GET (list) · POST (create) · PUT (update by id) · DELETE (by id).
// ============================================================================
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { MASTER_TYPES } from "@/lib/master-config";

// Map a master type key to its Prisma delegate + default ordering.
function model(type: string): { delegate: any; order: any } | null {
  const map: Record<string, { delegate: any; order: any }> = {
    brand: { delegate: prisma.brand, order: { name: "asc" } },
    category: { delegate: prisma.category, order: { name: "asc" } },
    unit: { delegate: prisma.unit, order: { name: "asc" } },
    oem: { delegate: prisma.oEMBrand, order: { name: "asc" } },
    hsn: { delegate: prisma.hSNCode, order: { code: "asc" } },
    warehouse: { delegate: prisma.warehouse, order: { name: "asc" } },
    vendor: { delegate: prisma.vendor, order: { name: "asc" } },
    customer: { delegate: prisma.customer, order: { name: "asc" } },
  };
  return map[type] ?? null;
}

// Build a clean data object from the request body using the type's field config.
function buildData(type: string, body: any) {
  const cfg = MASTER_TYPES[type];
  const data: Record<string, any> = {};
  for (const field of cfg.fields) {
    const raw = body[field.key];
    if (field.type === "number") data[field.key] = raw === "" || raw == null ? 0 : Number(raw) || 0;
    else data[field.key] = raw == null ? "" : String(raw).trim();
  }
  return data;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const m = model(type);
  if (!m || !MASTER_TYPES[type]) return NextResponse.json({ error: "Unknown master type" }, { status: 404 });

  const rows = await m.delegate.findMany({ orderBy: m.order });
  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const session = await getSession();
  if (!session || !can(session.role, "masters.manage")) {
    return NextResponse.json({ error: "You don't have permission to manage masters." }, { status: 403 });
  }
  const m = model(type);
  if (!m || !MASTER_TYPES[type]) return NextResponse.json({ error: "Unknown master type" }, { status: 404 });

  try {
    const body = await req.json();
    const data = buildData(type, body);
    const row = await m.delegate.create({ data });
    return NextResponse.json({ row });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "A record with this value already exists." }, { status: 409 });
    return NextResponse.json({ error: "Could not save. Try again." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const session = await getSession();
  if (!session || !can(session.role, "masters.manage")) {
    return NextResponse.json({ error: "You don't have permission to manage masters." }, { status: 403 });
  }
  const m = model(type);
  if (!m || !MASTER_TYPES[type]) return NextResponse.json({ error: "Unknown master type" }, { status: 404 });

  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "Missing record id." }, { status: 400 });
    const data = buildData(type, body);
    const row = await m.delegate.update({ where: { id: body.id }, data });
    return NextResponse.json({ row });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "A record with this value already exists." }, { status: 409 });
    return NextResponse.json({ error: "Could not update. Try again." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const session = await getSession();
  if (!session || !can(session.role, "masters.manage")) {
    return NextResponse.json({ error: "You don't have permission to manage masters." }, { status: 403 });
  }
  const m = model(type);
  if (!m || !MASTER_TYPES[type]) return NextResponse.json({ error: "Unknown master type" }, { status: 404 });

  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "Missing record id." }, { status: 400 });
    await m.delegate.delete({ where: { id: body.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // Foreign-key violation — record is referenced elsewhere.
    if (e?.code === "P2003") {
      return NextResponse.json({ error: "This record is in use and cannot be deleted." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not delete. Try again." }, { status: 500 });
  }
}
