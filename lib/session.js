// Login cookie (signed JWT). Edge-safe: used by middleware.js and by route handlers.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "ams_session";
export const SESSION_HOURS = 12;

function key() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return new TextEncoder().encode(s);
}

export async function createSessionToken(user) {
  return new SignJWT({ uid: user.id, name: user.username, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(key());
}

export async function readSessionToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
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
