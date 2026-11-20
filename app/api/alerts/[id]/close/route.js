// C4: close an alert case (manager/admin only).
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { currentUser, canManage } from "@/lib/auth";
import { str } from "@/lib/validate";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  const user = await currentUser();
  if (!canManage(user)) return NextResponse.json({ ok: false, error: "not allowed" }, { status: 403 });
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });
  let b;
  try { b = await request.json(); } catch { b = {}; }
  const rows = await sql`
    UPDATE events SET closed_at = now(), closed_by = ${user.id}, close_note = ${str(b.note, 500)}
    WHERE id = ${id} AND closed_at IS NULL
    RETURNING id`;
  return NextResponse.json({ ok: rows.length === 1 });
}
