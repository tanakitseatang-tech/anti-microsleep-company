// Create the tables from db/schema.sql.   Usage: npm run db:init
// (The /setup page in the website does the same thing.)
import { readFileSync } from "fs";
import { db, query } from "./db.mjs";

const text = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8")
  .split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
const statements = text.split(";").map((s) => s.trim()).filter(Boolean);
for (const s of statements) {
  await query(s);
  console.log("ok:", s.split("\n")[0].slice(0, 70));
}
console.log(`done, ${statements.length} statements`);
await db.end();
