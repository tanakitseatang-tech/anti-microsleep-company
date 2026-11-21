// Employee / driver directory (3-digit codes like 001 -> สมชาย ใจดี).
// Drivers just enter their 3-digit code on the truck's driver page and the company server resolves their name & phone.
import { NextResponse } from "next/server";
import { sql, ensureTruckColumns, normalizeDriverCode } from "@/lib/db";
import { currentUser, canManage } from "@/lib/auth";
import { str } from "@/lib/validate";

export const runtime = "nodejs";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  await ensureTruckColumns();
  const rows = await sql`SELECT code, name, phone FROM drivers ORDER BY code ASC`;
  return NextResponse.json({ ok: true, drivers: rows });
}

async function upsertDriver(r) {
  const code = normalizeDriverCode(r?.code);
  const name = str(r?.name, 80);
  const phone = str(r?.phone, 40);
  if (!code || !name) return null;
  await sql`
    INSERT INTO drivers (code, name, phone)
    VALUES (${code}, ${name}, ${phone})
    ON CONFLICT (code) DO UPDATE SET
      name  = EXCLUDED.name,
      phone = COALESCE(EXCLUDED.phone, drivers.phone)`;
  // Also refresh any truck currently signed in with this driver code
  await sql`
    UPDATE trucks SET driver_name = ${name}, driver_phone = COALESCE(${phone}, driver_phone)
    WHERE UPPER(COALESCE(driver_code, '')) = ${code}`;
  return { code, name, phone };
}

export async function POST(request) {
  const user = await currentUser();
  if (!canManage(user)) return NextResponse.json({ ok: false, error: "admin/manager only" }, { status: 403 });
  await ensureTruckColumns();
  let b;
  try { b = await request.json(); } catch { b = {}; }

  if (Array.isArray(b?.rows)) {
    if (b.rows.length > 500) {
      return NextResponse.json({ ok: false, error: "นำเข้าได้สูงสุด 500 คนต่อครั้ง" }, { status: 400 });
    }
    let imported = 0, skipped = 0;
    for (const row of b.rows) {
      const res = await upsertDriver(row);
      if (res) imported++; else skipped++;
    }
    return NextResponse.json({ ok: true, imported, skipped });
  }

  const res = await upsertDriver(b);
  if (!res) {
    return NextResponse.json({ ok: false, error: "กรุณาระบุรหัสพนักงาน (เช่น 001) และชื่อพนักงาน" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, driver: res });
}

export async function DELETE(request) {
  const user = await currentUser();
  if (!canManage(user)) return NextResponse.json({ ok: false, error: "admin/manager only" }, { status: 403 });
  await ensureTruckColumns();
  let b;
  try { b = await request.json(); } catch { b = {}; }
  const code = normalizeDriverCode(b?.code);
  if (!code) return NextResponse.json({ ok: false, error: "bad code" }, { status: 400 });
  await sql`DELETE FROM drivers WHERE code = ${code}`;
  return NextResponse.json({ ok: true });
}
