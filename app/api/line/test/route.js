// C3 admin panel: LINE status (set up? switched on? messages used this month) and a test message.
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { lineConfigured, lineQuota, sendLine } from "@/lib/line";
import { lineEnabled } from "@/lib/settings";
import { ACK_WAIT_S } from "@/lib/escalate";
import { thTime } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (user?.role !== "admin") return NextResponse.json({ ok: false }, { status: 403 });
  const configured = lineConfigured();
  return NextResponse.json({
    configured,
    enabled: await lineEnabled(),
    mode: process.env.LINE_TO ? "push" : "broadcast",
    waitS: ACK_WAIT_S,
    quota: configured ? await lineQuota() : null,
  });
}

export async function POST() {
  const user = await currentUser();
  if (user?.role !== "admin") return NextResponse.json({ ok: false, error: "admin only" }, { status: 403 });
  if (!lineConfigured()) {
    return NextResponse.json({ ok: false, error: "ยังไม่ได้ใส่ LINE_CHANNEL_ACCESS_TOKEN ใน Vercel" }, { status: 400 });
  }
  if (!(await lineEnabled())) {
    return NextResponse.json({ ok: false, error: "LINE ปิดอยู่ — เปิดสวิตช์ก่อน" }, { status: 400 });
  }
  const res = await sendLine(`✅ ทดสอบแจ้งเตือน Anti-Microsleep\nส่งโดย ${user.username} · ${thTime(new Date())}`);
  return NextResponse.json(res, { status: res.ok ? 200 : 502 });
}
