// Turn a database error into a short, safe code (no hosts, users or passwords).
export function dbErrorKind(e) {
  const code = e?.code || "";
  const msg = String(e?.message || "");
  if (code === "42P01") return "no_tables";                      // relation does not exist
  if (/is not set/.test(msg)) return "no_database_url";
  if (["28P01", "28000"].includes(code)) return "bad_login";     // wrong user/password
  if (["ENOTFOUND", "EAI_AGAIN"].includes(code)) return "host_not_found";
  if (["ECONNREFUSED", "ETIMEDOUT", "CONNECT_TIMEOUT", "ECONNRESET"].includes(code)) return "unreachable";
  if (/SSL|TLS|certificate/i.test(msg)) return "ssl";
  if (code === "42501") return "permission";
  return code ? `pg_${code}` : "other";
}

export const DB_ERROR_TH = {
  no_tables: "ยังไม่ได้ตั้งค่าครั้งแรก — ไปที่หน้า /setup",
  no_database_url: "ยังไม่ได้เชื่อมฐานข้อมูลกับโปรเจกต์ (Vercel → Storage)",
  bad_login: "ฐานข้อมูลปฏิเสธชื่อผู้ใช้/รหัสผ่าน (ตรวจการเชื่อม Supabase)",
  host_not_found: "หาเซิร์ฟเวอร์ฐานข้อมูลไม่เจอ",
  unreachable: "ต่อฐานข้อมูลไม่ได้ (Supabase อาจถูกหยุดชั่วคราว → กด Restore)",
  ssl: "การเชื่อมต่อแบบเข้ารหัส (SSL) ล้มเหลว",
  permission: "ฐานข้อมูลไม่อนุญาตคำสั่งนี้",
};

export function dbErrorMessage(kind) {
  return DB_ERROR_TH[kind] || `ฐานข้อมูลมีปัญหา (${kind})`;
}
