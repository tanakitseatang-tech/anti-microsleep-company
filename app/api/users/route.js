// C1: Manage 3 user roles (admin | manager | viewer) from the browser. Admin only.
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { currentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request) {
  const user = await currentUser();
  if (user?.role !== "admin") return NextResponse.json({ ok: false, error: "เฉพาะผู้ดูแลระบบ (admin)" }, { status: 403 });
  let b;
  try { b = await request.json(); } catch { b = {}; }

  // Unlock a locked account
  if (b.action === "unlock" && Number.isInteger(Number(b.id))) {
    await sql`UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ${Number(b.id)}`;
    return NextResponse.json({ ok: true });
  }

  const username = String(b.username || "").trim().toLowerCase();
  const password = String(b.password || "");
  const role = ["admin", "manager", "viewer"].includes(b.role) ? b.role : "viewer";
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return NextResponse.json({ ok: false, error: "ชื่อผู้ใช้ 3–32 ตัว (a-z 0-9 . _ -)" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ ok: false, error: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" }, { status: 400 });
  }
  // never leave the company without an admin: no demoting yourself or the last admin
  const [target] = await sql`SELECT id, role FROM users WHERE username = ${username}`;
  if (target && target.role === "admin" && role !== "admin") {
    if (target.id === user.id) {
      return NextResponse.json({ ok: false, error: "เปลี่ยนสิทธิ์ของบัญชีตัวเองไม่ได้ (ให้ admin คนอื่นทำ)" }, { status: 400 });
    }
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM users WHERE role = 'admin'`;
    if (n <= 1) return NextResponse.json({ ok: false, error: "ต้องมี admin อย่างน้อย 1 คน" }, { status: 400 });
  }
  const hash = await bcrypt.hash(password, 10);
  await sql`
    INSERT INTO users (username, password_hash, role, failed_attempts, locked_until)
    VALUES (${username}, ${hash}, ${role}, 0, NULL)
    ON CONFLICT (username) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      role = EXCLUDED.role,
      failed_attempts = 0,
      locked_until = NULL`;
  return NextResponse.json({ ok: true, username, role });
}

export async function DELETE(request) {
  const user = await currentUser();
  if (user?.role !== "admin") return NextResponse.json({ ok: false, error: "admin only" }, { status: 403 });
  let b;
  try { b = await request.json(); } catch { b = {}; }
  const id = Number(b.id);
  if (!Number.isInteger(id) || id === user.id) {
    return NextResponse.json({ ok: false, error: "ลบบัญชีที่กำลังใช้งานอยู่ไม่ได้" }, { status: 400 });
  }
  const [target] = await sql`SELECT role FROM users WHERE id = ${id}`;
  if (!target) return NextResponse.json({ ok: false, error: "ไม่พบผู้ใช้นี้" }, { status: 404 });
  if (target.role === "admin") {
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM users WHERE role = 'admin'`;
    if (n <= 1) return NextResponse.json({ ok: false, error: "ต้องมี admin อย่างน้อย 1 คน" }, { status: 400 });
  }
  // cases this user closed keep their note; only the link to the deleted account is removed
  await sql`UPDATE events SET closed_by = NULL WHERE closed_by = ${id}`;
  await sql`DELETE FROM users WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
