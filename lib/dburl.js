// Which Postgres connection string to use (edge-safe, no imports).
// DATABASE_URL: set by hand or by Neon.  POSTGRES_URL: set by Vercel's Supabase integration
// (Supabase transaction pooler, port 6543).
export function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}
