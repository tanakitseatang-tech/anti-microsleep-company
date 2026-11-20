import "leaflet/dist/leaflet.css";
import "./globals.css";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import LogoutButton from "./components/LogoutButton";

export const metadata = { title: "Anti-Microsleep · บริษัท" };

export default async function RootLayout({ children }) {
  const user = await currentUser();
  return (
    <html lang="th">
      <body>
        {user && (
          <header className="top">
            <b>😴 Anti-Microsleep</b>
            <nav>
              <Link href="/">แผนที่รถ</Link>
              <Link href="/alerts">การแจ้งเตือน</Link>
              {(user.role === "admin" || user.role === "manager") && <Link href="/trucks">จัดการรถ / พนักงาน (Datasheet)</Link>}
            </nav>
            <span className="who">{user.username} ({user.role}) <LogoutButton /></span>
          </header>
        )}
        <main>{children}</main>
      </body>
    </html>
  );
}
