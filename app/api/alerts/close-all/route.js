// C4: close ALL open alert cases at once (manager/admin only), e.g. old test cases before a demo.
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { currentUser, canManage } from "@/lib/auth";
import { str } from "@/lib/validate";

export const runtime = "nodejs";

export async function POST(request) {
  const user = await currentUser();
  if (!canManage(user)) return NextResponse.json({ ok: false, error: "not allowed" }, { status: 403 });
  let b;
  try { b = await request.json(); } catch { b = {}; }
  const note = str(b.note, 500) || "ปิดทั้งหมดพร้อมกัน";
  const rows = await sql`
    UPDATE events SET closed_at = now(), closed_by = ${user.id}, close_note = ${note}
    WHERE closed_at IS NULL
    RETURNING id`;
  return NextResponse.json({ ok: true, closed: rows.length });
}
