// Every page needs a login, except /login itself. The board APIs (/api/ingest/*)
// use their own API key, and the cron route uses CRON_SECRET.
import { NextResponse } from "next/server";
import { SESSION_COOKIE, readSessionToken } from "./lib/session";

// /setup and /api/setup only work while the database has no users (see app/api/setup).
// /go and /go/<truck>: drivers' QR codes → their board's driver page (no login, no company data shown).
const PUBLIC = ["/login", "/setup", "/api/auth/login", "/api/setup", "/api/health", "/api/ingest/", "/api/cron/", "/go"];

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p))) return NextResponse.next();
  const user = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (user) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "login required" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
