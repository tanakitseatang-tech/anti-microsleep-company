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

// replacePhone = true (saving one driver from the form): an emptied phone box clears the phone.
// replacePhone = false (datasheet import): an empty phone cell keeps the saved number.
async function upsertDriver(r, replacePhone = false) {
  // "EMP001", "EMP1", "1" and "001" are the same driver (normalizeDriverCode strips EMP and pads)
  const code = normalizeDriverCode(r?.code);
  const name = str(r?.name, 80);
  const phone = str(r?.phone, 40);
  if (!code || !name) return null;
  const rp = Boolean(replacePhone);
  const [saved] = await sql`
    INSERT INTO drivers (code, name, phone)
    VALUES (${code}, ${name}, ${phone}::text)
    ON CONFLICT (code) DO UPDATE SET
      name  = EXCLUDED.name,
      phone = CASE WHEN ${rp}::boolean THEN EXCLUDED.phone ELSE COALESCE(EXCLUDED.phone, drivers.phone) END
    RETURNING phone`;
  const finalPhone = saved ? saved.phone ?? null : phone;
  // Also refresh any truck currently signed in with this driver code
  // (truck codes may be stored as "EMP1" / "1" / "001": normalise them the same way in SQL)
  await sql`
    UPDATE trucks SET driver_name = ${name}, driver_phone = ${finalPhone}::text
    WHERE (CASE WHEN REGEXP_REPLACE(UPPER(TRIM(COALESCE(driver_code, ''))), '^EMP[[:space:]_-]*', '') ~ '^[0-9]{1,3}$'
                THEN LPAD(REGEXP_REPLACE(UPPER(TRIM(COALESCE(driver_code, ''))), '^EMP[[:space:]_-]*', ''), 3, '0')
                ELSE REGEXP_REPLACE(UPPER(TRIM(COALESCE(driver_code, ''))), '^EMP[[:space:]_-]*', '') END) = ${code}`;
  return { code, name, phone: finalPhone };
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

  const res = await upsertDriver(b, true);
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
