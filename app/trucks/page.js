// C7: manage trucks (admin): add a truck and get its API key, revoke a key.
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { thTime, isOnline } from "@/lib/format";
import TruckAdmin from "../components/TruckAdmin";

export const dynamic = "force-dynamic";

export default async function Trucks() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");
  const trucks = await sql`
    SELECT id, code, name, key_revoked, last_seen, app_version FROM trucks ORDER BY code`;
  const rows = trucks.map((t) => ({
    id: t.id, code: t.code, name: t.name, revoked: t.key_revoked,
    online: isOnline(t.last_seen), seen: thTime(t.last_seen), version: t.app_version,
  }));
  return (
    <>
      <h1>จัดการรถ</h1>
      <TruckAdmin trucks={rows} />
    </>
  );
}
