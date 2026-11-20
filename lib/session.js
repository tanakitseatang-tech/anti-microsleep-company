// Login cookie (signed JWT). Edge-safe: used by middleware.js and by route handlers.
import { SignJWT, jwtVerify } from "jose";
import { databaseUrl } from "./dburl";

export const SESSION_COOKIE = "ams_session";
export const SESSION_HOURS = 12;

// Signing key: SESSION_SECRET if set, otherwise derived from the database URL (which Vercel
// sets for you when a database is connected), so nothing has to be pasted by hand.
// Changing either value logs everyone out.
let keyPromise;
function key() {
  if (!keyPromise) {
    keyPromise = (async () => {
      const s = process.env.SESSION_SECRET;
      if (s && s.length >= 32) return new TextEncoder().encode(s);
      const db = databaseUrl();
      if (!db) throw new Error("Connect a database (DATABASE_URL / POSTGRES_URL) or set SESSION_SECRET");
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("ams-session-v1|" + db));
      return new Uint8Array(digest);
    })();
  }
  return keyPromise;
}

export async function createSessionToken(user) {
  return new SignJWT({ uid: user.id, name: user.username, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(await key());
}

export async function readSessionToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await key());
    return { id: payload.uid, username: payload.name, role: payload.role };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  };
}
