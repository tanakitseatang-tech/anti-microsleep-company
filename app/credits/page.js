// Public page (competition rule): disclose third-party models, code, data and AI tools + PDPA notice.
export const metadata = { title: "Anti-Microsleep · แหล่งที่มา & ความเป็นส่วนตัว" };

const SECTIONS = [
  ["🤖 โมเดล AI & คอมพิวเตอร์วิทัศน์", [
    ["MediaPipe Face Landmarker + Face Blendshapes", "Google · Apache-2.0 — จุดบนใบหน้า 478 จุด รันบนบอร์ดด้วย LiteRT"],
    ["ai-edge-litert", "Google AI Edge · Apache-2.0 — ตัวรันโมเดลบนบอร์ด"],
    ["OpenCV + haarcascade_eye_tree_eyeglasses", "OpenCV · Apache-2.0 — ประมวลผลภาพ / ตรวจตาเมื่อใส่แว่น"],
    ["Arduino App Lab (web_ui, object_detection)", "Arduino — ระบบแอปบน UNO Q"],
  ]],
  ["🗺️ แผนที่ & เส้นทาง", [
    ["ข้อมูลแผนที่ & จุดพัก/ปั๊ม", "© OpenStreetMap contributors · ODbL (ไฟล์จาก Geofabrik)"],
    ["OSRM", "Project OSRM · BSD-2 — คำนวณเส้นทางบนบอร์ด"],
    ["Leaflet", "BSD-2 — แสดงแผนที่"],
    ["Protomaps (pmtiles, protomaps-leaflet)", "BSD-3 — แผนที่ออฟไลน์"],
    ["Nominatim", "OpenStreetMap · ODbL — แปลงพิกัดเป็นที่อยู่บนเว็บบริษัท"],
  ]],
  ["🔊 เสียง", [
    ["เสียงพูดภาษาไทย (learning / ready)", "Microsoft Neural TTS (th-TH-Premwadee)"],
    ["เสียงเตือน beep.wav", "จัดหาโดยทีม (รอยืนยันแหล่งที่มา)"],
  ]],
  ["🧰 ซอฟต์แวร์ & บริการ", [
    ["Arduino Core, RouterBridge, LED_Matrix", "Arduino — เฟิร์มแวร์ STM32 บน UNO Q"],
    ["Next.js, React, postgres.js, bcryptjs, jose", "MIT / Unlicense — เว็บบริษัท"],
    ["Vercel, Supabase, LINE Messaging API", "โฮสติ้ง ฐานข้อมูล และแจ้งเตือน"],
  ]],
  ["🤝 ผู้ช่วย AI ในการพัฒนา", [
    ["Claude (Anthropic)", "ช่วยดีบัก ปรับ UI เอกสาร และสคริปต์ทดสอบ"],
    ["Antigravity / Gemini (Google)", "ช่วยออกแบบเคส 3D ตั้งค่าเครือข่าย/QR และตรวจโค้ด"],
  ]],
];

export default function Credits() {
  return (
    <>
      <h1>📜 แหล่งที่มา & ความเป็นส่วนตัว</h1>
      <p className="muted">Anti-Microsleep Team · ระบบตรวจจับการหลับในบน <b>Arduino UNO Q</b> (AI ประมวลผลบนบอร์ดในรถ)</p>
      <div className="card">
        <b>🔒 ความเป็นส่วนตัว (PDPA)</b>
        <ul style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.7 }}>
          <li>ภาพจากกล้องประมวลผล <b>บนบอร์ดในรถเท่านั้น</b> ไม่บันทึกวิดีโอ และไม่ส่งภาพขึ้นอินเทอร์เน็ต</li>
          <li>เว็บนี้เก็บเฉพาะ <b>เหตุการณ์แจ้งเตือน</b> (เวลา ระดับ สาเหตุ ตำแหน่ง ความเร็ว รหัสคนขับ)</li>
          <li>ประวัติแจ้งเตือนลบอัตโนมัติเมื่อครบ 90 วัน · ข้อมูลคนขับดูได้เฉพาะผู้ที่ล็อกอิน</li>
          <li>ภาพตาที่ใช้วิจัยแยก "หรี่ตา/หลับตา" ถูกลบหมดแล้ว เหลือเฉพาะตัวเลขค่าวัดที่ระบุตัวตนไม่ได้</li>
        </ul>
      </div>
      {SECTIONS.map(([title, rows]) => (
        <div className="card" key={title}>
          <b>{title}</b>
          <table style={{ marginTop: 6 }}>
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <td style={{ whiteSpace: "normal", fontWeight: 600, width: "42%" }}>{k}</td>
                  <td style={{ whiteSpace: "normal" }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <p className="muted" style={{ fontSize: 13 }}>
        การออกแบบระบบ การต่อฮาร์ดแวร์ การทดสอบกับคนจริง และการตัดสินใจทางวิศวกรรม ทำโดยทีม Anti-Microsleep
      </p>
    </>
  );
}
