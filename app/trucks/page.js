// C7 + C1: manage trucks & driver datasheet + manage 3 user roles (admin/manager/viewer).
import { redirect } from "next/navigation";
import { sql, ensureTruckColumns } from "@/lib/db";
import { currentUser, canManage } from "@/lib/auth";
import { thTime, isOnline } from "@/lib/format";
import TruckAdmin from "../components/TruckAdmin";
import UserAdmin from "../components/UserAdmin";

export const dynamic = "force-dynamic";

export default async function Trucks() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!canManage(user)) redirect("/");
  await ensureTruckColumns();
  const trucks = await sql`
    SELECT id, code, name, brand, model, vehicle_info,
           driver_code, driver_name, driver_phone,
           key_revoked, last_seen, app_version
    FROM trucks ORDER BY code`;
  const rows = trucks.map((t) => ({
    id: t.id,
    code: t.code,
    name: t.name || "",
    brand: t.brand || "",
    model: t.model || "",
    vehicle_info: t.vehicle_info || "",
    driver_code: t.driver_code || "",
    driver_name: t.driver_name || "",
    driver_phone: t.driver_phone || "",
    revoked: t.key_revoked,
    online: isOnline(t.last_seen),
    seen: thTime(t.last_seen),
    version: t.app_version,
  }));

  let users = [];
  if (user.role === "admin") {
    const uRows = await sql`SELECT id, username, role, locked_until FROM users ORDER BY id ASC`;
    users = uRows.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      locked: Boolean(u.locked_until && new Date(u.locked_until).getTime() > Date.now()),
    }));
  }

  return (
    <>
      <h1>จัดการข้อมูลรถและพนักงานขับรถ (Datasheet)</h1>
      <TruckAdmin trucks={rows} />
      {user.role === "admin" && <UserAdmin users={users} currentUserId={user.id} />}
    </>
  );
}
