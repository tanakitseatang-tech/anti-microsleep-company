// C3: admin test — is LINE set up, and does a message arrive?
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { lineConfigured, sendLine } from "@/lib/line";
import { thTime } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (user?.role !== "admin") return NextResponse.json({ ok: false }, { status: 403 });
  return NextResponse.json({ configured: lineConfigured(), mode: process.env.LINE_TO ? "push" : "broadcast" });
}

export async function POST() {
  const user = await currentUser();
  if (user?.role !== "admin") return NextResponse.json({ ok: false, error: "admin only" }, { status: 403 });
  if (!lineConfigured()) {
    return NextResponse.json({ ok: false, error: "ยังไม่ได้ใส่ LINE_CHANNEL_ACCESS_TOKEN ใน Vercel" }, { status: 400 });
  }
  const res = await sendLine(`✅ ทดสอบแจ้งเตือน Anti-Microsleep\nส่งโดย ${user.username} · ${thTime(new Date())}`);
  return NextResponse.json(res, { status: res.ok ? 200 : 502 });
}
