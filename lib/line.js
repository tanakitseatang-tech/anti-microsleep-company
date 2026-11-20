// C3: alarm messages to LINE through the LINE Messaging API (LINE Notify was shut down).
//
// Vercel > Settings > Environment Variables:
//   LINE_CHANNEL_ACCESS_TOKEN  long-lived channel access token of your LINE Official Account
//   LINE_TO                    (optional) one user/group ID to send to. Without it the message
//                              is broadcast to everyone who added the Official Account as a friend.
// Free plan: a limited number of messages per month (each friend reached counts as one).
import { thTime } from "./format";

const API = "https://api.line.me/v2/bot/message";

export function lineConfigured() {
  return Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN);
}

export async function sendLine(text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { ok: false, error: "LINE_CHANNEL_ACCESS_TOKEN is not set" };
  const to = (process.env.LINE_TO || "").trim();
  const messages = [{ type: "text", text: String(text).slice(0, 4900) }];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(to ? `${API}/push` : `${API}/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(to ? { to, messages } : { messages }),
      signal: ctrl.signal,
    });
    if (r.ok) return { ok: true, mode: to ? "push" : "broadcast" };
    let detail = "";
    try { detail = (await r.json()).message || ""; } catch {}
    return { ok: false, status: r.status, error: detail || `LINE HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, error: e?.name === "AbortError" ? "LINE timeout" : String(e?.message || e) };
  } finally {
    clearTimeout(timer);
  }
}

// This month's message quota from LINE itself: { limit, used } (limit null = unlimited).
export async function lineQuota() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return null;
  const get = async (path) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const r = await fetch(`${API}/${path}`, {
        headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal, cache: "no-store",
      });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };
  const [q, c] = await Promise.all([get("quota"), get("quota/consumption")]);
  if (!q && !c) return null;
  return {
    limit: q?.type === "limited" ? q.value : null,
    used: typeof c?.totalUsage === "number" ? c.totalUsage : null,
  };
}

// Text for a red alarm the driver did not respond to.
export function alarmText({ truck, event, siteUrl, waitedS = 60, count = 1 }) {
  const plate = [truck.name, truck.brand, truck.model].filter(Boolean).join(" · ");
  const driver = [truck.driver_name, truck.driver_code ? `(${truck.driver_code})` : ""].filter(Boolean).join(" ");
  const mins = Math.round(waitedS / 60);
  const lines = [
    `🚨 คนขับไม่ตอบสนองเกิน ${mins >= 1 ? `${mins} นาที` : `${waitedS} วินาที`}`,
    `ระบบเตือนหลับใน${count > 1 ? ` ${count} ครั้ง` : ""} แต่คนขับยังไม่กด "ฉันตื่นแล้ว"`,
    `รถคันที่ ${truck.code}${plate ? ` · ${plate}` : ""}`,
  ];
  if (driver) lines.push(`คนขับ: ${driver}`);
  if (truck.driver_phone) lines.push(`📞 ${truck.driver_phone}`);
  if (event.reasons?.length) lines.push(`สาเหตุ: ${event.reasons.join(" · ")}`);
  if (event.speed != null) lines.push(`ความเร็ว: ${Math.round(event.speed)} กม./ชม.`);
  lines.push(`เวลา: ${thTime(event.happened_at)}`);
  if (event.lat != null && event.lon != null) lines.push(`📍 https://www.google.com/maps?q=${event.lat},${event.lon}`);
  if (siteUrl) lines.push(`ดูเคส: ${siteUrl}/alerts`);
  return lines.join("\n");
}
