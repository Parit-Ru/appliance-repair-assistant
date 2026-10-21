# แผนที่ไฟล์ของโปรเจกต์ (FILE-MAP)

> ไฟล์ไหนอยู่ตรงไหน และทำอะไร — ทั้งโปรเจกต์ `appliance-repair-assistant`
> เขียนจากโครงสร้างจริง ณ 20 ต.ค. 2569 (หลัง simplify รอบ 2): `backend/src` 59 ไฟล์ / 6,751 บรรทัด · `frontend/src` 87 ไฟล์ / 6,553 บรรทัด
> แทนที่ `FILES-BACKEND.md` / `FILES-FRONTEND.md` เดิมที่เขียนก่อนงาน simplify (สองไฟล์นั้นยังอยู่ แต่อาจล้าสมัย)
> คำอธิบายเชิงลึกของ flow อยู่ใน `docs/STUDY_GUIDE.md` — ไฟล์นี้บอกแค่ "มีอะไร อยู่ไหน ทำอะไร"

## สารบัญ
1. [ภาพรวมโฟลเดอร์ระดับบนสุด](#1-ภาพรวมโฟลเดอร์ระดับบนสุด)
2. [Backend `backend/`](#2-backend)
3. [Frontend `frontend/`](#3-frontend)
4. [ข้อมูลและสคริปต์เตรียมข้อมูล `data/` `scripts/`](#4-ข้อมูลและสคริปต์เตรียมข้อมูล)
5. [เอกสาร `docs/`](#5-เอกสาร-docs)
6. [ไฟล์ที่ไม่ใช่ส่วนของระบบที่รัน](#6-ไฟล์ที่ไม่ใช่ส่วนของระบบที่รัน)

---

## 1. ภาพรวมโฟลเดอร์ระดับบนสุด

| ที่อยู่ | คืออะไร |
|---|---|
| `backend/` | API: NestJS 10 + TypeScript + `mysql2` (SQL ดิบ ไม่มี ORM) → deploy บน Render |
| `frontend/` | หน้าเว็บ: React 19 + Vite + Tailwind + TanStack Query → deploy บน GitHub Pages |
| `data/` | ข้อมูลต้นทาง: PDF คู่มือ → chunk → ผัง JSON, รายการอุปกรณ์, JSON Schema |
| `scripts/` | สคริปต์ Python รันครั้งคราว (offline) สำหรับเตรียม/ตรวจข้อมูลผัง |
| `docs/` | เอกสารทั้งหมด |
| `render.yaml` | ตั้งค่า deploy backend บน Render (แผน free, `rootDir: backend`, `healthCheckPath: /health`, ตั้ง `SYMPTOM_SEARCH_ENABLED` / `REPHRASE_ENABLED` เป็น true, ค่า DB/JWT/Groq ตั้งเป็น `sync: false` ใส่บนหน้า Render เอง) |
| `check/`, `draft/` (ถ้ามี) | ไม่ใช่ส่วนที่รัน — ดูหัวข้อ 6 |

---

## 2. Backend

### 2.1 ไฟล์ตั้งค่าที่ราก `backend/`

| ไฟล์ | ทำอะไร |
|---|---|
| `package.json` / `package-lock.json` | dependency และ script: `build` (nest build), `start:dev`, `start:prod`, `test` (jest), `migrate`, `seed`, `seed:equipment`, `seed:admin` |
| `tsconfig.json` / `tsconfig.build.json` | ตั้งค่า TypeScript (ตัวหลัง = ตอน build ไม่รวมเทสต์) |
| `nest-cli.json` | ตั้งค่า Nest CLI |
| `jest.config.js` | ตั้งค่า jest (ปัจจุบันไม่มีไฟล์เทสต์ในรีโป) |
| `.env.example` | ตัวอย่างชื่อตัวแปรสภาพแวดล้อมที่ต้องตั้ง (ค่าจริงอยู่ใน `.env` ซึ่งไม่เข้า git) |
| `.gitignore` | ไฟล์ที่ไม่เข้า git ของ backend |
| `model/Xenova/paraphrase-multilingual-MiniLM-L12-v2/` | ไฟล์โมเดล embedding (ONNX q8 + tokenizer + config) ที่ตัดคำศัพท์ให้เล็กแล้ว โหลดแบบออฟไลน์ตอนบูต |
| `backups/` | ไฟล์ SQL สำรองตารางผัง (สร้างโดย `backup-graph-tables.js`) — ข้อมูล ไม่ใช่โค้ด |
| `dist/` | ผล build — ไม่ต้องอ่าน/ไม่ต้อง commit |

### 2.2 `backend/migrations/` — schema ฐานข้อมูล (รันตามลำดับชื่อไฟล์ด้วย `npm run migrate`)

แบ่งตามเรื่อง ไม่มี ALTER (รวมจาก migration เดิม 001–012 เมื่อ 20 ต.ค. 2569 — ดู `MIGRATION-MAP.md`, รายละเอียดตาราง ดู `DATABASE.md`)

| ไฟล์ | สร้างตาราง |
|---|---|
| `001_users.sql` | `users` (บัญชี email/bcrypt/role) |
| `002_graphs.sql` | `manuals`, `graphs`, `nodes` (คู่มือ → อาการ → โหนด) |
| `003_equipment.sql` | `equipment`, `equipment_usage` |
| `004_sessions.sql` | `sessions`, `session_history` (เจ้าของ guest/user, confidence, outcome, model_selection) |
| `005_session_feedback.sql` | `session_feedback` (👍/👎 + ความเห็น) |
| `006_graph_drafts.sql` | `graph_drafts` (ร่างผังจาก PDF) |

### 2.3 `backend/scripts/` — สคริปต์ Node (รันมือ)

| ไฟล์ | ทำอะไร |
|---|---|
| `run-migrations.js` | รัน `.sql` ใน `migrations/` ตามลำดับ (`npm run migrate`) |
| `seed-graphs.js` | โหลดไฟล์ผัง `data/manuals/*.json` เข้าฐานข้อมูล (ตรวจก่อน insert) — คำสั่งตัวอย่างทั้งชุดอยู่ใน `data/runseed.txt` |
| `seed-equipment.js` | โหลด `data/equipment/equipment.json` เข้าตารางอุปกรณ์ |
| `seed-admin.js` | สร้างบัญชี admin คนแรก (ทางเดียวที่สร้าง admin ได้; รันซ้ำได้ปลอดภัย; อ่านอีเมล/รหัสจาก `.env`) |
| `reset-database.js` | ลบตารางของโปรเจกต์นี้ทั้งหมด + `schema_migrations` เพื่อเริ่ม migrate/seed ใหม่ (dry run เป็นค่าเริ่มต้น ต้องใส่ `--yes` ถึงจะลบ) |
| `backup-graph-tables.js` | สำรอง manuals/graphs/nodes/graph_drafts เป็นไฟล์ `.sql` (อ่านอย่างเดียว) ลง `backups/` |
| `try-rephrase.js` | ลองเรียก rephrase (Groq) ด้วยมือกับข้อความจากผังตัวอย่าง |
| `study-measure.js` | วัดพฤติกรรมโค้ดจริง (engine / guard / search) เพื่อประกอบ `STUDY_GUIDE.md` ไม่ต่อ DB |

### 2.4 `backend/src/` — โค้ดหลัก (59 ไฟล์)

**จุดเริ่ม**

| ไฟล์ | ทำอะไร |
|---|---|
| `main.ts` | เปิดแอป: dotenv, CORS (`CORS_ORIGIN`), listen `PORT` |
| `app.module.ts` | ประกอบทุกโมดูล + ลงทะเบียน `AllExceptionsFilter` ด้วย `APP_FILTER` + `HealthController` |

**`common/`**

| ไฟล์ | ทำอะไร |
|---|---|
| `api-error.ts` | `ApiError(status, code, message)` — error ที่รู้รหัส HTTP ในตัว |
| `all-exceptions.filter.ts` | filter ตัวเดียวของทั้งแอป แปลงทุก error เป็น `{statusCode, code, message}` (รวมตาราง `ENGINE_ERRORS` ของ engine) |
| `helpers.ts` | ฟังก์ชันเล็กที่หลายโมดูลใช้ร่วม: `isPlainObject`, `round3`, `numOrNull`, `isoFromEpoch`, `UUID_PATTERN` |

**`database/`, `health/`**

| ไฟล์ | ทำอะไร |
|---|---|
| `database/database.module.ts` | `@Global` สร้าง connection pool mysql2 (รองรับ SSL CA) ให้ฉีดผ่าน token `MYSQL_POOL` |
| `database/database.constants.ts` | ค่าคงที่ token `MYSQL_POOL` |
| `health/health.controller.ts` | `GET /health` ยิง `SELECT 1` (Render ใช้เป็น health check) |

**`traversal-engine/` — เครื่องสถานะของผัง (ไม่รู้จัก HTTP/DB)**

| ไฟล์ | ทำอะไร |
|---|---|
| `types.ts` | ชนิดผัง/โหนด/session/action + คลาส error ของ engine 4 ชนิด |
| `traversal-engine.ts` | ฟังก์ชันล้วน `startSession`, `getCurrentNode`, `submitAction`, `getOutcomeKind` — ตัดสินขั้นถัดไปและด่าน `safety_critical` |

**`traversal/` — API เดินผัง**

| ไฟล์ | ทำอะไร |
|---|---|
| `traversal.controller.ts` | endpoint: graphs, manuals, สร้าง/ดู/ลบ session, actions, outcome |
| `traversal.service.ts` | หาผัง/session → เรียก engine → บันทึก → (ถ้าเปิด) rephrase |
| `traversal.dto.ts` | ตรวจ input (`parseStartSessionBody`, `parseTraversalAction`, `parseOutcomeBody`, client id) + ชนิด response |
| `traversal.module.ts` | ประกอบ provider (รวม `RephraseService` ด้วย useFactory) |
| `graph.repository.ts` | โหลดผังทั้งหมดจาก MySQL เข้าหน่วยความจำตอนบูต + `reload()` หลัง publish |
| `graph.module.ts` | export `GraphRepository` ให้โมดูลอื่นใช้ร่วม |
| `session.store.ts` | SQL ของ `sessions` / `session_history` (หมดอายุ 24 ชม.; จบแล้ว 90 วัน) |
| `equipment.repository.ts` | อ่านรายการอุปกรณ์ที่ต้องใช้ตามหมวดเครื่อง เก็บใน Map |

**`symptom-search/` + `embedding/` — ค้นอาการ**

| ไฟล์ | ทำอะไร |
|---|---|
| `embedding/embedding.service.ts` | โหลดโมเดลจาก `model` (ห้ามดาวน์โหลดจากเน็ต) แปลงข้อความ → เวกเตอร์ 384 มิติ |
| `symptom-search/symptom-matcher.ts` | คณิตศาสตร์ล้วน: `cosineSimilarity`, `buildSymptomTexts`, `rankGraphs`, `selectMatches` |
| `symptom-search/symptom-search.service.ts` | สร้างดัชนีเวกเตอร์ตอนบูต (เมื่อ `SYMPTOM_SEARCH_ENABLED=true`), `search`, `scoreGraph`, `addGraphs`, `getStatus` (เกณฑ์ 0.55, top 3) |
| `symptom-search/symptom-search.controller.ts` | `POST /symptom-search`, `GET /symptom-search/status` |
| `symptom-search/symptom-search.dto.ts` | `parseSearchBody` + ชนิด response/status |
| `symptom-search/symptom-search.module.ts` | ประกอบ provider (รวม `EmbeddingService`) |

**`rephrase/` — เรียบเรียงข้อความ (LLM ควบคุมด้วยโค้ด)**

| ไฟล์ | ทำอะไร |
|---|---|
| `rephrase.service.ts` | เรียก LLM ภายใน timeout; ข้ามโหนด safety/จบ; แคชในหน่วยความจำ; ผิดพลาด → ข้อความต้นฉบับ |
| `rephrase-guard.ts` | ด่านตรวจผลลัพธ์: ลิงก์/markdown/ความยาว/ตัวเลข/คำอังกฤษ/จำนวนคำ "ไม่" |
| `groq-llm.client.ts` | เรียก Groq API (system prompt ห้ามเปลี่ยนความหมาย); เปิดเมื่อมี key+model |

**`auth/` — บัญชี guest สิทธิ์**

| ไฟล์ | ทำอะไร |
|---|---|
| `auth.controller.ts` | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| `auth.service.ts` | สมัคร (role=user เสมอ) / login (bcrypt + hash หลอก) / ออก JWT |
| `auth.dto.ts` | ตรวจ input สมัคร/login + ชนิด `UserDto`, `AuthResponseDto` |
| `auth.module.ts` | ตั้ง `JwtModule` (ตรวจ `JWT_SECRET`) และ provider |
| `users.store.ts` | SQL ตาราง `users` (+ `DuplicateEmailError`) |
| `jwt-auth.guard.ts` | บังคับล็อกอิน (401), ตรวจ HS256 เอง ไม่ใช้ passport |
| `optional-jwt-auth.guard.ts` | ไม่มี token = guest · token เสีย = 401 |
| `admin.guard.ts` / `role.enum.ts` | ด่านต้องเป็น admin (403) · ไม่ import NestJS · แทน `roles.guard.ts` + `roles.decorator.ts` เดิม |
| `session-owner.ts` | จุดเดียวที่ตัดสินเจ้าของ session (user / guest) + สร้างเงื่อนไข SQL |

**`history/` — ประวัติการซ่อม + feedback**

| ไฟล์ | ทำอะไร |
|---|---|
| `history.controller.ts` | `GET /history`, `GET /history/:id`, `POST /history/:id/feedback`, `DELETE /history/:id` |
| `history.service.ts` | ประกอบรายละเอียดด้วย engine (replay ตรวจว่าผังยังไปจบโหนดเดิม) ไม่เรียก LLM |
| `history.store.ts` | SQL ของ session ที่จบแล้ว + `session_feedback` |
| `history.dto.ts` | `parseHistoryQuery` (page, pageSize), `parseFeedbackBody` + ชนิด response |
| `history.module.ts` | ประกอบ provider |

**`admin/` — สถิติ (อ่านอย่างเดียว)**

| ไฟล์ | ทำอะไร |
|---|---|
| `admin.controller.ts` | `GET /admin/feedback`, `GET /admin/analytics/summary` (admin เท่านั้น) |
| `admin.service.ts` | ประกอบตัวเลข (ตัวหาร 0 → null) |
| `admin.store.ts` | SELECT ล้วน ไม่แตะตาราง `users` |
| `admin.dto.ts` | ตรวจ query + ชนิด response |
| `admin.module.ts` | ประกอบ provider |

**`authoring/` — PDF → ร่างผัง → ตรวจ → เผยแพร่**

| ไฟล์ | ทำอะไร |
|---|---|
| `drafts.controller.ts` | `POST /admin/drafts` (multipart), list/get/put, reject, publish + `UploadErrorsFilter` ของ multer |
| `drafts.service.ts` | คุมกระบวนการ: ตรวจไฟล์ → ทีละ 1 งาน → แยกข้อความ → LLM ทีละ 2 หน้า → parse → validate → เก็บร่าง; publish + reload + เพิ่มดัชนีค้นหา |
| `drafts.store.ts` | SQL ของ `graph_drafts` + publish ใน transaction เดียว (`FOR UPDATE`, id ชน = ปฏิเสธ) |
| `drafts.dto.ts` | ตรวจฟอร์มอัปโหลด/PUT/publish/reject + ชนิด response |
| `drafts.errors.ts` | ฟังก์ชันสร้าง `ApiError` ของโมดูล (`draftBusy`, `draftInvalid` ฯลฯ) |
| `pdf-text.ts` | ดึงข้อความ PDF ด้วย `unpdf` ในหน่วยความจำ (≤200 หน้า, เลือก ≤10 หน้า) |
| `draft-llm.client.ts` | เรียก Groq ให้ร่างผัง (prompt v1) |
| `draft-schema.ts` | parse คำตอบ LLM แบบไม่เชื่อ JSON mode; ตั้ง `graph_id` เอง |
| `graph-validator.ts` | ผู้ตัดสินว่าผังผ่านไหม (พอร์ตจาก `validate_graph.py`; error = กัน publish, warning = ต้องรับทราบ) |
| `draft-manual.ts` | แปลงร่างเป็นแถว manuals/graphs/nodes พร้อม INSERT |
| `authoring.module.ts` | ประกอบ provider |

---

## 3. Frontend

### 3.1 ไฟล์ตั้งค่าที่ราก `frontend/`

| ไฟล์ | ทำอะไร |
|---|---|
| `package.json` / `package-lock.json` | dependency และ script: `dev`, `build` (tsc -b + vite), `preview`, `test` (vitest), `deploy` (build + gh-pages) |
| `index.html` | หน้า HTML หลักของ Vite |
| `vite.config.ts` | ตั้งค่า Vite |
| `tailwind.config.js` / `postcss.config.js` | Tailwind และ PostCSS (กำหนดสี/โทเคนของธีม) |
| `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` | TypeScript (แอปเปิด `noUnusedLocals/Parameters`) |
| `eslint.config.js` | ตั้งค่า eslint (รวมกฎ react-hooks) |
| `.env.development` / `.env.production` | ตัวแปรของ Vite (เช่น URL ของ backend) แยกตามโหมด |
| `.gitignore`, `dist/` | ไฟล์ที่ไม่เข้า git / ผล build |

### 3.2 `frontend/src/` (87 ไฟล์)

**จุดเริ่ม:** `main.tsx` (mount แอป) · `App.tsx` (ตาราง route + Provider: QueryClient, Router, AuthProvider) · `env.d.ts` (ชนิดของตัวแปร env)

**`pages/` — 1 ไฟล์ = 1 route**

| ไฟล์ | route | ทำอะไร |
|---|---|---|
| `HomePage.tsx` | `/` | หน้าแรก + รายการรุ่นที่รองรับ |
| `DevicesPage.tsx` | `/devices` | เลือกประเภทเครื่อง → รุ่น (หรือ "ไม่ทราบรุ่น") |
| `SymptomsPage.tsx` | `/symptoms` | พิมพ์ค้นอาการ แสดงผัง ≤3 ให้เลือก |
| `AllSymptomsPage.tsx` | `/symptoms/all` | รายการอาการทั้งหมดของรุ่น (ทางสำรองถ้าค้นไม่ได้) |
| `SessionPage.tsx` | `/session/:id` | เดินผังทีละขั้น (action, ฟอร์มผลลัพธ์, rephrase, ยกเลิก) |
| `HistoryPage.tsx` | `/history` | รายการประวัติการซ่อม แบ่งหน้า |
| `HistoryDetailPage.tsx` | `/history/:id` | รายละเอียดย้อนหลัง + feedback + ลบ |
| `LoginPage.tsx` / `RegisterPage.tsx` | `/login`, `/register` | เข้าสู่ระบบ / สมัครสมาชิก |
| `AdminAnalyticsPage.tsx` | `/admin/analytics` | สถิติภาพรวม |
| `AdminFeedbackPage.tsx` | `/admin/feedback` | ความเห็นผู้ใช้ (ตัวกรอง/แบ่งหน้า) |
| `AdminDraftsPage.tsx` | `/admin/drafts` | อัปโหลด PDF + รายการร่าง |
| `AdminDraftReviewPage.tsx` | `/admin/drafts/:id` | ตรวจร่าง/แก้/ปฏิเสธ/เผยแพร่ |
| `ForbiddenPage.tsx` / `NotFoundPage.tsx` | — | ไม่มีสิทธิ์ / ไม่พบหน้า |

**`api/` — เรียก backend**

| ไฟล์ | ทำอะไร |
|---|---|
| `http.ts` | `fetch` กลาง: ใส่ `Authorization` / `X-Client-Id`, แปลง error response เป็น `ApiError`, ตัวจัดการ 401 |
| `queries.ts` | hook ของ TanStack Query ทั้งหมด (อ่าน/เปลี่ยนข้อมูล, key มี identity, แคช session) |
| `traversal.ts` | เรียก health, graphs, manuals, symptom-search, sessions, actions, outcome |
| `history.ts` | เรียก list/detail/ลบ/feedback ของประวัติ |
| `auth.ts` | login / register / me |
| `admin.ts` | feedback และสถิติของ admin |
| `drafts.ts` | อัปโหลด/อ่าน/แก้/ปฏิเสธ/เผยแพร่ร่างผัง |
| `types.ts` | ชนิดข้อมูลของ response ทั้งหมด |

**`lib/` — ตัวช่วยล้วน**

| ไฟล์ | ทำอะไร |
|---|---|
| `errors.ts` | `describeError`: เลือกข้อความไทย + วิธีกู้ จาก `code` (ตาราง `MESSAGES`) |
| `authStorage.ts` / `authContext.ts` / `authForm.ts` / `authRedirect.ts` | เก็บ token / context สถานะล็อกอิน / ตรวจฟอร์ม / ลิงก์เด้งไป login พร้อม `next` |
| `clientId.ts` / `clientHeaders.ts` | UUID ของ guest / หัวข้อบอกเจ้าของคำขอ |
| `modelSelection.ts` / `models.ts` | รุ่นที่เลือก (เก็บใน URL) / ชื่อและการจับคู่รุ่น |
| `symptoms.ts` | จัดกลุ่ม/ตั้งชื่ออาการสำหรับแสดงผล |
| `useStartSymptom.ts` / `useSlowWait.ts` | hook เริ่ม session จากอาการ / แจ้งเมื่อเซิร์ฟเวอร์ตอบช้า |
| `textInput.ts` / `outcome.ts` | ตรวจข้อความค้นหา+feedback / ข้อความผลลัพธ์ |
| `trail.ts` | รอยทางขั้นที่เดินมา (PathRail) |
| `labels.ts` | ป้ายภาษาไทยของประเภทเครื่อง/ผลลัพธ์/ขั้น |
| `historyView.ts` / `adminView.ts` / `draftView.ts` / `adminParams.ts` | ตัวช่วยแสดงผลหน้าประวัติ / admin / ร่างผัง / พารามิเตอร์ใน URL ของ admin |

**`components/` — ชิ้นส่วน UI**

| ไฟล์ | ทำอะไร |
|---|---|
| `layout/AppShell.tsx`, `layout/ServerStatus.tsx` | โครงทุกหน้า + แถบนำทาง / สถานะเซิร์ฟเวอร์ |
| `ui/Button.tsx`, `ui/Icon.tsx`, `ui/Notice.tsx` | ปุ่ม / ไอคอน (วาดเอง) / กล่องแจ้งเตือน |
| `ErrorNotice.tsx` | กล่อง error ตัวเดียวของแอป (ปุ่ม/ลิงก์ตาม `recovery`, รับ `children`) |
| `LoadingText.tsx` | "กำลังโหลด…" + ไอคอนหมุน |
| `SlowServerNotice.tsx` | แจ้งว่าเซิร์ฟเวอร์เพิ่งตื่น |
| `SymptomSearchForm.tsx`, `SymptomSearchResults.tsx`, `SymptomRow.tsx` | ฟอร์มค้น / ผลค้น / แถวอาการ |
| `SessionHeader.tsx`, `EquipmentPanel.tsx`, `RephraseNote.tsx` | หัวหน้าตรวจ (ชื่อรุ่น, confidence, ยกเลิก) / อุปกรณ์ที่ต้องใช้ / ปุ่มดูข้อความต้นฉบับ |
| `OutcomeForm.tsx`, `TerminalActions.tsx` | ฟอร์มผลลัพธ์ / ปุ่มหลังจบ |
| `step/StepView.tsx` (+ `StepCard`, `InputStep`, `SafetyGateStep`, `OutcomeStep`, `PathRail`, `ReferenceLine`) | แสดงโหนดตามชนิด: checkpoint/instruction/ด่าน safety/input/จบ, แถบเส้นทาง, "อ้างอิงหน้าคู่มือ" |
| `history/` (`HistoryRow`, `Pagination`, `FeedbackButtons`, `DeleteConfirm`) | แถวประวัติ / แบ่งหน้า / 👍👎 / ยืนยันลบ |
| `auth/` (`AuthProvider`, `AdminRoute`, `TextField`) | เก็บสถานะล็อกอิน / ครอบหน้า admin / ช่องกรอกฟอร์ม login |
| `admin/` (`AdminTabs`, `StatCard`, `BarList`, `DailyBars`) | แท็บ admin / การ์ดตัวเลข / กราฟแท่ง |
| `admin/drafts/` (`UploadDraftForm`, `DraftStatusBadge`, `ValidationReportPanel`, `DraftGraphCard`, `DraftJsonEditor`, `DraftActions`) | ฟอร์มอัปโหลด / ป้ายสถานะ / รายงาน validator / การ์ดผัง / แก้ JSON / ปฏิเสธ-เผยแพร่ |

---

## 4. ข้อมูลและสคริปต์เตรียมข้อมูล

### 4.1 `data/`

| ที่อยู่ | คืออะไร |
|---|---|
| `data/pdf/` | PDF คู่มือต้นฉบับ (ขนาดใหญ่) |
| `data/chuck/` | ไฟล์ JSON chunk ของคู่มือ (ชื่อโฟลเดอร์สะกด `chuck` — ไม่แก้เพราะสคริปต์อ้างชื่อนี้) |
| `data/manuals/` | ผังขั้นตอนต่อคู่มือ (JSON Schema `troubleshooting-graph.v2`) (21 ไฟล์ รวม 631 ผัง) — ต้นทางที่ `seed-graphs.js` โหลดเข้า DB |
| `data/equipment/equipment.json` | รายการอุปกรณ์ที่ต้องใช้ตามหมวดเครื่อง |
| `data/schemas/troubleshooting-graph.v2.schema.json` | JSON Schema ของผัง v2 |
| `data/runseed.txt` | รายการคำสั่ง `node scripts/seed-graphs.js …` ครบทุกคู่มือ ไว้คัดลอกไปรัน |
| `data/check/` | หน้า HTML ตรวจ chunk/คู่มือด้วยตา (เครื่องมือช่วยตอนพัฒนา) |

### 4.2 `scripts/` (Python, รันนอกระบบ)

| ไฟล์ | ทำอะไร |
|---|---|
| `convert_chunks_to_graphs.py` | แปลง chunk → ผัง schema v2 แบบ deterministic (ได้ "ร่าง" ที่ต้องตรวจ) |
| `validate_graph.py` | ตรวจผังด้วย JSON Schema + กฎธุรกิจ (ต้นแบบของ `graph-validator.ts`) |
| `simulate_paths.py` | เดินทุกเส้นทางของผัง รายงานความยาว/ทางออก/ความครอบคลุมด่าน safety |
| `check_chunk_pdf.py` | เทียบ chunk กับ PDF แล้วสร้างหน้า HTML ให้ตรวจ (PASS/WARN/FAIL) |
| `inspect_vocab.py` | สำรวจตารางคำศัพท์ของโมเดล embedding (ขั้นเตรียมตัดโมเดล) |
| `slim_model.py` | ตัดคำศัพท์โมเดลให้เล็ก ได้ `backend/model/` |
| `__pycache__/`, `old/` | ไฟล์แคชของ Python / สคริปต์เก่า (ไม่ใช่ส่วนที่ใช้งาน) |

---

## 5. เอกสาร `docs/`

| ไฟล์ / โฟลเดอร์ | เนื้อหา |
|---|---|
| `README.md` | ดัชนีเอกสาร |
| `STUDY_GUIDE.md` | คู่มือเตรียมสอบ: โครงสร้าง flow แนวคิด error ตัวเลข คำถามกรรมการ (อ้าง `path:line`) |
| `SIMPLIFY_REPORT.md`, `SIMPLIFY_REPORT_2.md` | รายงานงานลดความซับซ้อนรอบ 1 และรอบ 2 |
| `reference/FILE-MAP.md` | ไฟล์นี้ |
| `reference/FILES-BACKEND.md`, `FILES-FRONTEND.md` | แผนไฟล์ฉบับเก่า (ก่อน simplify) |
| `auth/auth-step1…4.md` | บันทึกการทำระบบบัญชี/guest/สิทธิ์ ทีละขั้น |
| `authoring/` | แผนและบันทึกระบบร่างผังจาก PDF (Step 5) |
| `features/` | บันทึกฟีเจอร์: LLM, เลือกรุ่นก่อนค้น, หน้าประวัติ, frontend phase 3 |
| `ops/` | DEPLOY และขั้นตอนตรวจ chunk/ผังเทียบ PDF |
| `study/` | เอกสารอ่านโค้ด: roadmap, flow PDF→publish, อธิบาย admin authoring |
| `archive/` | เอกสารเก่า (handoff, roadmap, cleanup log) |

---

## 6. ไฟล์ที่ไม่ใช่ส่วนของระบบที่รัน

- `draft/` — แผนและงานร่างเดิม ไม่ถูก import จาก backend/frontend
- `check/` (ถ้ามี) — หน้า HTML ตรวจข้อมูลเก่า
- `scripts/old/` — สคริปต์ตรวจเก่า (`verify_*`, `visualize_*`)
- `backend/backups/`, `backend/dist/`, `frontend/dist/`, `node_modules/` — ข้อมูลสำรอง/ผล build/dependency

เจ้าของโปรเจกต์จะย้าย `draft/`, `check/`, `scripts/old/` ออกจาก repo เอง
