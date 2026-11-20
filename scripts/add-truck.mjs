// Register a truck (board) and print its new API key ONCE.
// Usage: npm run add-truck -- <code> [name]        e.g. npm run add-truck -- 7 "Truck 7 (80-1234)"
// Running it again for the same code makes a new key; the old key stops working.
// Put the key on that board in ~/ArduinoApps/anti-microsleep/company_api_key.txt
import { randomBytes, createHash } from "crypto";
import { neon } from "@neondatabase/serverless";

const [code, name] = process.argv.slice(2);
if (!code) {
  console.error('usage: npm run add-truck -- <code> ["name"]');
  process.exit(1);
}
const key = "ams_" + randomBytes(24).toString("base64url");
const hash = createHash("sha256").update(key).digest("hex");
const sql = neon(process.env.DATABASE_URL);
await sql(
  `INSERT INTO trucks (code, name, api_key_hash) VALUES ($1, $2, $3)
   ON CONFLICT (code) DO UPDATE SET api_key_hash = $3, key_revoked = false,
     name = COALESCE($2, trucks.name)`,
  [code, name || null, hash],
);
console.log(`truck ${code} saved. API key (shown only now, keep it secret):\n${key}`);
