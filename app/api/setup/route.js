// First-time setup, from the browser (no command line needed):
// creates the tables from db/schema.sql and the first admin account.
// Works only while there are no users; after that it refuses.
import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { sql, rawQuery } from "@/lib/db";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function schemaStatements() {
  const text = readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf8")
    .split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  return text.split(";").map((s) => s.trim()).filter(Boolean);
}

async function hasUsers() {
  try {
    const [r] = await sql`SELECT count(*)::int AS n FROM users`;
    return r.n > 0;
  } catch (e) {
    if (e?.code === "42P01") return false;   // table not created yet = setup still open
    throw e;                                 // database down: do NOT treat as "no users"
  }
}

// GET: is setup still open?
export async function GET() {
  try {
    return NextResponse.json({ open: !(await hasUsers()) });
  } catch {
    return NextResponse.json({ open: false, error: "database unavailable" }, { status: 503 });
  }
}

export async function POST(request) {
  try {
    return await setup(request);
  } catch (e) {
    console.error("setup failed", e?.code, e?.message);
    return NextResponse.json({ ok: false, error: "เชื่อมต่อฐานข้อมูลไม่ได้ ลองใหม่อีกครั้ง" }, { status: 503 });
  }
}

async function setup(request) {
  let b;
  try { b = await request.json(); } catch { b = {}; }
  if (!b || typeof b !== "object") b = {};
  const username = String(b.username || "").trim().toLowerCase();
  const password = String(b.password || "");
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return NextResponse.json({ ok: false, error: "ชื่อผู้ใช้ 3–32 ตัว ใช้ a-z 0-9 . _ - เท่านั้น" }, { status: 400 });
  }
  if (password.length < 10) {
    return NextResponse.json({ ok: false, error: "รหัสผ่านต้องยาวอย่างน้อย 10 ตัว" }, { status: 400 });
  }
  if (await hasUsers()) {
    return NextResponse.json({ ok: false, error: "ตั้งค่าไปแล้ว ไปที่หน้าเข้าสู่ระบบ" }, { status: 403 });
  }
  for (const s of schemaStatements()) await rawQuery(s);
  const hash = await bcrypt.hash(password, 12);
  // the WHERE NOT EXISTS makes two setup requests at the same moment create only one admin
  const rows = await sql`
    INSERT INTO users (username, password_hash, role)
    SELECT ${username}, ${hash}, 'admin'
    WHERE NOT EXISTS (SELECT 1 FROM users)
    RETURNING id, username, role`;
  if (!rows.length) {
    return NextResponse.json({ ok: false, error: "ตั้งค่าไปแล้ว ไปที่หน้าเข้าสู่ระบบ" }, { status: 403 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(rows[0]), sessionCookieOptions());
  return res;
}
