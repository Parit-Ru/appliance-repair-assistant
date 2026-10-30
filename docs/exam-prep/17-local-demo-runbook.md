# 17 — Runbook: เดโมบนเครื่อง Windows (PowerShell)

> ใช้เมื่อเลือก**เดโมจากเครื่องตัวเอง**แทน Render/GitHub Pages (เหตุผลอยู่ในไฟล์ 11 §2 และ 14 ข้อ 1.1: production ยังเป็น NestJS และหน้าเว็บเป็น build 14 ต.ค.)
> ตรวจกับโค้ดบน branch `express-migration` (working tree) วันที่ 29 ต.ค. 2569 · คำสั่งทั้งหมดเป็น **PowerShell** และ**ผมยังไม่ได้รันจริง** (กฎห้ามแตะ DB) ค่าที่เขียนว่า "ควรเห็น" มาจากการอ่านโค้ด

**เครื่องนี้มีอยู่แล้ว (ตรวจ 29 ต.ค.):** Node `v22.17.0` (ต้อง ≥ 20 ตาม `backend/package.json:39-41`) · บริการ Windows `MySQL80` กำลังรันอยู่ · `mysql.exe` อยู่ที่ `C:\Program Files\MySQL\MySQL Server 8.0\bin\` (ไม่อยู่ใน PATH) · มี `backend/node_modules`, `frontend/node_modules`, `backend/dist` แล้ว · มีไฟล์ `backend/.env` อยู่แล้ว (ผมไม่ได้เปิดดูค่า)

**เวลาที่ใช้:** ตั้งครั้งแรก ~45–60 นาที · เปิดระบบวันสอบ ~5 นาที (รวมเวลาโหลดโมเดลค้นหา)

---

## 0. กฎความปลอดภัยของ runbook นี้

1. **ใช้ database ใหม่ในเครื่องเท่านั้น** ห้ามชี้ไป Aiven เพราะ Aiven ใช้ร่วมกับ FixStep และตาราง `schema_migrations` บน Aiven บันทึกชื่อไฟล์ migration ของ `main` (12 ไฟล์) ซึ่งต่างจาก branch นี้ (001–006) (ไฟล์ 06) ถ้ารัน `npm run migrate` ใส่ DB นั้น runner จะพยายามรัน 001–006 ซ้ำ
2. ห้ามใช้ database ในเครื่องที่เคย migrate ด้วย `main` ด้วยเหตุผลเดียวกัน → สร้างชื่อใหม่ เช่น `appliance_demo`
3. **สำรอง `backend/.env` เดิมก่อนแก้** และเก็บไว้**นอก repo** (`.gitignore` กันแค่ชื่อ `.env` กับ `.env.local` ตาม `backend/.gitignore:5-6` ชื่ออื่นอย่าง `.env.aiven` อาจหลุดขึ้น git)
4. ทุกคำสั่งที่ต้องแสดงค่าใน `.env` ให้ใช้คำสั่งที่พิมพ์แค่**ชื่อ**ตัวแปร (ข้อ 2.3)

---

## 1. MySQL: สร้าง database ใหม่

```powershell
$mysql = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"

# 1) ดูว่ามีชื่อนี้อยู่แล้วหรือยัง (ถ้ามี appliance_demo อยู่แล้ว ให้เปลี่ยนชื่อ)
& $mysql -u root -p -e "SHOW DATABASES;"

# 2) สร้าง DB ด้วย utf8mb4 ให้ตรงกับ migration (ทุกตารางใช้ utf8mb4_unicode_ci เช่น backend/migrations/002_graphs.sql:23)
& $mysql -u root -p -e "CREATE DATABASE appliance_demo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 3) (แนะนำ) สร้าง user เฉพาะเดโม จะได้ไม่ต้องใส่รหัส root ใน .env
& $mysql -u root -p -e "CREATE USER 'appdemo'@'localhost' IDENTIFIED BY 'ตั้งรหัสเอง'; GRANT ALL PRIVILEGES ON appliance_demo.* TO 'appdemo'@'localhost';"
```

> MySQL 8 ตรงกับที่ใช้บน Aiven · ไม่ได้ทดสอบกับ MariaDB/XAMPP (migration ใช้ `CHECK` constraint และคอลัมน์ `JSON` เช่น `003_equipment.sql:36`, `002_graphs.sql:72`)

---

## 2. ตั้งค่า `backend/.env`

### 2.1 สำรองไฟล์เดิม
```powershell
cd C:\Users\SPS\Desktop\499\appliance-repair-assistant\backend
New-Item -ItemType Directory -Force "$HOME\env-backup" | Out-Null
Copy-Item .env "$HOME\env-backup\backend.env.before-demo"
```

### 2.2 แก้ค่า (เปิดด้วย `notepad .env` **ตอนไม่ได้แชร์จอ**)

| ตัวแปร | ค่าสำหรับเดโมในเครื่อง | ที่อ่าน |
|---|---|---|
| `DB_HOST` / `DB_PORT` | `127.0.0.1` / `3306` | `backend/src/database/pool.ts:25-45` |
| `DB_USER` / `DB_PASSWORD` | user ที่สร้างในข้อ 1 | 〃 |
| `DB_NAME` | `appliance_demo` | 〃 |
| `DB_SSL_CA` | **เว้นว่าง** (MySQL ในเครื่องไม่ใช้ TLS) | `pool.ts:50-54` |
| `PORT` / `NODE_ENV` | `3000` / `development` | `backend/src/main.ts:11` |
| `CORS_ORIGIN` | `http://localhost:5173` (หรือเว้นว่าง เพราะค่าเริ่มต้นเป็นค่านี้อยู่แล้ว) | `backend/src/app.ts:67` |
| `JWT_SECRET` | สุ่มใหม่ ≥ 32 ตัวอักษร: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` · ไม่ตั้ง = backend บูตไม่ขึ้น | `backend/src/auth/token.ts:14-21` |
| `JWT_EXPIRES_IN` | `7d` หรือเว้นว่าง | `token.ts` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_DISPLAY_NAME` | **บัญชีสำหรับเดโมเท่านั้น** (เช่น `admin@demo.local`) ห้ามใช้อีเมลหรือรหัสผ่านจริง · รหัส 8–72 ตัว | `backend/scripts/seed-admin.js:3-6` |
| `SYMPTOM_SEARCH_ENABLED` | `true` (ต้องเป็นคำนี้เป๊ะ) | `symptom-search.service.ts:13, 46` |
| `REPHRASE_ENABLED` | เริ่มด้วย `false` แล้วค่อยทดสอบเปิด (ข้อ 5.7) | `app.ts:34-42` |
| `GROQ_API_KEY`, `GROQ_MODEL` | ใส่ถ้าจะทดสอบ rephrase | `backend/src/rephrase/groq-llm.client.ts:47-52` |
| `AUTHORING_LLM_MODEL` (+ `GROQ_API_KEY`) | ใส่ถ้าจะเดโมร่างผังจาก PDF | `backend/src/authoring/draft-llm.client.ts:137-149` |

> หมายเหตุ: comment ใน `backend/.env.example` ยังอ้าง "migration 010" และ "migration 012" ซึ่งเป็นชื่อบน `main` บน branch นี้ตารางบัญชีอยู่ใน `001_users.sql` และตารางร่างอยู่ใน `006_graph_drafts.sql` ให้ยึดตาม migration จริง

### 2.3 ตรวจว่าตั้งครบ โดยไม่พิมพ์ค่าออกจอ
```powershell
Get-Content .env | Where-Object { $_ -match '^[A-Z_]+=' } | ForEach-Object {
  $k, $v = $_ -split '=', 2
  if ($v.Trim()) { "$k = (ตั้งแล้ว)" } else { "$k = (ว่าง)" }
}
```

---

## 3. Migration + Seed (ใส่ DB ในเครื่องเท่านั้น)

```powershell
cd C:\Users\SPS\Desktop\499\appliance-repair-assistant\backend

# (ถ้ายังไม่มี node_modules หรือเพิ่งดึงโค้ดใหม่) ต้องใช้เน็ต
npm ci

# 1) สร้างตาราง 001–006 (runner จำไฟล์ที่รันแล้วใน schema_migrations: backend/scripts/run-migrations.js:33-40)
npm run migrate

# 2) ผัง 21 เล่ม (ชุดเดียวกับ data/runseed.txt) หยุดทันทีถ้ามีเล่มไหนล้ม
Get-ChildItem ..\data\manuals\*.json | ForEach-Object {
  node .\scripts\seed-graphs.js $_.FullName
  if ($LASTEXITCODE -ne 0) { throw "seed ล้ม: $($_.Name)" }
}
#    ควรเห็นท้ายสุด: "ในฐานข้อมูลตอนนี้: 21 คู่มือ · 631 กราฟ · 4739 โหนด" (seed-graphs.js:214)

# 3) อุปกรณ์ที่อาจต้องใช้ (ค่าเริ่มต้นอ่าน data/equipment/equipment.json: seed-equipment.js:7)
npm run seed:equipment

# 4) admin คนแรก (อ่าน ADMIN_* จาก .env · ไม่พิมพ์รหัสผ่าน · รันซ้ำได้: seed-admin.js:8-12)
npm run seed:admin
```

**ตรวจข้อมูล (ไม่บังคับ แต่แนะนำ):**
```powershell
& $mysql -u appdemo -p appliance_demo -e "SELECT COUNT(*) graphs FROM graphs; SELECT COUNT(*) nodes FROM nodes; SELECT COUNT(*) with_note FROM nodes WHERE author_note IS NOT NULL; SELECT COUNT(*) with_warning FROM nodes WHERE safety_warning IS NOT NULL;"
```
ควรได้ 631 / 4739 / 1264 / 368 (นับจาก `data/manuals/*.json` ไฟล์ 00 และ 18)

---

## 4. รัน backend และ frontend (2 หน้าต่าง PowerShell)

**หน้าต่าง 1 — backend**
```powershell
cd C:\Users\SPS\Desktop\499\appliance-repair-assistant\backend
npm run build      # ลบ dist แล้ว tsc (package.json scripts.build)
npm start          # node dist/main.js
```
log ที่ควรเห็นตามลำดับ:
1. `DB_SSL_CA: ไม่ได้ตั้งค่า (เชื่อมต่อแบบไม่ใช้ SSL)` (`pool.ts:50-54`)
2. `เชื่อมต่อ MySQL สำเร็จ: appliance_demo ที่ 127.0.0.1:3306` (`pool.ts:61`)
3. `โหลดกราฟสำเร็จ 631 กราฟ 4739 โหนด` (`graph.repository.ts:171`)
4. `ระบบค้นหาพร้อม: 3814 ข้อความ จาก 631 ผัง ใน … ms` (`symptom-search.service.ts:94-96`) **รอบรรทัดนี้ก่อนเริ่มค้นหา** (ระหว่างรอ API ค้นหาตอบ 503)

**หน้าต่าง 2 — frontend**
```powershell
cd C:\Users\SPS\Desktop\499\appliance-repair-assistant\frontend
npm run dev        # Vite ใช้ VITE_API_URL=http://localhost:3000 จาก frontend/.env.development
```
เปิด `http://localhost:5173/` (ตอน dev ใช้ base `/` ส่วน `/appliance-repair-assistant/` ใช้เฉพาะ build production: `frontend/vite.config.ts:24`)

**ตรวจสุขภาพ (หน้าต่างที่ 3):**
```powershell
Invoke-RestMethod http://localhost:3000/health                 # status = ok, database = ok
Invoke-RestMethod http://localhost:3000/symptom-search/status  # state = ready
```

---

## 5. Checklist ทดสอบด้วยมือ (ทำครบ 1 รอบก่อนวันสอบ และรอบสั้นเช้าวันสอบ)

ใช้เบราว์เซอร์ 2 หน้าต่าง: **A = guest** (InPrivate) และ **B = ล็อกอิน** (หน้าต่างปกติ)

### 5.1 Guest chat (หน้าต่าง A)
- [ ] หน้าแรก → อุปกรณ์ → ไมโครเวฟ → รุ่น **GE83MDT** → พิมพ์ **"ไมโครเวฟไม่ร้อน"** → ได้ผลไม่เกิน 3 รายการพร้อมคะแนน
- [ ] เลือก **"อาหารไม่สุกเลย"** → ขั้นแรกแสดงบรรทัดที่มา "… หน้า 37"
- [ ] n1 ตอบ **ไม่ใช่** → n1f **กล่องเตือนแดง** ปุ่มยืนยันกดไม่ได้จนกว่าจะติ๊ก → ติ๊ก → ยืนยัน
- [ ] n1v ตอบ **ใช่** → resolution → พิมพ์ข้อความผลลัพธ์ → บันทึก (บันทึกได้ครั้งเดียว)
- [ ] กรณีข้อมูลไม่พอ: พิมพ์ **"วันนี้ฝนตก"** → ระบบบอกว่าไม่พบ ไม่เดา (เกณฑ์ 0.55)
- [ ] "ดูอาการทั้งหมด" ใช้ได้ (ทางสำรองถ้าระบบค้นหายังไม่พร้อม)

### 5.2 สมัคร / Login (หน้าต่าง B)
- [ ] `/register` สร้าง user เดโม 1 บัญชี (อีเมลปลอม เช่น `user1@demo.local`)
- [ ] ออกจากระบบ → `/login` ด้วยรหัสผิด → ได้ข้อความรวมๆ ไม่บอกว่าอีเมลมีอยู่หรือไม่ → ล็อกอินด้วยรหัสถูก
- [ ] ทำเคส 5.1 ซ้ำ 1 รอบในฐานะ user (ให้มีประวัติฝั่ง user)

### 5.3 ประวัติการซ่อม
- [ ] หน้าต่าง B: เมนู "ประวัติการซ่อม" → เห็นรายการที่เพิ่งจบ → รายละเอียดแสดงขั้นที่ตอบ, คำเตือนที่ผ่านมา, อ้างอิง
- [ ] หน้าต่าง A (guest): เห็นประวัติของตัวเองด้วย (ผูกกับ `X-Client-Id` ใน localStorage · ปิดหน้าต่าง InPrivate แล้วประวัติ guest จะหายจากหน้าจอ)
- [ ] user ไม่เห็นประวัติของ guest และกลับกัน
- [ ] ลบประวัติ 1 รายการ → หายจากรายการ

### 5.4 Feedback
- [ ] ในหน้ารายละเอียด: กด 👍 + พิมพ์ความเห็น → ส่ง
- [ ] เปลี่ยนเป็น 👎 → ส่ง → ค่าใหม่แทนค่าเดิม (1 session มี 1 feedback)

### 5.5 Admin dashboard
- [ ] หน้าต่าง B: ออกจากระบบ → ล็อกอินด้วยบัญชี admin จากข้อ 3
- [ ] `/admin/analytics` แสดงจำนวนการตรวจ, จบ, ค้าง, satisfaction rate, คะแนนเฉลี่ย, ผลจบ, อาการยอดนิยม, กราฟรายวัน (ตัวเลขมาจากข้อ 5.1–5.4)
- [ ] `/admin/feedback` เห็น feedback จากข้อ 5.4 · ลองกรอง 👍/👎
- [ ] ล็อกอินเป็น user ธรรมดาแล้วเปิด `/admin` → เข้าไม่ได้

### 5.6 Upload PDF → ร่าง → Publish (ต้องมีเน็ต + `GROQ_API_KEY` + `AUTHORING_LLM_MODEL`)
ข้อจำกัดจากโค้ด: PDF ≤ **10 MB** (`drafts.routes.ts:22`) · เลือกได้ ≤ **10 หน้า**ต่อร่าง (`backend/src/authoring/pdf-text.ts:4`) · publish ได้เฉพาะ **manual_id ใหม่** ที่ graph_id ไม่ชนผังเดิม (`backend/src/authoring/drafts.service.ts:59, 236-240`)

- [ ] เลือก PDF ที่**ยังไม่อยู่ในฐานความรู้**และไม่เกิน 10 MB เช่น `data/pdf/RT7000_DA68-04283G-00.pdf` (5.5 MB) — **ผมยังไม่ได้เปิดดูว่า PDF นี้มี text layer หรือหน้า Troubleshooting อยู่หน้าไหน** ต้องลองเอง ถ้าไม่ได้ให้ใช้เล่มอื่นที่ ≤ 10 MB
- [ ] `/admin/drafts` → กรอก manualId, ประเภท, ยี่ห้อ, รุ่น, ชื่อคู่มือ, หน้าเริ่ม–จบ (2–4 หน้าพอ) → อัปโหลด
- [ ] สถานะเปลี่ยน `drafting` → `ready` (หน้าเว็บ poll ทุก 3 วินาที · LLM ทีละ 2 หน้า ครั้งละไม่เกิน 60 วินาที)
- [ ] เปิดร่าง → ดูข้อความหน้า PDF คู่กับแต่ละโหนด, รายงาน error/warning
- [ ] ถ้ามี error แก้ใน JSON editor จนผ่าน → ติ๊กยืนยันว่าตรวจแล้ว → publish (ถ้ามี warning ต้องยืนยันก่อน)
- [ ] กลับหน้าค้นหา → เลือกรุ่นใหม่ → ค้นอาการของเล่มนั้นได้ทันที โดยไม่ต้องรีสตาร์ต
- [ ] **เตรียมร่าง `ready` อีก 1 ร่างไว้โดยยังไม่ publish** สำหรับวันสอบ (ร่างเก็บใน DB ตาราง `graph_drafts` อยู่ข้ามการรีสตาร์ตได้ แต่ร่างที่ค้าง `drafting` ตอนบูตจะถูกเปลี่ยนเป็น failed: `app.ts:62` → `drafts.service.ts:44`)

### 5.7 Rephrase เปิด / ปิด
| ขั้น | ทำ | ควรเห็น |
|---|---|---|
| ปิด | `.env`: `REPHRASE_ENABLED=false` → Ctrl+C ที่หน้าต่าง 1 → `npm start` | ข้อความทุกขั้นตรงกับคู่มือ ไม่มีบรรทัด "ปรับถ้อยคำด้วย AI" |
| เปิด | `REPHRASE_ENABLED=true` + `GROQ_API_KEY` + `GROQ_MODEL` → รีสตาร์ต | ขั้น checkpoint/instruction ที่**ไม่ใช่** safety มีบรรทัด "ข้อความนี้ปรับถ้อยคำด้วย AI — ดูข้อความต้นฉบับจากคู่มือ" กดดูต้นฉบับได้ (`frontend/src/components/RephraseNote.tsx:8`) |
| เปิด: ขั้น safety / ขั้นสุดท้าย | เดินถึง n1f และ resolution | **ไม่**ถูกเรียบเรียง (`backend/src/rephrase/rephrase.service.ts:40` · `frontend/src/pages/SessionPage.tsx:118`) |
| เปิดแต่ไม่มี key | ลบ key ชั่วคราว → รีสตาร์ต | log เตือน `REPHRASE_ENABLED=true แต่ตั้ง GROQ_API_KEY/GROQ_MODEL ไม่ครบ — ใช้ข้อความต้นฉบับ` (`app.ts:36-37`) และระบบยังใช้งานได้ |

---

## 6. แผนสำรองเมื่อไม่มีเน็ต

**ส่วนที่ทำงานได้โดยไม่ใช้เน็ต:** MySQL ในเครื่อง, backend, frontend dev server, โมเดล embedding (อยู่ใน `backend/model/` และโค้ดห้ามโหลดจากเน็ต: `backend/src/embedding/embedding.service.ts:34`), การเดินผัง (ไม่ใช้ LLM), ประวัติ, feedback, dashboard · frontend ไม่โหลด font หรือไฟล์จากภายนอก (ตรวจ `frontend/index.html` และ `src/` แล้วไม่พบ URL ภายนอก)

**ส่วนที่ต้องใช้เน็ต:** rephrase และร่างผังจาก PDF (Groq) · `npm ci` (ทำไว้ก่อนแล้ว)

**ขั้นตอนเมื่อเน็ตล่มหรือไม่แน่ใจเรื่องเน็ต:**
1. `.env`: `REPHRASE_ENABLED=false` → รีสตาร์ต backend
   - เหตุผล: ถ้าเปิดไว้แต่ไม่มีเน็ต ทุกขั้นที่ไม่ใช่ safety จะรอให้ Groq ล้มก่อน (สูงสุด `REPHRASE_TIMEOUT_MS` ค่าเริ่มต้น 3000 ms: `app.ts:41`, `rephrase.service.ts:45-46`) แล้วค่อยใช้ข้อความต้นฉบับ (`rephrase.service.ts:56-58`) ผลลัพธ์ถูกต้องแต่ช้าลงขั้นละไม่เกิน 3 วินาที
2. เดโมร่างผังด้วย**ร่าง `ready` ที่เตรียมไว้** (ข้อ 5.6) แทนการอัปโหลดสด
3. พูดว่า: "นี่คือเหตุผลที่ไม่ให้ LLM อยู่บนเส้นทางหลัก ปิด LLM แล้วระบบยังค้นหาและพาตรวจได้ครบ"

**ซ้อมจริง 1 รอบ:** ปิด Wi-Fi → รีสตาร์ต backend → ทำ checklist 5.1–5.5 ให้ผ่าน → เปิด Wi-Fi กลับ

**เคล็ดลับถ้าอยากโชว์ rephrase ทั้งที่เน็ตไม่แน่นอน:** ผลที่เรียบเรียงแล้ว**ถูก cache ในหน่วยความจำ**ตามข้อความต้นฉบับ (`rephrase.service.ts:42-43`) ถ้าเดินเส้นทางเดโม 1 รอบตอนมีเน็ตแล้ว**ไม่รีสตาร์ต** backend เส้นทางเดิมจะแสดงข้อความที่เรียบเรียงจาก cache โดยไม่เรียก Groq อีก

---

## 7. ก่อนกรรมการเห็นหน้าจอ

### ปิด / ซ่อน
- [ ] **ปิดแท็บ `.env` ทุกไฟล์ใน VS Code** และอย่าเปิดโฟลเดอร์ที่มี `.env` ใน Explorer ขณะแชร์จอ (ถ้าต้องการ ซ่อนผ่าน User Settings → `files.exclude` ของตัวเอง ไม่ต้องแก้ไฟล์ในโปรเจกต์)
- [ ] ห้ามรัน `Get-Content .env`, `type .env`, `echo $env:...` ขณะแชร์จอ ถ้าต้องตรวจให้ใช้คำสั่งข้อ 2.3
- [ ] หน้าต่าง backend: log มีชื่อ DB และ host:port (`pool.ts:61`) ถ้าชี้ในเครื่องจะเป็น `127.0.0.1` ไม่มีความลับ แต่ถ้าเห็น host ของ Aiven แปลว่าใช้ `.env` ผิดไฟล์ ให้หยุดก่อน
- [ ] ถ้าเกิด error 500 backend จะพิมพ์ stack trace (`backend/src/common/error-handler.ts:97`) ไม่มีความลับ แต่ดูรก → ย่อหน้าต่าง backend ไว้ เปิดเมื่อจะโชว์ log ตอนบูตเท่านั้น
- [ ] **DevTools ของเบราว์เซอร์:** แท็บ Application มี JWT ใน localStorage (`frontend/src/lib/authStorage.ts:49`) และแท็บ Network แสดง header `Authorization` → อย่าเปิด 2 แท็บนี้ระหว่างแชร์จอ (frontend ไม่มี `console.log` ตรวจแล้ว)
- [ ] ปิดแท็บ Aiven console, Render dashboard, Groq console, อีเมล, LINE
- [ ] เปิด Focus Assist ของ Windows (ไม่ให้แจ้งเตือนเด้ง) · ปิด autofill รหัสผ่านของเบราว์เซอร์ หรือพิมพ์เอง
- [ ] ใช้บัญชี admin/user **ของเดโม** เท่านั้น

### เตรียมให้พร้อม
- [ ] backend ขึ้นถึงบรรทัด "ระบบค้นหาพร้อม" แล้ว · `/health` = ok
- [ ] มีประวัติที่จบแล้ว ≥ 2 รายการ (1 รายการมี feedback) ให้ dashboard มีตัวเลข
- [ ] ร่าง `ready` 1 ร่าง (ยังไม่ publish)
- [ ] ซูมเบราว์เซอร์ 125% ให้กรรมการอ่านทัน
- [ ] เปิดไฟล์โค้ดที่จะโชว์ไว้ล่วงหน้า (รายการในไฟล์ 15 §2)
- [ ] `git status` / `git log -1 --oneline` เพื่อตอบข้อ J6 ว่าเดโมรันโค้ดชุดไหน → **แนะนำให้ commit งานที่ค้างก่อนวันสอบ** (ตอนนี้ working tree มีไฟล์แก้ที่ยังไม่ commit จำนวนมาก) เพื่อให้บอกได้ว่าเดโม = commit ไหน

---

## 8. หลังสอบ: คืนค่าเดิม
```powershell
cd C:\Users\SPS\Desktop\499\appliance-repair-assistant\backend
Copy-Item "$HOME\env-backup\backend.env.before-demo" .env -Force
```
- DB `appliance_demo` เก็บไว้ได้ หรือลบด้วย `DROP DATABASE appliance_demo;` (ทำเอง)
- ถ้าเผลอแชร์จอตอนเปิด `.env` ที่มี `GROQ_API_KEY` ให้ revoke key แล้วออกใหม่

---

## 9. ปัญหาที่น่าจะเจอ

| อาการ | สาเหตุ | แก้ |
|---|---|---|
| บูตแล้วล้มด้วย `JWT_SECRET ต้องตั้งใน .env …` | ไม่ได้ตั้งหรือสั้นกว่า 32 | ข้อ 2.2 (`token.ts:16-20`) |
| `เชื่อมต่อ MySQL ไม่สำเร็จ` | `MySQL80` ไม่รัน / user-password ผิด / ไม่มี DB | `Get-Service MySQL80` · ตรวจข้อ 1 |
| `npm run migrate` แจ้งว่าไม่พบค่าใน `.env` | ขาด `DB_HOST/DB_PORT/DB_USER/DB_NAME` | `run-migrations.js:10-18` |
| migrate ล้มเพราะตารางมีอยู่แล้ว | ใช้ DB เก่า | สร้าง DB ใหม่ (ข้อ 0 ข้อ 2) |
| ค้นหาได้ 503 "กำลังเริ่มทำงาน" | โมเดลยังโหลดไม่เสร็จ | รอ log "ระบบค้นหาพร้อม" หรือใช้ "ดูอาการทั้งหมด" |
| ค้นหาไม่ทำงานเลย | `SYMPTOM_SEARCH_ENABLED` ไม่ใช่ `true` | แก้แล้วรีสตาร์ต |
| หน้าเว็บขึ้น CORS error | เปิด frontend ที่ port อื่น (เช่น `npm run preview` = 4173) | ใช้ `npm run dev` (5173) หรือแก้ `CORS_ORIGIN` |
| อัปโหลด PDF ไม่ได้ | ไฟล์ > 10 MB / เลือก > 10 หน้า / manual_id ซ้ำ | ข้อ 5.6 |
| ร่างล้ม `LLM_NOT_CONFIGURED` | ไม่มี `AUTHORING_LLM_MODEL` หรือ key | ตั้งแล้วรีสตาร์ต หรือใช้ร่างที่เตรียมไว้ |
