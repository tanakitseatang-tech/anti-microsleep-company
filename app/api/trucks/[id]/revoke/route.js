// S5: revoke a truck's API key (the board can no longer send). Admin only.
import { NextResponse } from "next/server";
import { sql, ensureTruckColumns } from "@/lib/db";
import { currentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  const user = await currentUser();
  if (user?.role !== "admin") return NextResponse.json({ ok: false, error: "admin only" }, { status: 403 });
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });
  await ensureTruckColumns();
  // also drop a key that is still waiting to be handed to the board ("ออก Key" within 2 min)
  const rows = await sql`
    UPDATE trucks SET key_revoked = true, pending_api_key = NULL, pending_key_expires_at = NULL
    WHERE id = ${id} RETURNING id`;
  if (rows.length !== 1) return NextResponse.json({ ok: false, error: "ไม่พบรถคันนี้" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
