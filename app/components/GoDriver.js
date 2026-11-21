"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Driver QR landing: sends the phone to its truck's board (http://<board Wi-Fi IP>:7000/driver.html).
// Works on Android too (no ".local" name needed). Re-checks every 5 s while the board is offline.
export default function GoDriver({ truck, code }) {
  const router = useRouter();
  const ready = truck && truck.online && truck.local_ip;
  const url = ready ? `http://${truck.local_ip}:7000/driver.html` : null;

  // set once the driver page was opened (auto or by tapping the link) or the page came back
  // from the back-forward cache: from then on this tab never auto-redirects again
  const skipRef = useRef(false);
  const timerRef = useRef(null);

  function markDone() {
    skipRef.current = true;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (url) { try { sessionStorage.setItem("ams_go_" + url, "1"); } catch {} }
  }

  useEffect(() => {
    // Back button restores this page from the bfcache (frozen JS, a pending timer would resume):
    // do not redirect again
    function onPageShow(ev) { if (ev.persisted) markDone(); }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  });

  useEffect(() => {
    // keep checking: the board may come online or change its IP while this page is open
    const poll = setInterval(() => router.refresh(), 5000);
    if (!url) return () => clearInterval(poll);
    // auto-open only ONCE per tab: pressing Back must show the help text, not redirect again
    let done = skipRef.current;
    try { done = done || sessionStorage.getItem("ams_go_" + url) === "1"; } catch {}
    if (done) return () => clearInterval(poll);
    const t = setTimeout(() => {
      timerRef.current = null;
      if (skipRef.current) return;
      try { sessionStorage.setItem("ams_go_" + url, "1"); } catch {}
      skipRef.current = true;
      window.location.href = url;
    }, 1500);
    timerRef.current = t;
    return () => {
      clearTimeout(t);
      if (timerRef.current === t) timerRef.current = null;
      clearInterval(poll);
    };
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
  const label = truck.code;            // public page: no licence plate, no Wi-Fi name
  if (!ready) {
    return (
      <div style={box}>
        <h1 style={{ fontSize: 24 }}>รถ {label}</h1>
        <p><b>ยังติดต่อบอร์ดไม่ได้</b></p>
        <p className="muted">
          เปิด hotspot บนมือถือ (ชื่อ AMS-01) แล้วรอบอร์ดต่อประมาณ 1 นาที
          · หน้านี้จะเปิดหน้าคนขับให้เองเมื่อบอร์ดพร้อม
        </p>
      </div>
    );
  }
  return (
    <div style={box}>
      <h1 style={{ fontSize: 24 }}>รถ {label}</h1>
      <p>กำลังเปิดหน้าคนขับ…</p>
      <a href={url} style={big} onClick={markDone}>เปิดหน้าคนขับ</a>
      <p className="muted" style={{ fontSize: 14 }}>
        ถ้าเปิดไม่ขึ้น: มือถือต้องเป็นเครื่องที่ปล่อย hotspot ให้บอร์ด (AMS-01)
        หรือต่อ Wi‑Fi เดียวกับบอร์ด · ปิด VPN ก่อน · มือถือที่ใช้เน็ต 4G อย่างเดียวจะเปิดไม่ได้
        <br />ที่อยู่: <code>{url}</code>
      </p>
    </div>
  );
}
