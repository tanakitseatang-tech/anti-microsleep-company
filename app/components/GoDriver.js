"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Driver QR landing: sends the phone to its truck's board (http://<board Wi-Fi IP>:7000/driver.html).
// Works on Android too (no ".local" name needed). Re-checks every 5 s while the board is offline.
export default function GoDriver({ truck, code }) {
  const router = useRouter();
  const ready = truck && truck.online && truck.local_ip;
  const url = ready ? `http://${truck.local_ip}:7000/driver.html` : null;

  useEffect(() => {
    if (url) {
      const t = setTimeout(() => { window.location.href = url; }, 700);
      return () => clearTimeout(t);
    }
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [url, router]);

  const box = { maxWidth: 440, margin: "48px auto", padding: "0 16px", textAlign: "center", lineHeight: 1.6 };
  const big = { display: "block", padding: "16px", fontSize: 20, fontWeight: 700, borderRadius: 12,
    background: "#16a34a", color: "#fff", textDecoration: "none", margin: "20px 0" };

  if (!truck) {
    return (
      <div style={box}>
        <h1 style={{ fontSize: 24 }}>ไม่พบรถ “{code}”</h1>
        <p className="muted">เลขรถใน QR ไม่ตรงกับรถในระบบ ติดต่อเจ้าหน้าที่</p>
      </div>
    );
  }
  const label = truck.name ? `${truck.code} · ${truck.name}` : truck.code;
  if (!ready) {
    return (
      <div style={box}>
        <h1 style={{ fontSize: 24 }}>รถ {label}</h1>
        <p><b>ยังติดต่อบอร์ดไม่ได้</b></p>
        <p className="muted">
          เปิด hotspot บนมือถือ{truck.wifi_ssid ? ` (ชื่อ ${truck.wifi_ssid})` : ""} แล้วรอบอร์ดต่อประมาณ 1 นาที
          · หน้านี้จะเปิดหน้าคนขับให้เองเมื่อบอร์ดพร้อม
        </p>
      </div>
    );
  }
  return (
    <div style={box}>
      <h1 style={{ fontSize: 24 }}>รถ {label}</h1>
      <p>กำลังเปิดหน้าคนขับ…</p>
      <a href={url} style={big}>เปิดหน้าคนขับ</a>
      <p className="muted" style={{ fontSize: 14 }}>
        ถ้าเปิดไม่ขึ้น: มือถือต้องเป็นเครื่องที่ปล่อย hotspot ให้บอร์ด
        {truck.wifi_ssid ? ` (${truck.wifi_ssid})` : ""} หรือต่อ Wi‑Fi เดียวกัน · ปิด VPN ก่อน
        <br />ที่อยู่: <code>{url}</code>
      </p>
    </div>
  );
}
