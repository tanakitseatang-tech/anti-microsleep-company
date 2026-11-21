// "Hide test data" (admin only): marks every event up to now as archived, and closes any that are
// still open. Nothing is deleted — archived events stay in the database and can be viewed at
// /alerts?show=archived, but they no longer count on the dashboard, alerts list or reports.
// POST {"undo": true} brings them all back.
import { NextResponse } from "next/server";
import { sql, ensureTruckColumns } from "@/lib/db";
import { currentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request) {
  const user = await currentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "เฉพาะผู้ดูแลระบบ (admin)" }, { status: 403 });
  }
  await ensureTruckColumns();
  let b;
  try { b = await request.json(); } catch { b = {}; }
  if (b && b.undo === true) {
    const rows = await sql`UPDATE events SET archived = false WHERE archived RETURNING id`;
    return NextResponse.json({ ok: true, restored: rows.length });
  }
  await sql`
    UPDATE events SET closed_at = now(), closed_by = ${user.id}, close_note = 'ข้อมูลทดสอบ (ซ่อนแล้ว)'
    WHERE closed_at IS NULL AND happened_at <= now()`;
  const rows = await sql`
    UPDATE events SET archived = true WHERE NOT archived AND happened_at <= now() RETURNING id`;
  return NextResponse.json({ ok: true, archived: rows.length });
}
