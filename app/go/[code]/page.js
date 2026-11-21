// Per-truck driver QR (sticker in the cab): /go/<truck code> → that truck's board driver page.
// Public page: only the truck code and the board's local Wi-Fi address reach the browser.
import { sql, ensureTruckColumns } from "@/lib/db";
import GoDriver from "@/app/components/GoDriver";

export const dynamic = "force-dynamic";
export const metadata = { title: "เปิดหน้าคนขับ · Anti-Microsleep" };

export default async function GoTruck({ params }) {
  await ensureTruckColumns();
  let code = "";
  try { code = decodeURIComponent(params.code || "").slice(0, 40); } catch { code = String(params.code || "").slice(0, 40); }
  const rows = await sql`
    SELECT code, local_ip,
           (last_seen > now() - interval '2 minutes') AS online
    FROM trucks WHERE code = ${code} LIMIT 1`;
  return <GoDriver truck={rows[0] || null} code={code} />;
}
