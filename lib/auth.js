// Server-only helpers (Node runtime): current user, role checks, truck API keys.
import { cookies } from "next/headers";
import { createHash } from "crypto";
import { SESSION_COOKIE, readSessionToken } from "./session";
import { sql } from "./db";

export async function currentUser() {
  return readSessionToken(cookies().get(SESSION_COOKIE)?.value);
}

export function canManage(user) {
  return user && (user.role === "admin" || user.role === "manager");
}

export function hashApiKey(key) {
  return createHash("sha256").update(key).digest("hex");
}

// S5: the board sends "Authorization: Bearer <key>". Returns the truck row or null.
export async function truckFromRequest(request) {
  const h = request.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(\S{20,200})$/i);
  if (!m) return null;
  const rows = await sql`
    SELECT id, code FROM trucks
    WHERE api_key_hash = ${hashApiKey(m[1])} AND key_revoked = false`;
  return rows[0] || null;
}
