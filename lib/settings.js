// Small key/value settings stored in the database (e.g. the LINE on/off switch).
import { sql, rawQuery } from "./db";

let ready = false;
async function ensureTable() {
  if (ready) return;
  await rawQuery(`CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  ready = true;
}

export async function getSetting(key, fallback = null) {
  await ensureTable();
  const rows = await sql`SELECT value FROM settings WHERE key = ${key}`;
  return rows.length ? rows[0].value : fallback;
}

export async function setSetting(key, value) {
  await ensureTable();
  await sql`
    INSERT INTO settings (key, value) VALUES (${key}, ${String(value)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}

// LINE alerts switch, controlled from the alerts page. On unless an admin turned it off.
export async function lineEnabled() {
  return (await getSetting("line_enabled", "1")) !== "0";
}
