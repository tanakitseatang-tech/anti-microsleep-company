// Shared connection for the command-line scripts (reads .env.local via --env-file).
import postgres from "postgres";

const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!raw) {
  console.error("No DATABASE_URL / POSTGRES_URL. Run: npx vercel env pull .env.local");
  process.exit(1);
}
const u = new URL(raw);
const local = ["localhost", "127.0.0.1"].includes(u.hostname);
u.search = "";
export const db = postgres(u.toString(), { ssl: local ? false : "require", prepare: false, max: 1 });

export async function query(text, params = []) {
  return db.unsafe(text, params);
}
