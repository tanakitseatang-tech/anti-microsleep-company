// C7 / S5: add/update a single truck or bulk-import a datasheet of many employees & vehicles.
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { sql, ensureTruckColumns, normalizeDriverCode } from "@/lib/db";
import { currentUser, canManage, hashApiKey } from "@/lib/auth";
import { str } from "@/lib/validate";

export const runtime = "nodejs";

async function upsertRow(r, makeNewKey = false) {
  const code = str(r?.code, 20);
  if (!code || !/^[\p{L}\p{N} ._-]+$/u.test(code)) return null;
  const name = str(r?.name, 60);
  const brand = str(r?.brand, 60);
  const model = str(r?.model, 60);
  const vehicle_info = str(r?.vehicle_info, 120);
  const driver_code = str(r?.driver_code, 40);
  const driver_name = str(r?.driver_name, 80);
  const driver_phone = str(r?.driver_phone, 40);

  const key = makeNewKey ? "ams_" + randomBytes(24).toString("base64url") : null;
  const keyHash = key ? hashApiKey(key) : hashApiKey(`auto:${code}:${randomBytes(8).toString("hex")}`);

  await sql`
    INSERT INTO trucks (
      code, name, brand, model, vehicle_info,
      driver_code, driver_name, driver_phone, api_key_hash
    ) VALUES (
      ${code}, ${name}, ${brand}, ${model}, ${vehicle_info},
      ${driver_code}, ${driver_name}, ${driver_phone}, ${keyHash}
    )
    ON CONFLICT (code) DO UPDATE SET
      key_revoked  = false,
      name         = COALESCE(${name}, trucks.name),
      brand        = COALESCE(${brand}, trucks.brand),
      model        = COALESCE(${model}, trucks.model),
      vehicle_info = COALESCE(${vehicle_info}, trucks.vehicle_info),
      driver_code  = COALESCE(${driver_code}, trucks.driver_code),
      driver_name  = COALESCE(${driver_name}, trucks.driver_name),
      driver_phone = COALESCE(${driver_phone}, trucks.driver_phone),
      api_key_hash = CASE WHEN ${Boolean(makeNewKey)} THEN ${keyHash} ELSE trucks.api_key_hash END,
      key_required = CASE WHEN ${Boolean(makeNewKey)} THEN false ELSE trucks.key_required END,
      pending_api_key = CASE WHEN ${Boolean(makeNewKey)} THEN ${key} ELSE trucks.pending_api_key END,
      pending_key_expires_at = CASE WHEN ${Boolean(makeNewKey)} THEN now() + interval '2 minutes' ELSE trucks.pending_key_expires_at END`;
  // Keep employee directory in sync when a truck row has both driver_code and driver_name
  if (driver_code && driver_name) {
    const normCode = normalizeDriverCode(driver_code.replace(/^EMP/i, ""));
    if (normCode) {
      await sql`
        INSERT INTO drivers (code, name, phone)
        VALUES (${normCode}, ${driver_name}, ${driver_phone})
        ON CONFLICT (code) DO UPDATE SET
          name  = EXCLUDED.name,
          phone = COALESCE(EXCLUDED.phone, drivers.phone)`;
    }
  }
  return { code, key };
}

export async function POST(request) {
  const user = await currentUser();
  if (!canManage(user)) return NextResponse.json({ ok: false, error: "admin/manager only" }, { status: 403 });
  await ensureTruckColumns();

  let b;
  try { b = await request.json(); } catch { b = {}; }

  // Bulk datasheet import: { rows: [...] }
  if (Array.isArray(b?.rows)) {
    if (b.rows.length > 500) {
      return NextResponse.json({ ok: false, error: "นำเข้าได้สูงสุด 500 แถวต่อครั้ง" }, { status: 400 });
    }
    let imported = 0, skipped = 0;
    for (const row of b.rows) {
      const res = await upsertRow(row, false);
      if (res) imported++; else skipped++;
    }
    return NextResponse.json({ ok: true, imported, skipped });
  }

  // Single truck add / update
  const res = await upsertRow(b, Boolean(b?.issue_key));
  if (!res) {
    return NextResponse.json(
      { ok: false, error: "รหัสรถใช้ตัวอักษร ตัวเลข . _ - และเว้นวรรคได้ ไม่เกิน 20 ตัว" },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true, code: res.code, key: res.key });
}

export async function DELETE(request) {
  const user = await currentUser();
  if (!canManage(user)) return NextResponse.json({ ok: false, error: "admin/manager only" }, { status: 403 });
  let b;
  try { b = await request.json(); } catch { b = {}; }
  const id = Number(b?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });
  }
  await sql`DELETE FROM trucks WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
