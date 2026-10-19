# Step 5: ผู้ดูแลระบบอัปโหลดคู่มือ PDF → AI ร่างแผนผังขั้นตอน → ตรวจ → เผยแพร่

สถานะ (16 ต.ค. 2569): B1 (backend) + B2 (หน้าจอ) เขียนครบ · ผ่านเทสต์อัตโนมัติทั้งหมด · **ยังไม่ได้ทดสอบกับ LLM จริง ฐานข้อมูลจริง และเบราว์เซอร์จริง** (หัวข้อ 8)
แผนที่ตกลงไว้: `docs/authoring/PLAN-STEP5-AUTHORING.md` · รายละเอียดการทดสอบ backend ด้วย PowerShell: `docs/authoring/authoring-b1-testing.md`

> คำศัพท์: บนหน้าจอใช้คำว่า **"แผนผังขั้นตอน"** (ในโค้ดและฐานข้อมูลยังเรียก graph / graph_id ตามเดิม)

---

## 1. ภาพรวม

เดิมการเพิ่มคู่มือใหม่ทำด้วยมือทั้งหมด (แยกข้อความจาก PDF → แปลงเป็นผัง → แปล → `seed-graphs.js` → รีสตาร์ต) ขั้นนี้เพิ่มทางลัดให้ผู้ดูแลระบบ:
อัปโหลด PDF บนหน้าเว็บ → AI ร่างแผนผังขั้นตอนให้ → ระบบตรวจด้วยกฎที่เขียนเป็นโค้ด → **คนตรวจและอนุมัติ** → ผู้ใช้เห็นทันทีโดยไม่ต้องรีสตาร์ต

**หลักการที่ห้ามละเมิด**
1. **AI ไม่มีอำนาจใดๆ ต่อการเดินขั้นตอน** ตอนผู้ใช้ตรวจอาการ engine เดินตามแผนผังแบบ deterministic เหมือนเดิม AI มีบทบาทแค่ "ร่าง" ตอนสร้างข้อมูล
2. **ผู้ตัดสินคือโค้ด + คน ไม่ใช่ AI** ผลจาก AI ต้องผ่านการแปลงรูปแบบอย่างเข้ม → validator (โค้ดล้วน) → คนอนุมัติ
3. **error = เผยแพร่ไม่ได้ ไม่มีทางข้าม** · warning = ต้องติ๊กรับทราบ (`acknowledgedWarnings: true`) · server ตรวจซ้ำทุกครั้งที่เผยแพร่
4. **ร่างมองไม่เห็นจากทุกหน้าที่ผู้ใช้ใช้** ร่างอยู่ในตาราง `graph_drafts` แยกจาก `manuals/graphs/nodes`
5. **ไม่เขียนทับของเดิม** เผยแพร่ได้เฉพาะคู่มือใหม่ (`manual_id` ใหม่) เป็น INSERT ล้วน
6. **ข้อมูลที่ไม่ใช่เนื้อหา เซิร์ฟเวอร์กำหนดเอง** (รหัสคู่มือ ยี่ห้อ รุ่น ชื่อคู่มือ เลขหน้า graph_id) จากที่ผู้ดูแลกรอก AI ใส่มาเองจะถูกปฏิเสธทั้งก้อน

---

## 2. Flow

```
[ผู้ดูแล] /admin/drafts : เลือก PDF + ช่วงหน้า (≤10) + ข้อมูลคู่มือ → "อัปโหลดและเริ่มร่าง"
   │ POST /admin/drafts (multipart, ไฟล์อยู่ในหน่วยความจำ ≤ AUTHORING_MAX_PDF_MB)
   ▼
[backend] ตรวจสิทธิ์ admin → ตรวจไบต์ %PDF- → แยกข้อความรายหน้า (unpdf) → ไม่มีข้อความ = 422 (ภาพสแกน)
   │ บันทึก graph_drafts (status = drafting, เก็บข้อความหน้า ไม่เก็บไฟล์) → ตอบ 202 {id}
   ▼ (เบื้องหลัง ทีละ 1 งาน)
   LLM (Groq, JSON mode) ทีละ 2 หน้า → parse เข้ม (ฟิลด์แปลก = ปฏิเสธ) → ตั้ง graph_id/เลขหน้า/source เอง
   → validator (โค้ดล้วน) → status = ready (+ รายงาน)  หรือ  failed (+ สาเหตุ)
   ▼
[ผู้ดูแล] /admin/drafts/:id : หน้าถามสถานะเองทุก 3 วินาทีระหว่างร่าง
   อ่านรายงาน · เทียบทุกโหนดกับข้อความหน้าต้นฉบับ · ดูด่านความปลอดภัย/คำเตือนคำเสี่ยง · ไล่เส้นทาง
   แก้ JSON → "ตรวจใหม่" (PUT → validator ใหม่)   /   "ปฏิเสธ"   (ร่างที่ failed = จบ ต้องอัปโหลดใหม่)
   ติ๊ก "ตรวจแล้ว" (+ "รับทราบคำเตือน" ถ้ามี) → "เผยแพร่ให้ผู้ใช้เห็น"
   │ POST /admin/drafts/:id/publish {acknowledgedWarnings}
   ▼
[backend] transaction: ล็อกแถวร่าง → validator ซ้ำกับข้อมูลที่ล็อก → error = 409 · warning ไม่ยืนยัน = 409
   → id ชนของเดิม = 409 → INSERT manuals/graphs/nodes → ร่าง = published → COMMIT
   → GraphRepository.reload() (ผู้ใช้เห็นทันที) → SymptomSearchService.addGraphs() (ค้นด้วยข้อความเจอ)
```

---

## 3. ไฟล์และหน้าที่

### Backend (B1) — `appliance-repair-assistant/backend/`
| ไฟล์ | หน้าที่ |
|---|---|
| `migrations/012_create_graph_drafts.sql` | ตารางร่าง (สถานะ ข้อความหน้า ร่าง รายงาน audit) แยกจากตารางที่ผู้ใช้อ่าน |
| `src/authoring/graph-validator.ts` | ตัวตรวจแผนผังขั้นตอนด้วยโค้ดล้วน (พอร์ตจาก `scripts/validate_graph.py`) ผ่านกับข้อมูลจริง 644 ผัง |
| `src/authoring/draft-schema.ts` | แปลงคำตอบ AI / JSON ที่แก้ อย่างเข้ม · สร้าง graph_id จาก slug |
| `src/authoring/draft-manual.ts` | ประกอบคู่มือจากร่าง (ค่าที่เซิร์ฟเวอร์กำหนด) และแปลงเป็นแถว INSERT |
| `src/authoring/pdf-text.ts` | แยกข้อความรายหน้าจาก PDF ในหน่วยความจำ (unpdf) |
| `src/authoring/draft-llm.client.ts` | prompt + เรียก Groq (JSON mode, timeout) คืนข้อความดิบ |
| `src/authoring/drafts.store.ts` | SQL ของ `graph_drafts` + publish ใน transaction (ที่เดียวที่แตะตารางร่าง) |
| `src/authoring/drafts.service.ts` | วงจรชีวิตร่าง งานเบื้องหลังทีละ 1 งาน ตรวจซ้ำตอนเผยแพร่ |
| `src/authoring/drafts.controller.ts`, `drafts.dto.ts`, `drafts.errors.ts` (ฟังก์ชันสร้าง `ApiError`), `authoring.module.ts` | endpoint `/admin/drafts…` (admin เท่านั้น) · ตรวจ input · error format `{statusCode, code, message}` แปลงโดย `common/all-exceptions.filter.ts` (เฉพาะ error ตัวรับไฟล์ตอนอัปโหลดใช้ filter เล็กใน `drafts.controller.ts`) — `drafts.exception.filter.ts` ถูกลบแล้ว |
| `src/traversal/graph.repository.ts` (แก้) | `reload()` สร้าง Map ใหม่แล้วสลับ (ล้มกลางทาง = ของเดิมอยู่ครบ) |
| `src/symptom-search/symptom-search.service.ts` (แก้) | `addGraphs()` เพิ่มเฉพาะผังใหม่เข้าดัชนีค้นหา |
| `scripts/backup-graph-tables.js` | สำรอง manuals/graphs/nodes/graph_drafts เป็น `.sql` (อ่านอย่างเดียว) |
| เทสต์: `src/authoring/*.spec.ts`, `src/authoring/testing/*`, `src/symptom-search/symptom-search.add-graphs.spec.ts` | ดูหัวข้อ 8 |

### Frontend (B2) — `appliance-repair-assistant/frontend/src/`
| ไฟล์ | หน้าที่ |
|---|---|
| `api/http.ts` (แก้) | รองรับ `PUT` และอัปโหลดแบบ `FormData` (ไม่ใส่ Content-Type เอง) |
| `api/types.ts` (แก้), `api/drafts.ts` | ชนิดข้อมูลตรงกับ backend · เรียก `/admin/drafts…` |
| `api/queries.ts` (แก้) | key `['admin', identity, 'drafts', …]` · ถามสถานะทุก 3 วินาทีเฉพาะตอนมีร่าง `drafting` · mutation อัปโหลด/แก้/ลองใหม่/ปฏิเสธ/เผยแพร่ |
| `lib/draftView.ts` | ป้าย เส้นทางแบบข้อความ จัดกลุ่ม issue เงื่อนไขปุ่มเผยแพร่ ตรวจฟอร์มอัปโหลด (ฟังก์ชันล้วน) |
| `lib/errors.ts` (แก้) | ข้อความไทยของรหัส error ใหม่ทั้ง 13 รหัส |
| `components/admin/AdminTabs.tsx` (แก้) | แท็บที่สาม "ร่างแผนผังขั้นตอน" |
| `components/admin/drafts/UploadDraftForm.tsx` | ฟอร์มอัปโหลด (ไฟล์ ช่วงหน้า ข้อมูลคู่มือ · แนะนำ `demo_`) |
| `components/admin/drafts/ValidationReportPanel.tsx` | รายงาน: ข้อผิดพลาด · คำเตือนคำเสี่ยง (กล่องแดงแยก) · คำเตือนอื่น |
| `components/admin/drafts/DraftGraphCard.tsx` | แผนผังขั้นตอน: เส้นทางแบบข้อความ + ทุกโหนดพร้อมข้อความหน้าต้นฉบับข้างกัน + ป้ายด่านความปลอดภัย + issue รายโหนด |
| `components/admin/drafts/DraftJsonEditor.tsx` | แก้ JSON + "ตรวจใหม่" / "คืนค่าเดิม" |
| `components/admin/drafts/DraftActions.tsx` | ปฏิเสธ (มีขั้นยืนยัน) · เผยแพร่ (ช่องติ๊ก 2 ช่อง) |
| `components/admin/drafts/DraftStatusBadge.tsx` | ป้ายสถานะ |
| `pages/AdminDraftsPage.tsx`, `pages/AdminDraftReviewPage.tsx`, `App.tsx` (แก้) | route `/admin/drafts`, `/admin/drafts/:id` ครอบด้วย `AdminRoute` |
| เทสต์: `lib/draftView.test.ts`, `lib/draftTestFixtures.ts`, `api/drafts.test.ts`, `pages/AdminDraftsPage.test.tsx`, `pages/AdminDraftReviewPage.test.tsx` | ดูหัวข้อ 8 |

---

## 4. การตัดสินใจ (a)–(i)

| ข้อ | ตัดสินใจ | ข้อแลกเปลี่ยน |
|---|---|---|
| (a) LLM | Groq ตัวเดิม (`fetch` ไม่เพิ่ม SDK) · JSON mode · `temperature: 0` · ทีละ 1–2 หน้า · parse เข้มทุกครั้ง · env แยก `AUTHORING_LLM_MODEL` | Groq ฟรีจำกัด token/นาที จึงต้องเลือกช่วงหน้า · คุณภาพการแปล/แตกขั้นตอน validator ตรวจไม่ได้ คนต้องเทียบ |
| (b) Embedding | ทำตอนเผยแพร่ในโปรเซส (`addGraphs` เฉพาะผังใหม่) | เผยแพร่ช้าขึ้นไม่กี่วินาที · ถ้าระบบค้นหาปิด/ยังโหลด จะค้นเจอหลังรีสตาร์ต (เลือกจากรายการได้ทันที) |
| (c) ขนาด | ≤ 10 MB (ปรับได้), ≤ 200 หน้า, ≤ 10 หน้าต่อร่าง · ไฟล์อยู่ในหน่วยความจำ เก็บแค่ข้อความหน้าที่เลือก | คู่มือส่วนใหญ่ในโปรเจกต์ใหญ่กว่า 10 MB · ส่วน troubleshooting ที่ยาวกว่า 10 หน้าต้องแบ่งร่าง |
| (d) หน้าตรวจ | รายงาน + ข้อความหน้าต้นฉบับข้างทุกโหนด + ป้ายด่านความปลอดภัย + คำเตือนคำเสี่ยง + เส้นทางแบบข้อความ + ตัวแก้ JSON + ช่องติ๊กบังคับ + ป้าย "ร่างโดย AI · ยังไม่เผยแพร่" | หน้ายาวเมื่อมีหลายโหนด (ข้อความหน้าซ้ำข้างหลายโหนด) — เลือกความชัดในการเทียบมากกว่าความสั้น |
| (e) validator ไม่ผ่าน | กันเด็ดขาด ไม่มี override · warning ต้องติ๊กรับทราบ | แผนผังที่แปลกแต่ตั้งใจต้องแก้ให้ผ่านกฎ หรือแก้กฎในโค้ด (ผ่านเทสต์ 644 ผัง) |
| (f) LLM บล็อก request ไหม | งานเบื้องหลังในโปรเซส + หน้าจอถามสถานะทุก 3 วินาที · ทีละ 1 งาน | เซิร์ฟเวอร์ดับกลางงาน → ร่างเป็น failed (INTERRUPTED) ต้องอัปโหลดใหม่ |
| (g) audit | `created_by`, `created_at`, `reviewed_by`, `reviewed_at`, `published_at`, `llm_model`, `prompt_version` (user id ไม่เก็บอีเมล) · ผังที่เผยแพร่มี `source_chunk_id = draft:<id>:<graph_id>` | id ผู้ดูแลอยู่ในฐานข้อมูลเท่านั้น ไม่ส่งออก API |
| (h) เลขหน้ารายโหนด | เก็บเฉพาะในร่าง (หลักฐาน) · ผังจริงใช้ช่วงหน้า min–max | ผู้ใช้ปลายทางเห็นช่วงหน้าของแผนผัง ไม่ใช่รายโหนด (เหมือนผังเดิม) |
| (i) ขอบเขตเผยแพร่ | คู่มือใหม่เท่านั้น | เพิ่มอาการให้คู่มือเดิมผ่านทางนี้ไม่ได้ |
| เพิ่ม | ไม่ทำ endpoint ลบ — ลบข้อมูล demo ด้วย SQL (หัวข้อ 6 ขั้นที่ 10) · `manual_id` ทดสอบขึ้นต้น `demo_` | ต้องมีโปรแกรม MySQL และรีสตาร์ตหลังลบ |

---

## 5. การตั้งค่า (ทำครั้งเดียว)

```powershell
cd C:\Users\SPS\Desktop\499\appliance-repair-assistant\backend
npm install unpdf
npm install --save-dev @types/multer
```
เพิ่มใน `backend\.env` (ใส่เอง): `AUTHORING_LLM_MODEL=<ชื่อโมเดล Groq ที่รองรับ JSON mode>` · ไม่บังคับ: `AUTHORING_LLM_TIMEOUT_MS` (60000), `AUTHORING_LLM_MAX_TOKENS` (6000), `AUTHORING_MAX_PDF_MB` (10) · ใช้ `GROQ_API_KEY` ตัวเดิม

---

## 6. ทดสอบด้วยมือแบบรวดเดียว (backup → migrate → อัปโหลด → ตรวจ → เผยแพร่ → ใช้ → ลบ)

### ขั้นที่ 1 — สำรองฐานข้อมูล (⚠️ ก่อนอย่างอื่น)
```powershell
cd C:\Users\SPS\Desktop\499\appliance-repair-assistant\backend
node scripts\backup-graph-tables.js
```
ต้องเห็น `สำรองสำเร็จ: …\backups\graph-tables-<เวลา>.sql` · manuals 22 · graphs 644 · nodes 4,834 (จดตัวเลขไว้เทียบตอนลบ)

### ขั้นที่ 2 — migrate + build + เทสต์
```powershell
npm run migrate          # ต้องเห็น 012 ถูกรัน
npx jest                 # ต้องผ่านทั้งหมด (backend)
npm run build
cd ..\frontend
npx vitest run           # ต้องผ่านทั้งหมด (frontend)
```

### ขั้นที่ 3 — เปิดระบบ
```powershell
# หน้าต่างที่ 1 (หยุด backend ตัวเก่าก่อน)
cd C:\Users\SPS\Desktop\499\appliance-repair-assistant\backend
npm run seed:admin       # ถ้ายังไม่มีบัญชี admin
npm run start:prod
# หน้าต่างที่ 2
cd C:\Users\SPS\Desktop\499\appliance-repair-assistant\frontend
npm run dev              # http://localhost:5173
```
ตรวจเร็ว: `Invoke-WebRequest http://localhost:3000/admin/drafts` ต้องได้ **401** (ไม่ใช่ 404)

### ขั้นที่ 4 — สิทธิ์ (ต้องปฏิเสธ)
1. ไม่เข้าสู่ระบบ เปิด `http://localhost:5173/#/admin/drafts` → ไปหน้าเข้าสู่ระบบพร้อม "หน้านี้ต้องเข้าสู่ระบบ"
2. เข้าสู่ระบบด้วยบัญชีผู้ใช้ธรรมดา → `#/admin/drafts` ต้องเห็น "ไม่มีสิทธิ์เข้าถึงหน้านี้"
3. เข้าสู่ระบบด้วย admin → เมนู "ผู้ดูแลระบบ" → แท็บ **"ร่างแผนผังขั้นตอน"**

### ขั้นที่ 5 — อัปโหลด
ในแท็บ "ร่างแผนผังขั้นตอน" กรอก:
| ช่อง | ค่า |
|---|---|
| ไฟล์ | `C:\Users\SPS\Desktop\499\appliance-repair-assistant\data\pdf\BMF_RB6000D_DA68-04800B_EN_240305.pdf` (9.2 MB) |
| หน้าเริ่ม / หน้าสุดท้าย | 68 / 69 |
| รหัสคู่มือ | `demo_rb6000d_test` (**ต้องขึ้นต้น `demo_`**) |
| ประเภทเครื่อง / ยี่ห้อ / รุ่น | ตู้เย็น / Samsung / RB6000D |
| ชื่อที่แสดง | DEMO RB6000D (ใช้หาในขั้นที่ 8) |
| ชื่อคู่มือต้นฉบับ | Samsung RB6000D User Manual (DEMO) |

กด "อัปโหลดและเริ่มร่าง" → ไปหน้าตรวจของร่างเอง เห็น "AI กำลังร่าง 0/1 ช่วงหน้า — หน้านี้อัปเดตเองทุก 3 วินาที" → รอจนเป็น **รอตรวจ** (หรือ **ร่างไม่สำเร็จ** พร้อมสาเหตุ เช่น ยังไม่ได้ตั้ง `AUTHORING_LLM_MODEL` → แก้ .env รีสตาร์ต แล้วอัปโหลดใหม่)

ลองกรณีผิดในฟอร์มด้วย: ไม่เลือกไฟล์ / หน้าสุดท้ายน้อยกว่าหน้าเริ่ม / เลือก 11 หน้า / รหัสมีตัวพิมพ์ใหญ่ → ต้องเตือนใต้ช่อง · ไฟล์ใหญ่ (เช่น `DC68-04382A-13.pdf` 16 MB) → "ไฟล์ PDF ใหญ่เกินไป" · อัปโหลดซ้ำรหัสเดิมหลังเผยแพร่แล้ว → "รหัสซ้ำกับข้อมูลที่ใช้งานอยู่"

### ขั้นที่ 6 — ตรวจร่าง (สิ่งที่คนต้องทำจริง)
1. ป้าย **"ร่างโดย AI · ยังไม่เผยแพร่"** อยู่ด้านบน
2. อ่าน **รายงานการตรวจ**: ข้อผิดพลาด (แดง) · **คำเตือนคำเสี่ยง** (แดง แยกกล่อง) · คำเตือนอื่น
3. ในแต่ละแผนผังขั้นตอน: ไล่ **เส้นทาง** (▶ จุดเริ่ม · ⚠ ด่านความปลอดภัย · "(เดินถึงไม่ได้)")
4. **เทียบทุกโหนดกับ "หน้าต้นฉบับ" ที่อยู่ข้างกัน**: ข้อความตรงคู่มือไหม แปลถูกไหม ขั้นตอนที่เกี่ยวกับไฟฟ้า/ความร้อนมีป้าย **"ต้องยืนยันความปลอดภัย"** และคำเตือนครบไหม
5. (ทางเลือก) แก้ใน "แก้แผนผังขั้นตอน (JSON)" แล้วกด **ตรวจใหม่** — ลองทำให้ผิดโดยตั้งใจ (เช่น เปลี่ยน `"on_yes"` เป็น `"n_ghost"`) → รายงานต้องขึ้นข้อผิดพลาด และปุ่มเผยแพร่ปิด → กด "คืนค่าเดิม" แล้ว "ตรวจใหม่" อีกครั้ง

### ขั้นที่ 7 — เผยแพร่
1. ก่อนติ๊ก ปุ่ม "เผยแพร่ให้ผู้ใช้เห็น" ต้อง **ปิด** พร้อมเหตุผลใต้ปุ่ม
2. ติ๊ก "ฉันตรวจข้อความทุกโหนด…" · ถ้ามีคำเตือน ติ๊ก "ฉันอ่านคำเตือนทั้ง N ข้อ…" (ส่ง `acknowledgedWarnings: true`)
3. กดเผยแพร่ → "เผยแพร่แล้ว" พร้อมรายการ graph_id และสถานะดัชนีค้นหา · ป้ายสถานะเป็น **เผยแพร่แล้ว** · ป้ายร่าง AI หายไป
4. (ตรวจว่า server เป็นด่านจริง) ด้วย PowerShell ลองเผยแพร่ร่างที่มีข้อผิดพลาดแม้ส่ง `acknowledgedWarnings: true` → ต้องได้ 409 `DRAFT_INVALID` (คำสั่งอยู่ใน `docs/authoring/authoring-b1-testing.md` หัวข้อ 4.6)

### ขั้นที่ 8 — ลองใช้แผนผังขั้นตอนใหม่ (ไม่ต้องรีสตาร์ต)
1. ออกจากระบบ (หรือเปิดหน้าต่างส่วนตัว) → "เลือกเครื่อง" → ตู้เย็น → ต้องเห็นรุ่น **DEMO RB6000D / RB6000D** และอาการจากร่าง
2. เริ่มตรวจอาการหนึ่งจนจบ — ขั้นที่มีป้ายความปลอดภัยต้องให้ติ๊กยืนยันก่อนไปต่อ (ด่านเดิมของ engine)
3. ถ้าเปิด `SYMPTOM_SEARCH_ENABLED=true`: พิมพ์อาการที่ตรงกับร่างในช่องค้นหา → ต้องเจอแผนผังขั้นตอนใหม่
4. หน้าเอกสารอ้างอิงในขั้นตอนต้องแสดง "Samsung RB6000D User Manual (DEMO)" และช่วงหน้าที่อ้าง

### ขั้นที่ 9 — ปฏิเสธ / ลองใหม่ (ไม่บังคับ)
อัปโหลดอีกร่าง (`demo_rb6000d_test2` หน้า 70–71) → "ปฏิเสธร่างนี้" → ใส่เหตุผล → ยืนยัน → สถานะ "ปฏิเสธแล้ว" และปุ่มตัดสินหายไป

### ขั้นที่ 10 — ลบข้อมูล demo (SQL · ไม่มี endpoint ลบ)
> ⚠️ `sessions.graph_id` มี FK แบบ **RESTRICT** — ถ้ามีการตรวจอาการด้วยแผนผัง demo (รวมขั้นที่ 8) ต้องลบ session เหล่านั้นก่อน ไม่งั้นลบแผนผังไม่ได้ การลบ session จะลบประวัติ/ความเห็นของ session นั้นไปด้วย (CASCADE)

รันในโปรแกรม MySQL ที่ต่อ Aiven ได้ (คอนโซล Aiven, MySQL Workbench, DBeaver):
```sql
-- ดูก่อน (ต้องมีแต่ของ demo)
SELECT manual_id FROM manuals WHERE manual_id LIKE 'demo\_%';
SELECT COUNT(*) FROM sessions WHERE graph_id LIKE 'demo\_%';

START TRANSACTION;
DELETE FROM sessions     WHERE graph_id  LIKE 'demo\_%';   -- session_history + session_feedback ตามไปด้วย (CASCADE)
DELETE FROM nodes        WHERE graph_id  LIKE 'demo\_%';
DELETE FROM graphs       WHERE manual_id LIKE 'demo\_%';
DELETE FROM manuals      WHERE manual_id LIKE 'demo\_%';
DELETE FROM graph_drafts WHERE manual_id LIKE 'demo\_%';   -- ไม่บังคับ (เก็บไว้เป็นหลักฐานได้)
SELECT (SELECT COUNT(*) FROM manuals) manuals, (SELECT COUNT(*) FROM graphs) graphs, (SELECT COUNT(*) FROM nodes) nodes;
-- ตัวเลขต้องกลับเท่ากับขั้นที่ 1 (22 / 644 / 4834) แล้วค่อย:
COMMIT;   -- ไม่ตรง → ROLLBACK;
```
แล้ว **รีสตาร์ต backend** (แผนผัง demo ยังค้างในหน่วยความจำจนกว่าจะรีสตาร์ต) · ตรวจว่าหน้า "เลือกเครื่อง" ไม่มีรุ่น DEMO แล้ว

---

## 7. ข้อจำกัดที่รู้

- **AI อาจร่างผิดแบบที่โค้ดจับไม่ได้** (แปลผิด ข้ามขั้นตอน ตีความคู่มือเกิน) — validator ตรวจได้แค่โครงสร้าง ลูกศร ด่านความปลอดภัยเชิงกฎ เลขหน้า และคำเสี่ยงแบบคำค้น ความถูกต้องของเนื้อหาขึ้นกับคนตรวจ
- **คำเตือนคำเสี่ยงเป็นการค้นคำ** (ปลั๊ก ไฟฟ้า แก๊ส ฯลฯ) อาจพลาดคำเสี่ยงที่เขียนแบบอื่น หรือเตือนเกินจริง
- **อาการที่ข้ามขอบ 2 หน้า** อาจถูกตัดหรือถูกข้าม (AI เห็นทีละ 2 หน้า)
- **PDF ภาพสแกนไม่รองรับ** (ไม่ทำ OCR) · คู่มือส่วนใหญ่ในโปรเจกต์ใหญ่เกิน 10 MB (ปรับ `AUTHORING_MAX_PDF_MB` ได้แต่กิน RAM)
- **คู่มือใหม่เท่านั้น** · **ไม่มี endpoint ลบ/ย้อนการเผยแพร่** (ใช้ SQL)
- **ร่างทีละ 1 งาน** ในโปรเซสเดียว · เซิร์ฟเวอร์ดับกลางงาน → ลองใหม่
- **แผนผัง demo ปนในระบบจริง** (รายการเครื่อง ค้นหา สถิติ admin) จนกว่าจะลบ
- **หน้าตรวจยาว** เมื่อมีหลายแผนผัง/หลายโหนด (ข้อความหน้าต้นฉบับซ้ำข้างทุกโหนดโดยตั้งใจ)
- **ตัวแก้เป็น JSON ล้วน** ไม่มีตัวแก้แบบฟอร์ม · ปุ่มเผยแพร่บนหน้าจอเป็น UX เท่านั้น (server คือด่านจริง)
- ข้อมูลเดิมไม่ตรง schema หนึ่งจุด: node_id 13 ตัวในผัง `samsung_rs5000fc` ไม่ขึ้นต้นด้วย `n` (กฎ `n…` บังคับเฉพาะร่างใหม่)
- `unpdf` ต้องการ Node ≥ 22 (ยังไม่ได้ตรวจเวอร์ชัน Node บน Render)

---

## 8. ทดสอบอะไรแล้ว / ยังไม่ได้ทดสอบ (ตรงไปตรงมา)

### ทดสอบแล้ว (อัตโนมัติ)
- **Backend** `npm run build` ผ่าน · `npx jest` 17 ชุด 381 เคสผ่าน — รายละเอียด `docs/authoring/authoring-b1-testing.md` หัวข้อ 8 (validator กับ 644 ผังจริง, unpdf ตัวจริง, HTTP ผ่าน pipeline จริง, round trip ผ่าน GraphRepository, ร่างแยกจากข้อมูลผู้ใช้, DI จริง, ชื่อคอลัมน์ตรงกับ Aiven)
- **Frontend** `tsc -b` + `eslint .` ผ่าน · `vitest` 26 ชุด 267 เคสผ่าน (เพิ่ม 68 เคสจาก Step 4) · `npm run build` ผ่าน
  - อัปโหลดส่ง `FormData` ครบทุกฟิลด์ ไม่ใส่ Content-Type เอง แนบ token · publish ส่ง `acknowledgedWarnings` ตามที่ติ๊ก · PUT/reject ถูกต้อง
  - หน้าตรวจ: ป้ายร่าง AI · ข้อความหน้าต้นฉบับข้างทุกโหนด · ป้ายด่านความปลอดภัย · เส้นทางแบบข้อความ · คำเตือนคำเสี่ยงแยกกล่อง · ปุ่มเผยแพร่ปิดเมื่อมีข้อผิดพลาด/ยังไม่ติ๊ก · ทุกสถานะ (กำลังร่าง ล้ม ปฏิเสธ เผยแพร่)
  - ฟอร์มอัปโหลดตรวจตรงกับ backend · ข้อความไทยของรหัส error ใหม่ครบ 13 รหัส · **ไม่มีคำว่า "กราฟ"** บนหน้าที่ทดสอบ
  - พิสูจน์ว่าเทสต์จับบั๊กได้: ทำให้ปุ่มเผยแพร่ไม่สนใจข้อผิดพลาด → เทสต์ล้ม 2 เคส (แล้วคืนไฟล์)

### ยังไม่ได้ทดสอบ
- **ไม่เคยเรียก Groq จริง** — คุณภาพร่าง ความเสถียรของ JSON และเวลาที่ใช้จริงยังไม่รู้เลย (ความเสี่ยงใหญ่สุด)
- **ยังไม่ได้รัน migration 012 และ SQL ของ `graph_drafts` กับ MySQL จริง** · ยังไม่ได้เผยแพร่จริงลงฐานข้อมูล
- **ยังไม่ได้เปิดหน้าใหม่ในเบราว์เซอร์จริง** — เทสต์หน้าจอเป็น `renderToString` (ไม่มี DOM/การคลิก/effect) จึงไม่ได้พิสูจน์: การเลือกไฟล์และอัปโหลดจริง การถามสถานะทุก 3 วินาที การติ๊กแล้วปุ่มเปิด การนำทางหลังอัปโหลด ตัวแก้ JSON การแสดงผลบนมือถือ
- เทสต์ backend ใช้ `unpdf` ที่ติดตั้งชั่วคราวนอกโปรเจกต์ — หลัง `npm install unpdf` ต้องรัน `npx jest` อีกครั้ง (ขั้นที่ 2)
- PDF ภาษาไทย/ไฟล์ใกล้เพดาน/หลายแท็บพร้อมกัน/RAM บน Render
