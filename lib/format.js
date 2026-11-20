export const OFFLINE_AFTER_MIN = 3;   // C9: no heartbeat this long = "ขาดการติดต่อ"
export const LEVEL_TH = ["ปกติ", "เตือน", "อันตราย"];

export function thTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export function isOnline(lastSeen) {
  return !!lastSeen && Date.now() - new Date(lastSeen).getTime() < OFFLINE_AFTER_MIN * 60e3;
}
