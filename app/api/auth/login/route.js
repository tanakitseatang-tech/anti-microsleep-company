import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/session";
import { dbErrorKind, dbErrorMessage } from "@/lib/dberror";

export const runtime = "nodejs";

const MAX_FAILS = 5;          // wrong passwords in a row ...
const LOCK_MINUTES = 15;      // ... lock the account this long
// compared against when the username does not exist, so both cases take the same time
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export async function POST(request) {
  try {
    return await login(request);
  } catch (e) {
    const kind = dbErrorKind(e);
    console.error("login: database error", e?.code, e?.message);
    return NextResponse.json({ ok: false, error: dbErrorMessage(kind), kind }, { status: 503 });
  }
}

async function login(request) {
  let body;
  try { body = await request.json(); } catch { body = {}; }
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  const fail = (msg, status = 401) => NextResponse.json({ ok: false, error: msg }, { status });
  if (!username || !password) return fail("กรอกชื่อผู้ใช้และรหัสผ่าน", 400);

  const rows = await sql`SELECT * FROM users WHERE username = ${username}`;
  const user = rows[0];
  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    return fail("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  }
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return fail(`บัญชีถูกล็อกชั่วคราว ลองใหม่หลัง ${new Date(user.locked_until).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok" })} น.`, 423);
  }
  if (!(await bcrypt.compare(password, user.password_hash))) {
    const fails = user.failed_attempts + 1;
    if (fails >= MAX_FAILS) {
      await sql`UPDATE users SET failed_attempts = 0,
                locked_until = now() + make_interval(mins => ${LOCK_MINUTES})
                WHERE id = ${user.id}`;
      return fail(`ใส่ผิด ${MAX_FAILS} ครั้ง บัญชีถูกล็อก ${LOCK_MINUTES} นาที`, 423);
    }
    await sql`UPDATE users SET failed_attempts = ${fails} WHERE id = ${user.id}`;
    return fail("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  }
  await sql`UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ${user.id}`;
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(user), sessionCookieOptions());
  return res;
}
