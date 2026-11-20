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

const REASON_PATTERNS = [
  [/^microsleep ([\d.]+)s/i, (m) => `หลับใน ${m[1]} วินาที`],
  [/^eyes closed (\d+)% of last 2s/i, (m) => `หลับตาต่อเนื่อง (${m[1]}% ใน 2 วิ)`],
  [/^eyes closed ([\d.]+)s/i, (m) => `หลับตา ${m[1]} วินาที`],
  [/^PERCLOS (\d+)%( \(very drowsy\))?/i, (m) => m[2] ? `ง่วงมาก (PERCLOS ${m[1]}%)` : `เริ่มง่วง (PERCLOS ${m[1]}%)`],
  [/^(\d+) yawns/i, (m) => `หาว ${m[1]} ครั้งใน 5 นาที`],
  [/^face not visible/i, () => "มองไม่เห็นใบหน้า"],
  [/^head dropped, face hidden (\d+)s/i, (m) => `ศีรษะฟุบไม่เห็นหน้า ${m[1]} วินาที`],
  [/^head dropped (\d+)s/i, (m) => `ศีรษะตก ${m[1]} วินาที`],
  [/^heavy eyelids (\d+)s/i, (m) => `ตาหนัก/หรี่ตานาน ${m[1]} วินาที`],
  [/^head down \+ eyes closed/i, () => "ก้มศีรษะ + หลับตา"],
  [/^head back \+ eyes closed/i, () => "ศีรษะเอนหลัง + หลับตา"],
  [/^head tilted \+ eyes closed/i, () => "ศีรษะเอียง + หลับตา"],
  [/^head down (\d+)s/i, (m) => `ก้มศีรษะ ${m[1]} วินาที`],
  [/^head back (\d+)s/i, (m) => `ศีรษะเอนหลัง ${m[1]} วินาที`],
  [/^head tilted (\d+)s/i, (m) => `ศีรษะเอียง ${m[1]} วินาที`],
  [/^looking away (\d+)s/i, (m) => `ไม่มองถนน ${m[1]} วินาที`],
];

export function thReason(r) {
  const s = String(r ?? "").trim();
  for (const [re, fn] of REASON_PATTERNS) {
    const m = s.match(re);
    if (m) return fn(m);
  }
  return s;
}

export function thReasons(list) {
  if (!Array.isArray(list) || !list.length) return "—";
  return list.map(thReason).join(" · ");
}
