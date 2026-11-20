// S5: revoke a truck's API key (the board can no longer send). Admin only.
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { currentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  const user = await currentUser();
  if (user?.role !== "admin") return NextResponse.json({ ok: false, error: "admin only" }, { status: 403 });
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });
  const rows = await sql`UPDATE trucks SET key_revoked = true WHERE id = ${id} RETURNING id`;
  return NextResponse.json({ ok: rows.length === 1 });
}
