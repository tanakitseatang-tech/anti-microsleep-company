// C7 / S5: add a truck (or give an existing one a new key). Admin only.
// The new API key is returned ONCE; only its SHA-256 hash is stored.
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { sql } from "@/lib/db";
import { currentUser, hashApiKey } from "@/lib/auth";
import { str } from "@/lib/validate";

export const runtime = "nodejs";

export async function POST(request) {
  const user = await currentUser();
  if (user?.role !== "admin") return NextResponse.json({ ok: false, error: "admin only" }, { status: 403 });
  let b;
  try { b = await request.json(); } catch { b = {}; }
  const code = str(b.code, 20);
  if (!code || !/^[\p{L}\p{N} ._-]+$/u.test(code)) {
    return NextResponse.json({ ok: false, error: "รหัสรถใช้ตัวอักษร ตัวเลข . _ - และเว้นวรรคได้ ไม่เกิน 20 ตัว" }, { status: 400 });
  }
  const key = "ams_" + randomBytes(24).toString("base64url");
  await sql`
    INSERT INTO trucks (code, name, api_key_hash) VALUES (${code}, ${str(b.name, 60)}, ${hashApiKey(key)})
    ON CONFLICT (code) DO UPDATE SET api_key_hash = EXCLUDED.api_key_hash, key_revoked = false,
      name = COALESCE(EXCLUDED.name, trucks.name)`;
  return NextResponse.json({ ok: true, code, key });
}
