// C3: alarm messages to LINE through the LINE Messaging API (LINE Notify was shut down).
//
// Vercel > Settings > Environment Variables:
//   LINE_CHANNEL_ACCESS_TOKEN  long-lived channel access token of your LINE Official Account
//   LINE_TO                    (optional) one user/group ID to send to. Without it the message
//                              is broadcast to everyone who added the Official Account as a friend.
// Free plan: a limited number of messages per month (each friend reached counts as one).
import { thTime, thReasons } from "./format";

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
    // timeout: LINE may still have delivered it, so callers must not resend (no duplicates)
    if (e?.name === "AbortError") return { ok: false, timeout: true, error: "LINE timeout" };
    return { ok: false, error: String(e?.message || e) };
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

function validLatLon(lat, lon) {
  const a = Number(lat), o = Number(lon);
  return lat != null && lon != null && Number.isFinite(a) && Number.isFinite(o)
    && Math.abs(a) <= 90 && Math.abs(o) <= 180 && !(a === 0 && o === 0);
}

// Where the truck is: the GPS position at the moment of the event, else the truck's last
// known GPS position (indoors / no fix), with coordinates and a Google Maps link.
function locationLines(event, truck) {
  let lat, lon, label;
  if (event && validLatLon(event.lat, event.lon)) {
    [lat, lon, label] = [event.lat, event.lon, "ตำแหน่งขณะเกิดเหตุ"];
  } else if (truck && validLatLon(truck.last_lat, truck.last_lon)) {
    [lat, lon, label] = [truck.last_lat, truck.last_lon, "ตำแหน่งล่าสุดที่ GPS จับได้"];
  } else {
    return ["📍 ตำแหน่ง: ยังไม่มีสัญญาณ GPS"];
  }
  const ll = `${Number(lat).toFixed(6)},${Number(lon).toFixed(6)}`;
  return [`📍 ${label}: ${ll}`, `🗺️ Google Maps: https://www.google.com/maps/search/?api=1&query=${ll}`];
}

// Text for a red alarm the driver did not respond to (the board did not see the eyes
// open again — the driver page has no "I'm awake" button any more, it is camera-only).
export function alarmText({ truck, event, siteUrl, waitedS = 60, count = 1 }) {
  const mins = Math.round(waitedS / 60);
  const lines = [
    `🚨 คนขับไม่ตอบสนองเกิน ${mins >= 1 ? `${mins} นาที` : `${waitedS} วินาที`}`,
    `ระบบเตือนหลับใน${count > 1 ? ` ${count} ครั้ง` : ""} แต่คนขับยังไม่ตื่น (กล้องยังไม่เห็นลืมตา)`,
    ...truckLines(truck),
  ];
  if (event.reasons?.length) lines.push(`สาเหตุ: ${thReasons(event.reasons)}`);
  if (event.speed != null) lines.push(`ความเร็ว: ${Math.round(event.speed)} กม./ชม.`);
  lines.push(`เวลา: ${thTime(event.happened_at)}`);
  lines.push(...locationLines(event, truck));
  if (siteUrl) lines.push(`ดูเคส: ${siteUrl}/alerts`);
  return lines.join("\n");
}

function truckLines(truck) {
  const plate = [truck.name, truck.brand, truck.model].filter(Boolean).join(" · ");
  const driver = [truck.driver_name, truck.driver_code ? `(${truck.driver_code})` : ""].filter(Boolean).join(" ");
  const lines = [`รถคันที่ ${truck.code}${plate ? ` · ${plate}` : ""}`];
  if (driver) lines.push(`คนขับ: ${driver}`);
  if (truck.driver_phone) lines.push(`📞 ${truck.driver_phone}`);
  return lines;
}

// Board saw no driver's face for 60 s during a shift (not resting).
export function noDriverText({ truck, event, siteUrl }) {
  const lines = [
    "👤 กล้องมองไม่เห็นคนขับ",
    `${thReasons(event.reasons)} — คนขับอาจลุกจากที่นั่งโดยไม่ได้กดพัก หรือกล้องถูกบัง/หันออก`,
    ...truckLines(truck),
  ];
  if (event.speed != null) lines.push(`ความเร็ว: ${Math.round(event.speed)} กม./ชม.`);
  lines.push(`เวลา: ${thTime(event.happened_at)}`);
  lines.push(...locationLines(event, truck));
  if (siteUrl) lines.push(`ดูเคส: ${siteUrl}/alerts`);
  return lines.join("\n");
}

// The driver's rest ended graceMin minutes ago and they are not back yet.
export function restOverdueText({ truck, siteUrl, graceMin = 15 }) {
  const lines = [
    `☕ คนขับพักเกินเวลา ${graceMin} นาทีแล้ว`,
    `ควรเลิกพักเวลา ${thTime(truck.rest_until)} แต่ระบบยังไม่เห็นคนขับกลับมาขับต่อ — ลองโทรสอบถาม`,
    ...truckLines(truck),
    `ติดต่อล่าสุด: ${thTime(truck.last_seen)}`,
  ];
  lines.push(...locationLines(null, truck));
  if (siteUrl) lines.push(`ดูรถ: ${siteUrl}/`);
  return lines.join("\n");
}
