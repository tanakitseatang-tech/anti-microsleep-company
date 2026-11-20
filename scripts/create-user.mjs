// Create or reset a company user.
// Usage: npm run create-user -- <username> <admin|manager|viewer>
// The password is asked for (typed, not shown in the shell history).
import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";
import { createInterface } from "readline";

const [username, role = "viewer"] = process.argv.slice(2);
if (!username || !["admin", "manager", "viewer"].includes(role)) {
  console.error("usage: npm run create-user -- <username> <admin|manager|viewer>");
  process.exit(1);
}
const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = await new Promise((r) => rl.question("password (at least 10 characters): ", r));
rl.close();
if (password.length < 10) {
  console.error("password too short");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);
const hash = await bcrypt.hash(password, 12);
await sql(
  `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)
   ON CONFLICT (username) DO UPDATE SET password_hash = $2, role = $3,
     failed_attempts = 0, locked_until = NULL`,
  [username.toLowerCase(), hash, role],
);
console.log(`user ${username.toLowerCase()} (${role}) saved`);
