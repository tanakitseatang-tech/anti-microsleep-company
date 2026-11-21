// Server-only helpers (Node runtime): current user, role checks, truck API keys.
import { cookies } from "next/headers";
import { createHash } from "crypto";
import { SESSION_COOKIE, readSessionToken } from "./session";
import { sql, ensureTruckColumns } from "./db";

export async function currentUser() {
  return readSessionToken(cookies().get(SESSION_COOKIE)?.value);
}

export function canManage(user) {
  return user && (user.role === "admin" || user.role === "manager");
}

export function hashApiKey(key) {
  return createHash("sha256").update(key).digest("hex");
}

// S5: the board sends either "Authorization: Bearer <key>" or "X-Truck-Code: <code>"
// (auto-registers the truck on first boot unless blocked via key_revoked).
// Anti-spoofing: once a truck has connected with its real key (key_required = true), the
// code-only header is no longer accepted for it — otherwise anyone who knows the truck number
// (public repo) could send fake alarms or close its red alarms. Boards without a key keep working.
export async function truckFromRequest(request) {
  await ensureTruckColumns();
  const h = request.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(\S{20,200})$/i);
  if (m) {
    const rows = await sql`
      SELECT id, code, driver_name, driver_code, key_required FROM trucks
      WHERE api_key_hash = ${hashApiKey(m[1])} AND key_revoked = false`;
    if (rows[0]) {
      if (!rows[0].key_required) await sql`UPDATE trucks SET key_required = true WHERE id = ${rows[0].id}`;
      // via_key: authenticated with a real secret (not just the public truck code)
      return { ...rows[0], via_key: true };
    }
  }
  const code = (request.headers.get("x-truck-code") || "").trim().slice(0, 20);
  if (!code || !/^[A-Za-z0-9._-]+$/.test(code)) return null;
  const existing = await sql`SELECT id, code, driver_name, driver_code, key_revoked, key_required FROM trucks WHERE code = ${code}`;
  if (existing[0]) return existing[0].key_revoked || existing[0].key_required ? null : existing[0];
  const autoHash = hashApiKey(`auto:${code}`);
  const created = await sql`
    INSERT INTO trucks (code, name, api_key_hash)
    VALUES (${code}, ${`บอร์ด ${code}`}, ${autoHash})
    ON CONFLICT (code) DO UPDATE SET code = EXCLUDED.code
    RETURNING id, code, driver_name, driver_code, key_revoked`;
  return created[0] && !created[0].key_revoked ? created[0] : null;
}
