import Link from "next/link";

// Thai 404 page (was Next.js's default English "This page could not be found.")
export default function NotFound() {
  return (
    <div style={{ textAlign: "center", padding: "48px 16px" }}>
      <h1>ไม่พบหน้านี้</h1>
      <p className="muted">ลิงก์อาจพิมพ์ผิด หรือหน้านี้ถูกย้ายไปแล้ว</p>
      <Link className="btn" href="/">กลับหน้าแผนที่รถ</Link>
    </div>
  );
}
