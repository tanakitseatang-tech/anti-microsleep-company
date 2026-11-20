// One QR for every truck: /go finds the truck whose board sends from the same internet address
// as this phone (the board uses this phone's hotspot). If that is unclear, the driver taps a truck.
import Link from "next/link";
import { headers } from "next/headers";
import { sql, ensureTruckColumns } from "@/lib/db";
import GoDriver from "@/app/components/GoDriver";

export const dynamic = "force-dynamic";
export const metadata = { title: "เปิดหน้าคนขับ · Anti-Microsleep" };

export default async function GoAny() {
  await ensureTruckColumns();
  const ip = (headers().get("x-forwarded-for") || "").split(",")[0].trim();
  const online = await sql`
    SELECT code, name, local_ip, wifi_ssid, public_ip, true AS online
    FROM trucks
    WHERE last_seen > now() - interval '2 minutes' AND local_ip IS NOT NULL
    ORDER BY code`;
  const mine = ip ? online.filter((t) => t.public_ip === ip) : [];
  if (mine.length === 1) return <GoDriver truck={mine[0]} code={mine[0].code} />;

  const list = mine.length > 1 ? mine : online;
  return (
    <div style={{ maxWidth: 440, margin: "48px auto", padding: "0 16px", lineHeight: 1.6 }}>
      <h1 style={{ fontSize: 24, textAlign: "center" }}>เลือกรถของคุณ</h1>
      {list.length === 0 ? (
        <p className="muted" style={{ textAlign: "center" }}>
          ยังไม่มีบอร์ดออนไลน์ · เปิด hotspot บนมือถือแล้วรอประมาณ 1 นาที แล้วสแกนใหม่
        </p>
      ) : (
        <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
          {list.map((t) => (
            <Link key={t.code} href={`/go/${encodeURIComponent(t.code)}`}
              style={{ display: "block", padding: 14, borderRadius: 10, border: "1px solid #ccc",
                fontSize: 18, fontWeight: 600, textDecoration: "none", color: "inherit" }}>
              รถ {t.code}{t.name ? ` · ${t.name}` : ""}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
