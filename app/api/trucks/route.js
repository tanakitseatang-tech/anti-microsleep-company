// C7 / S5: add/update a single truck or bulk-import a datasheet of many employees & vehicles.
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { sql, ensureTruckColumns, normalizeDriverCode } from "@/lib/db";
import { currentUser, canManage, hashApiKey } from "@/lib/auth";
import { str } from "@/lib/validate";

export const runtime = "nodejs";

// replace = true (editing one truck in the form): an emptied box clears that value.
// replace = false (datasheet import): empty cells keep what is already saved.
async function upsertRow(r, makeNewKey = false, replace = false) {
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
      -- editing / re-importing a revoked truck keeps it revoked; only an explicit new key
      -- (issue_key, admin-checked in POST) or remove_key brings it back
      key_revoked  = CASE WHEN ${Boolean(makeNewKey)}::boolean THEN false ELSE trucks.key_revoked END,
      name         = CASE WHEN ${Boolean(replace)}::boolean THEN ${name}::text ELSE COALESCE(${name}::text, trucks.name) END,
      brand        = CASE WHEN ${Boolean(replace)}::boolean THEN ${brand}::text ELSE COALESCE(${brand}::text, trucks.brand) END,
      model        = CASE WHEN ${Boolean(replace)}::boolean THEN ${model}::text ELSE COALESCE(${model}::text, trucks.model) END,
      vehicle_info = CASE WHEN ${Boolean(replace)}::boolean THEN ${vehicle_info}::text ELSE COALESCE(${vehicle_info}::text, trucks.vehicle_info) END,
      driver_code  = CASE WHEN ${Boolean(replace)}::boolean THEN ${driver_code}::text ELSE COALESCE(${driver_code}::text, trucks.driver_code) END,
      driver_name  = CASE WHEN ${Boolean(replace)}::boolean THEN ${driver_name}::text ELSE COALESCE(${driver_name}::text, trucks.driver_name) END,
      driver_phone = CASE WHEN ${Boolean(replace)}::boolean THEN ${driver_phone}::text ELSE COALESCE(${driver_phone}::text, trucks.driver_phone) END,
      -- a revoked truck's old (possibly stolen) key is replaced, so even a later un-revoke
      -- can never make that old key valid again (SET reads the old row values, before this update)
      api_key_hash = CASE WHEN ${Boolean(makeNewKey)}::boolean OR trucks.key_revoked THEN ${keyHash}::text ELSE trucks.api_key_hash END,
      key_required = CASE WHEN ${Boolean(makeNewKey)}::boolean OR trucks.key_revoked THEN false ELSE trucks.key_required END,
      pending_api_key = CASE WHEN ${Boolean(makeNewKey)}::boolean THEN ${key}::text ELSE trucks.pending_api_key END,
      pending_key_expires_at = CASE WHEN ${Boolean(makeNewKey)}::boolean THEN now() + interval '2 minutes' ELSE trucks.pending_key_expires_at END`;
  // Keep employee directory in sync when a truck row has both driver_code and driver_name.
  // replace (single-truck edit): the directory gets exactly this phone, so a cleared phone stays
  // cleared (the next heartbeat copies drivers.phone back to the truck). Import: keep the saved one.
  if (driver_code && driver_name) {
    const normCode = normalizeDriverCode(driver_code); // EMP1 / emp001 / 1 -> 001
    if (normCode) {
      await sql`
        INSERT INTO drivers (code, name, phone)
        VALUES (${normCode}, ${driver_name}, ${driver_phone}::text)
        ON CONFLICT (code) DO UPDATE SET
          name  = EXCLUDED.name,
          phone = CASE WHEN ${Boolean(replace)}::boolean THEN EXCLUDED.phone
                       ELSE COALESCE(EXCLUDED.phone, drivers.phone) END`;
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

  // A revoked truck can only be brought back (new key / unlock) by an admin: a manager cannot
  // undo an admin's revoke. Editing the row is fine and keeps it revoked.
  if ((b?.remove_key || b?.issue_key) && b?.code && user.role !== "admin") {
    const c = str(b.code, 20);
    if (c) {
      const [t] = await sql`SELECT key_revoked FROM trucks WHERE code = ${c}`;
      if (t?.key_revoked) {
        return NextResponse.json(
          { ok: false, error: "รถคันนี้ถูกเพิกถอนแล้ว เฉพาะผู้ดูแลระบบ (admin) เท่านั้นที่ยกเลิกได้" },
          { status: 403 }
        );
      }
    }
  }

  // Remove/unlock API key for a truck (returns to X-Truck-Code mode and tells board to clear its key file)
  if (b?.remove_key && b?.code) {
    const code = str(b.code, 20);
    if (!code) return NextResponse.json({ ok: false, error: "bad code" }, { status: 400 });
    const autoHash = hashApiKey(`auto:${code}`);
    await sql`
      UPDATE trucks SET
        api_key_hash           = ${autoHash},
        key_required           = false,
        key_revoked            = false,
        pending_api_key        = '__CLEAR__',
        pending_key_expires_at = now() + interval '2 minutes'
      WHERE code = ${code}`;
    return NextResponse.json({ ok: true, code, removed: true });
  }

  // Single truck add / update
  const res = await upsertRow(b, Boolean(b?.issue_key), b?.replace === true);
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
