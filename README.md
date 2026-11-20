# 😴 Anti-Microsleep · เว็บบริษัท (บริษัทแม่)

เว็บส่วนกลางสำหรับบริษัท ดูรถทุกคันบนแผนที่ รับการแจ้งเตือนจากบอร์ดในรถ และปิดเคส
โปรเจคนี้ **แยกจาก** โปรเจคบนบอร์ด (`anti-microsleep`) และขึ้น Vercel ได้

| ส่วน | อยู่ที่ไหน | หมายเหตุ |
|---|---|---|
| ฝั่งคนขับ (`driver.html`, หน้าดูสด) | บนบอร์ด Arduino UNO Q ในรถ | ต้องทำงานออฟไลน์ ใช้ API บนบอร์ด → **ไม่ขึ้น Vercel** |
| ฝั่งบริษัท (โปรเจคนี้) | Vercel + ฐานข้อมูล Postgres (Neon) | บอร์ดส่งเหตุการณ์มาทางอินเทอร์เน็ต |

## มีอะไรแล้ว
- **C1** ล็อกอิน 3 สิทธิ์ (`admin` / `manager` / `viewer`), รหัสผ่าน bcrypt, ล็อกบัญชี 15 นาทีหลังใส่ผิด 5 ครั้ง, คุกกี้ httpOnly
- **C2** แผนที่รถทุกคัน (สีตามสถานะ, เทา = ขาดการติดต่อ) รีเฟรชเองทุก 30 วิ
- **C4** รายการแจ้งเตือน + ปิดเคสพร้อมบันทึก (เฉพาะ admin/manager)
- **C9** รถที่ไม่ส่ง heartbeat เกิน 3 นาที = "ขาดการติดต่อ"
- **S1** `POST /api/ingest/event` รับเหตุการณ์ (ส่งทีละอันหรือเป็นชุดได้ ส่งซ้ำไม่บันทึกซ้ำ)
- **S3** `POST /api/ingest/heartbeat` ตำแหน่ง/สถานะทุก ~1 นาที
- **S5** API key รายคัน (เก็บแค่ค่า hash) ยกเลิกได้
- **PDPA** เก็บแค่ข้อมูลเหตุการณ์ ไม่มีวิดีโอ, ลบอัตโนมัติหลัง 90 วัน (Vercel Cron)

ยังไม่มี: C3 แจ้งเตือน LINE/SMS · C5–C6 รายงาน/heatmap · C7 หน้าจัดการรถ (ตอนนี้ใช้สคริปต์) · C8 ส่งออก Excel/PDF · 2FA
และ **บอร์ดยังไม่ได้ส่งข้อมูลมา** (ต้องเพิ่มคิว S2 ใน `main.py` บนบอร์ด)

## ไฟล์ในโปรเจค
```
app/                  หน้าเว็บ + API (Next.js App Router)
  page.js             แผนที่รถ (หน้าแรก)
  alerts/page.js      รายการแจ้งเตือน
  login/page.js       หน้าล็อกอิน
  api/auth/…          ล็อกอิน / ออกจากระบบ
  api/ingest/…        รับข้อมูลจากบอร์ด (event, heartbeat)
  api/alerts/[id]/close  ปิดเคส
  api/cron/cleanup    ลบข้อมูลเก่ากว่า 90 วัน
lib/                  ฐานข้อมูล, ล็อกอิน, ตรวจข้อมูล
db/schema.sql         ตารางในฐานข้อมูล
scripts/              สร้างตาราง, สร้างผู้ใช้, เพิ่มรถ + API key
middleware.js         บังคับล็อกอินทุกหน้า
vercel.json           ตั้งเวลา cron
.env.example          ตัวอย่างค่าลับ (ค่าจริงใส่ใน Vercel เท่านั้น)
```
**ห้ามขึ้น GitHub:** `.env`, `.env.local`, `node_modules/`, `.next/` (อยู่ใน `.gitignore` แล้ว)

## ขึ้น GitHub
ต้องติดตั้ง [Git](https://git-scm.com) และ [Node.js 20+](https://nodejs.org) ก่อน แล้วในโฟลเดอร์นี้:
```bash
git init
git add .
git commit -m "Company web: first version"
```
สร้าง repo ใหม่ (แนะนำ **Private**) ที่ github.com/new ชื่อเช่น `anti-microsleep-company` แล้ว:
```bash
git remote add origin https://github.com/<ชื่อคุณ>/anti-microsleep-company.git
git branch -M main
git push -u origin main
```

## ขึ้น Vercel
1. vercel.com → **Add New → Project** → เลือก repo `anti-microsleep-company` → **Deploy** (ครั้งแรกจะ error เพราะยังไม่มีฐานข้อมูล ไม่เป็นไร)
2. ในโปรเจค → แท็บ **Storage** → **Create Database → Neon (Postgres)** → Connect กับโปรเจคนี้ (จะได้ `DATABASE_URL` อัตโนมัติ)
3. **Settings → Environment Variables** เพิ่ม
   - `SESSION_SECRET` = ข้อความสุ่มยาว ≥ 32 ตัว
   - `CRON_SECRET` = ข้อความสุ่มอีกอัน
4. **Deployments → Redeploy**

## ตั้งค่าครั้งแรก (บนคอม)
```bash
npm install
npx vercel link
npx vercel env pull .env.local
npm run db:init
npm run create-user -- admin admin
npm run add-truck -- 7 "รถ 7"
```
`add-truck` จะพิมพ์ API key ของรถคันนั้น **ครั้งเดียว** → เอาไปใส่บนบอร์ดที่ `~/ArduinoApps/anti-microsleep/company_api_key.txt`

## ทดสอบส่งข้อมูลแบบบอร์ด
```bash
curl -X POST https://<โดเมน>.vercel.app/api/ingest/heartbeat -H "Authorization: Bearer <API key>" -H "Content-Type: application/json" -d "{\"lat\":14.69,\"lon\":101.41,\"speed\":72,\"level\":0,\"camera_ok\":true}"
```
```bash
curl -X POST https://<โดเมน>.vercel.app/api/ingest/event -H "Authorization: Bearer <API key>" -H "Content-Type: application/json" -d "{\"id\":\"test-1\",\"t\":1795145070,\"level\":2,\"reasons\":[\"eyes closed 2.1 s\"],\"lat\":14.69,\"lon\":101.41,\"speed\":72}"
```
(`t` = เวลา unix วินาที ต้องไม่เก่ากว่า 30 วัน)

## รูปแบบข้อมูลจากบอร์ด
`POST /api/ingest/event` (header `Authorization: Bearer <key>`)
```json
{"id": "uuid-จากบอร์ด", "t": 1795145070, "level": 2, "reasons": ["eyes closed 2.1 s"],
 "lat": 14.69, "lon": 101.41, "speed": 72, "driver": "D0012"}
```
หรือส่งเป็นชุดหลังกลับมาออนไลน์: `{"events": [ … สูงสุด 200 … ]}`

`POST /api/ingest/heartbeat`
```json
{"lat": 14.69, "lon": 101.41, "speed": 72, "level": 0, "camera_ok": true, "version": "2026-11-20"}
```
