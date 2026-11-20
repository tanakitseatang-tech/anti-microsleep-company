// Health check: does the database answer, and are the tables there?
// Returns only short codes (no connection details), e.g. {"ok":true,"db":"ok","tables":true}
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { dbErrorKind } from "@/lib/dberror";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await sql`SELECT 1`;
  } catch (e) {
    console.error("health: database error", e?.code, e?.message);
    return NextResponse.json({ ok: false, db: dbErrorKind(e) }, { status: 503 });
  }
  try {
    const [r] = await sql`SELECT to_regclass('public.users') IS NOT NULL AS t`;
    return NextResponse.json({ ok: true, db: "ok", tables: r.t });
  } catch (e) {
    return NextResponse.json({ ok: false, db: "ok", tables: dbErrorKind(e) }, { status: 503 });
  }
}
