// C3: admin switch — turn LINE alerts on or off (stored in the database, takes effect at once).
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { setSetting } from "@/lib/settings";

export const runtime = "nodejs";

export async function POST(request) {
  const user = await currentUser();
  if (user?.role !== "admin") return NextResponse.json({ ok: false, error: "admin only" }, { status: 403 });
  let b;
  try { b = await request.json(); } catch { b = {}; }
  if (typeof b.enabled !== "boolean") {
    return NextResponse.json({ ok: false, error: "enabled must be true or false" }, { status: 400 });
  }
  await setSetting("line_enabled", b.enabled ? "1" : "0");
  console.log(`LINE alerts ${b.enabled ? "ON" : "OFF"} by ${user.username}`);
  return NextResponse.json({ ok: true, enabled: b.enabled });
}
