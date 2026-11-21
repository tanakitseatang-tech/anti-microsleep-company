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

export function normalizeDriverCode(raw) {
  const s = String(raw || "").trim().toUpperCase();
  if (!s) return "";
  if (/^\d{1,3}$/.test(s)) return s.padStart(3, "0");
  return s.slice(0, 20);
}

let migrated = false;
export async function ensureTruckColumns() {
  if (migrated) return;
  await getClient().unsafe(`
    ALTER TABLE trucks
      ADD COLUMN IF NOT EXISTS brand TEXT,
      ADD COLUMN IF NOT EXISTS model TEXT,
      ADD COLUMN IF NOT EXISTS vehicle_info TEXT,
      ADD COLUMN IF NOT EXISTS driver_code TEXT,
      ADD COLUMN IF NOT EXISTS driver_name TEXT,
      ADD COLUMN IF NOT EXISTS driver_phone TEXT,
      ADD COLUMN IF NOT EXISTS last_line_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS local_ip TEXT,
      ADD COLUMN IF NOT EXISTS wifi_ssid TEXT,
      ADD COLUMN IF NOT EXISTS public_ip TEXT,
      ADD COLUMN IF NOT EXISTS rest_until TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS rest_line_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS key_required BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS pending_api_key TEXT,
      ADD COLUMN IF NOT EXISTS pending_key_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS sim_drive BOOLEAN NOT NULL DEFAULT false;
    -- "hide test data": archived events stay in the database but are left out of counts/lists
    ALTER TABLE events ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
    CREATE TABLE IF NOT EXISTS drivers (
      code       TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      phone      TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  migrated = true;
}
