import { neon } from "@neondatabase/serverless";

// One HTTP-based Postgres client (works in Vercel serverless functions).
// Usage: const rows = await sql`SELECT * FROM trucks WHERE id = ${id}`;
let client;
export function sql(strings, ...values) {
  if (!client) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
    client = neon(process.env.DATABASE_URL);
  }
  return client(strings, ...values);
}
