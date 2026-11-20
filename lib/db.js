import postgres from "postgres";
import { databaseUrl } from "./dburl";

// Postgres client for Supabase (or any Postgres). Works in Vercel serverless functions.
// Usage: const rows = await sql`SELECT * FROM trucks WHERE id = ${id}`;
let client;

function getClient() {
  if (client) return client;
  const raw = databaseUrl();
  if (!raw) throw new Error("DATABASE_URL / POSTGRES_URL is not set (connect a database in Vercel > Storage)");
  // Keep only the connection itself: Vercel's Supabase URL carries extra query settings
  // (e.g. supa=base-pooler.x) that the server would reject as unknown parameters.
  const u = new URL(raw);
  const local = ["localhost", "127.0.0.1"].includes(u.hostname);
  u.search = "";
  client = postgres(u.toString(), {
    ssl: local ? false : "require",
    prepare: false,          // required by Supabase's transaction pooler (port 6543)
    max: 1,                  // one connection per serverless instance
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return client;
}

export function sql(strings, ...values) {
  return getClient()(strings, ...values);
}

// A plain SQL string (used only for the fixed schema statements in /api/setup).
export function rawQuery(text, params = []) {
  return getClient().unsafe(text, params);
}
