# DEPLOY — backend บน Render · frontend บน GitHub Pages

ตัดสินใจ F.11 (13 ต.ค. 2569): **backend = Render (free)** · **frontend = GitHub Pages** · ฐานข้อมูล = Aiven MySQL ตัวเดิม (ใช้ร่วมกับ FixStep)

ไฟล์ที่เตรียมไว้แล้ว: `render.yaml` (รากโปรเจกต์) · `frontend/vite.config.ts` (`base`) · `frontend/.env.production` (รอใส่ URL)

## ขั้นที่ 1 — backend บน Render

1. Render Dashboard → **New → Blueprint** → เลือก repo `Parit-Ru/appliance-repair-assistant` (Render อ่าน `render.yaml` เอง)
2. ช่องที่ Render ถาม (ความลับ ไม่อยู่ในไฟล์): `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL_CA` — ใช้ค่าเดียวกับ `backend/.env` ของคุณ (ผมไม่เคยอ่านค่าเหล่านี้)
3. กด Apply แล้วรอ build (ครั้งแรกอาจ 5–10 นาที)
4. จด URL ที่ Render ให้ เช่น `https://appliance-repair-backend.onrender.com` (ถ้าชื่อซ้ำกับคนอื่น Render จะต่อท้ายตัวอักษรสุ่ม ใช้ URL ที่ Render แสดงจริง)
5. **ตรวจ backend ก่อนไปต่อ:**
   - `<URL>/health` ต้องได้ `"status":"ok"` และ `"database":"ok"` (ถ้า `database` เป็น `error` ดู `databaseError` และเช็คว่า Aiven ไม่ได้จำกัด IP)
   - `<URL>/traversal/graphs` ต้องได้รายการผัง 13 รายการ
   - `<URL>/symptom-search/status` ต้องได้ `"state":"disabled"` (ตั้งใจปิดไว้)

## ขั้นที่ 2 — frontend บน GitHub Pages

1. แก้ `frontend/.env.production` ใส่ `VITE_API_URL=<URL ของ Render>` (ไม่มี `/` ท้าย)
2. ในโฟลเดอร์ `frontend` รัน `npm run deploy` (build แล้ว push ขึ้น branch `gh-pages` ด้วยแพ็กเกจ `gh-pages`)
3. GitHub → repo → **Settings → Pages → Source: Deploy from a branch → `gh-pages` / `(root)`**
4. เปิด `https://parit-ru.github.io/appliance-repair-assistant/` (URL หน้าในแอปจะเป็น `…/#/symptoms` เพราะใช้ `HashRouter`)

## ขั้นที่ 3 — ทดสอบหลัง deploy

- เปิดเว็บ → แถบข้างต้องขึ้น "เซิร์ฟเวอร์พร้อมใช้งาน" (ครั้งแรกหลังเงียบนานจะขึ้น "กำลังเชื่อมต่อเซิร์ฟเวอร์" และกล่อง "เซิร์ฟเวอร์กำลังเริ่มทำงาน" เพราะ Render free ปลุกเครื่อง ~1 นาที)
- เลือกอาการจากรายการ → เดินจนจบ → กรอกผลลัพธ์
- **ด่านความปลอดภัย:** เลือกอาการ "ไฟกะพริบที่หน้าจอแอร์ ไฟกระพริบไม่หยุด" (`indicator_blinking`) หรือ "แอร์ไม่ทำงาน เปิดไม่ติด" (`stops_working`) เดินถึงขั้นตอนที่เกี่ยวกับไฟฟ้า (ปิดไฟ/เปิดไฟกลับ/เบรกเกอร์) ต้องถูกบล็อกจนกว่าจะติ๊กยืนยันคำเตือน
- ถ้าเบราว์เซอร์ขึ้น CORS error: `CORS_ORIGIN` ใน Render ต้องเป็น `https://parit-ru.github.io` เป๊ะ (ตัวพิมพ์เล็ก ไม่มี `/` ท้าย ไม่มี path)

## ข้อจำกัดที่รู้อยู่

- **ระบบค้นหาอาการปิดอยู่** (`SYMPTOM_SEARCH_ENABLED=false`, ยังไม่ได้คัดลอก `backend/model/`) ปุ่มค้นหาจะขึ้น "ระบบค้นหาไม่พร้อมใช้งาน" แต่เลือกจากรายการได้ปกติ
- **Render free หลับหลังไม่มีคนใช้ ~15 นาที** คำขอแรกตอนตื่นช้า (frontend ขึ้นกล่อง "เซิร์ฟเวอร์กำลังเริ่มทำงาน" หลังรอ 4 วินาที)
- **ฐานข้อมูลใช้ร่วมกับ FixStep** ห้ามรัน `npm run migrate`/`seed` กับฐานนี้โดยไม่ตั้งใจ (migration 001–007 รันแล้ว) และ session ของสองระบบอยู่ตารางเดียวกัน
- **migration 006/007 รันกับ DB แล้ว (15 ต.ค.) และโค้ดใหม่ต้องใช้คอลัมน์ของมัน** (ถ้าตั้งฐานข้อมูลใหม่/ตัวอื่น ต้องรันก่อนบูต) ลำดับที่ถูก: `node scripts/run-migrations.js --status` → `npm run migrate` → จึง push/deploy โค้ด (ถ้า deploy ก่อน `GraphRepository` โหลดไม่ได้และ backend ไม่ขึ้น) · แผน/รายละเอียด: `docs/features/PLAN-MODEL-SELECTION.md` §9
- `/health` ส่งข้อความ error ของ MySQL ออกสาธารณะตอนฐานล่ม (อาจเผยชื่อโฮสต์) ถ้าห่วง แก้ได้ที่ `health.controller.ts`
- ยังไม่มีเทสอัตโนมัติ (เฟส T) และยังไม่เคยรัน backend ใหม่กับ MySQL จริง — การ deploy ขั้นที่ 1 ข้อ 5 คือครั้งแรกที่ได้ทดสอบจริง

## ย้อนกลับ

- backend: Render → service → Events → Rollback ไปรุ่นก่อนหน้า (หรือ Suspend)
- frontend: ลบ branch `gh-pages` หรือปิด Pages ใน Settings
