# AUDIT_REPORT — appliance-repair-assistant

> ตรวจแบบอ่านอย่างเดียว (ไม่แก้ source) · วันที่ตรวจ 30 ต.ค. 2026
> โค้ดที่ตรวจ = working tree ปัจจุบันบน branch **`express-migration`** (commit `129f256` + ไฟล์ที่แก้ค้างไว้ยังไม่ commit ~90 ไฟล์ และ `frontend/src/lib/outcome.ts` ถูกลบ)
> หมายเหตุ: branch `main` ยังเป็น NestJS + migration ชุดเก่า 001–012 — รายงานนี้ **ไม่ได้** ตรวจ `main`

---

## 1. สรุปภาพรวม

### 1.1 สิ่งที่ต้องรู้ก่อน: โจทย์ตรวจกับโค้ดจริงไม่ตรงกันบางจุด

| ที่โจทย์ตรวจระบุ | ที่โค้ดจริงเป็น |
|---|---|
| Backend เป็น NestJS, มี `app.module.ts` | branch นี้เป็น **Express 4** ประกอบโมดูลด้วยมือใน `backend/src/app.ts` ไม่มี `app.module.ts` / ValidationPipe / DTO class (ตรวจ input ด้วยฟังก์ชัน `parse*Body` เอง) |
| Chat แบบ RAG: ค้น chunk → LLM เขียนคำตอบ (Problem/Cause/Confidence/Solution/Safety/References) | **ไม่มี LLM เขียนคำตอบให้ผู้ใช้** ระบบเป็น "ค้นอาการด้วย embedding → เดินผังขั้นตอน (state machine) ที่เขียนไว้ล่วงหน้า" คำตอบทุกคำมาจากตาราง `nodes` LLM ใช้แค่ (ก) เรียบเรียงถ้อยคำ (rephrase) มีด่านตรวจ และ (ข) ช่วย admin ร่างผังจาก PDF ก่อนคนตรวจ |
| Embeddings ของ chunk คู่มือในฐานข้อมูล | ไม่มีตาราง embedding — embed เฉพาะ "ชื่ออาการ + คำพ้อง" ของแต่ละผังตอนบูตเก็บในหน่วยความจำ (`SymptomSearchService.index`) |
| ตาราง chat / messages | ไม่มี — "ประวัติ" คือ `sessions` + `session_history` (ทุกคำตอบใช่/ไม่ใช่) |

ดังนั้นหัวข้อ C (RAG) ในรายงานนี้ตีความเป็น "การค้นอาการ + ความน่าเชื่อถือของคะแนน + การอ้างอิงคู่มือ + ความปลอดภัย" ของระบบที่มีจริง

### 1.2 แผนที่โปรเจกต์

**Backend (`backend/src`) — ประกอบใน `app.ts:51-101`, ลงทะเบียนครบทุกโมดูล**

| path | โมดูล | ด่านสิทธิ์ |
|---|---|---|
| `/health` | health | สาธารณะ |
| `/auth/register`, `/auth/login`, `/auth/me` | auth (bcryptjs + JWT HS256) | `/me` = requireAuth |
| `/symptom-search` (POST), `/symptom-search/status` | symptom-search (embedding MiniLM multilingual q8, cosine ในหน่วยความจำ) | สาธารณะ |
| `/traversal/graphs`, `/manuals`, `/sessions*` | traversal + traversal-engine | optionalAuth (guest ใช้ได้) |
| `/history`, `/history/:id`, `/:id/feedback`, DELETE | history | optionalAuth + บังคับ owner (user_id หรือ X-Client-Id) |
| `/admin/feedback`, `/admin/analytics/summary` | admin | requireAuth + requireAdmin (อ่าน role จาก DB ทุกครั้ง) |
| `/admin/drafts*` | authoring (PDF → LLM → validator → publish) | เหมือน admin (mount ใต้ `adminArea`) |

**Frontend (`frontend/src`) — React 19 + React Router 7 + TanStack Query 5, deploy GitHub Pages**

- หน้า: `/` `/devices` `/symptoms` `/symptoms/all` `/session/:id` `/history` `/history/:id` `/login` `/register` `/admin/analytics` `/admin/feedback` `/admin/drafts` `/admin/drafts/:id` (`App.tsx:36-51`)
- API hooks ทั้งหมดอยู่ใน `api/queries.ts` · fetch wrapper `api/http.ts` · token ใน `localStorage` (`lib/authStorage.ts`) · guest id ใน `localStorage` (`lib/clientId.ts`)

**Migrations (`backend/migrations`)** — `001_users` `002_graphs` `003_equipment` `004_sessions` `005_session_feedback` `006_graph_drafts` · เรียงต่อเนื่อง ไม่มีเลขซ้ำ/ขาด · ทุกตาราง `utf8mb4_unicode_ci` · แต่**เป็นชุดที่รวบใหม่** ต่างจาก `main` (001–012) ดู H-2

**Flow หลัก**

1. Login: `POST /auth/login` → bcrypt compare (มี dummy hash กัน timing) → JWT `{sub, role}` 7 วัน → frontend เก็บ localStorage → ตอนเปิดแอปเรียก `/auth/me` ยืนยัน · 401 → ล้าง token แล้วเด้งไปหน้า login
2. ค้นอาการ: เลือกรุ่น (`manualId`) → `POST /symptom-search {query, manualId}` → กรองดัชนีตาม manualId **ก่อน** cosine → ตัดที่ 0.55 เอา 3 อันดับ → 0 รายการ = "ไม่พบ ระบบไม่เดา"
3. เดินผัง: `POST /traversal/sessions {graphId, query}` → คำนวณ confidence = cosine(query, ข้อความอาการของผังนั้น) → engine คืนโหนดแรก → `POST /sessions/:id/actions` ทีละขั้น (UPDATE sessions + INSERT session_history ใน transaction) → ถึง resolution/escalation = completed (เก็บ 90 วัน)
4. ประวัติ: `GET /history` (owner = user_id หรือ client_id) → `GET /history/:id` เดินซ้ำ (replay) ทุกขั้นบนผังปัจจุบัน ถ้าไม่ถึงโหนดเดิม = `available:false`
5. Feedback: `POST /history/:id/feedback` → `INSERT ... ON DUPLICATE KEY UPDATE` (1 แถวต่อ session แก้ทับได้)
6. Dashboard: `GET /admin/analytics/summary?days=` → aggregate SQL บน `sessions`/`session_feedback` + จับ outcome_kind จากผังในหน่วยความจำ
7. Admin ร่างผัง: อัปโหลด PDF (multer memory, ≤10MB, ≤10 หน้า) → unpdf ดึงข้อความ → status `drafting` → LLM (Groq, JSON mode) ทีละ 2 หน้า → parse + validator → `ready` → admin แก้ JSON/ตรวจ → publish (transaction, ห้ามทับของเดิม) → `GraphRepository.reload()` → `SymptomSearchService.addGraphs()`

**ใครทำอะไรได้**

| | guest | user | admin |
|---|---|---|---|
| ค้นอาการ/เดินผัง | ✅ | ✅ | ✅ |
| ประวัติของตัวเอง | ✅ (ผูก X-Client-Id ในเบราว์เซอร์) | ✅ (ผูก user_id) | ✅ |
| ให้ feedback / ลบประวัติ | ✅ (ของ client_id ตัวเอง) | ✅ | ✅ |
| `/admin/*` | ❌ 401 | ❌ 403 | ✅ |

### 1.3 สุขภาพโดยรวม

โค้ดอยู่ในสภาพดีกว่าโปรเจกต์จบทั่วไป: SQL ทุกคำสั่ง parameterized, transaction ครบ, ตรวจ owner ใน SQL (ไม่ find-แล้ว-check), validator ของผังเข้ม, ด่านความปลอดภัยบังคับที่ engine ไม่ใช่แค่ UI, ค้นหาไม่เดาเมื่อคะแนนต่ำ
จุดที่กรรมการน่าจะจับได้มากที่สุดคือ **"การอ้างอิง (citation)"**: ระบบแสดงว่าทุกขั้นมาจาก "คู่มือ หน้า X–Y" แต่ 27% ของโหนดเป็นข้อความที่ผู้พัฒนาเขียนเพิ่มเอง และข้อมูลนั้นไม่ถูกแสดง (C-1) รองลงมาคือ error 500 ส่งข้อความภายใน (รวม SQL) ออกไปให้ client, ประวัติแสดงได้แค่ 50 รายการ และความเสี่ยงตอน deploy เพราะ migration ถูกเปลี่ยนเลขไฟล์

---

## 2. ผลการรันคำสั่งตรวจ

รันบน Windows (Git Bash) · ไม่ได้เชื่อมต่อฐานข้อมูลจริง

| คำสั่ง | ผล |
|---|---|
| `backend: npx tsc --noEmit -p tsconfig.json` | ✅ ผ่าน ไม่มี error |
| `backend: npx jest` | ✅ 1 suite / 10 tests ผ่าน (`src/admin/admin-guard.spec.ts` — ไฟล์นี้ยังไม่ถูก track ใน git) ใช้เวลา 51 วินาที · **มีเทสต์แค่ด่านสิทธิ์ admin** ไม่มีเทสต์ของ traversal-engine, symptom-matcher, rephrase-guard, graph-validator, history replay |
| `frontend: npx tsc -p tsconfig.app.json --noEmit` | ✅ ผ่าน |
| `frontend: npx eslint .` | ❌ **1 error**: `src/lib/clientId.ts:31:11 Empty block statement (no-empty)` (catch ว่างตอน `localStorage.setItem`) |
| `frontend: npx vite build --outDir <scratchpad>` | ✅ build ผ่าน (JS 435 KB / gzip 124 KB) · หมายเหตุ: plugin `spaFallback404` ใน `vite.config.ts:14-17` เขียน `404.html` ลง `frontend/dist` แบบ hard-code ไม่สนใจ `--outDir` จึงคัดลอก `frontend/dist/index.html` เดิมทับ `frontend/dist/404.html` (ไฟล์ build ที่ gitignore ไว้ ไม่ใช่ source) |
| `frontend: npm test` (vitest) | ไม่ได้รัน — ไม่พบไฟล์ `*.test.*` ใน `frontend/src` (ดู L-11) |
| backend lint | ไม่มี config/สคริปต์ lint ใน `backend/package.json` |

---

## 3. รายการปัญหา

### 🔴 Critical

#### C-1 การอ้างอิงคู่มือบอกเกินจริง: ขั้นที่ผู้พัฒนาเขียนเองถูกแสดงว่า "มาจากคู่มือ หน้า X–Y"
- **ไฟล์และบรรทัด**
  - `backend/src/traversal/graph.repository.ts:132-139` (SELECT nodes ไม่มี `author_note`) และ `buildNode` บรรทัด 217-278 ไม่มีฟิลด์นี้
  - `backend/src/traversal-engine/traversal-engine.ts:131-134` — `reference` = `graph.source` + `graph.page_range` (ระดับผัง ไม่ใช่ระดับโหนด)
  - `frontend/src/components/step/ReferenceLine.tsx:15-18` — ข้อความ "ที่มาของขั้นตอนนี้: คู่มือ … หน้า …"
  - `backend/src/authoring/draft-manual.ts:117` (`author_note: null`) และ `NODE_COLUMNS` (บรรทัด 55-58) ไม่มี `source_page` → ผังที่ร่างจาก PDF ทิ้งเลขหน้ารายโหนดตอน publish
- **ปัญหา** จากข้อมูล seed `data/manuals/*.json`: 4,739 โหนด มี `author_note` 1,264 โหนด (≈27%) เช่น `samsung_ge83mdt_um_not_start/n2f` note = "หน้า 37 ไม่ได้ระบุข้อนี้ ผู้พัฒนาเพิ่มจากหน้า 27…" และอีก 36 โหนด note = "คู่มือเล่มนี้ไม่มีหัวข้อความปลอดภัยเรื่อง…" (คำเตือนความปลอดภัยที่ผู้พัฒนาเขียนเอง) แต่ backend ไม่โหลด `author_note` และหน้าจอแสดงบรรทัดอ้างอิงเดียวกันกับทุกโหนด
- **ทำไมผิด / สถานการณ์** ผู้ใช้เห็นขั้น "ปลดล็อกเตาโดยกด Stop + Clock" พร้อม "ที่มา: คู่มือ … หน้า 37" ทั้งที่หน้า 37 ไม่มีข้อนี้ — กรรมการที่เปิดคู่มือเทียบจะพบทันทีว่าการอ้างอิงไม่ตรง ซึ่งขัดกับข้อเสนอหลักของโปรเจกต์ (ตอบตามคู่มือ อ้างอิงได้) นอกจากนี้ผังที่ร่างผ่าน LLM มี `source_page` รายโหนดที่ validator ตรวจแล้ว แต่ถูกทิ้งตอน INSERT จึงเหลือแค่ช่วงหน้ากว้างๆ
- **แนวทางแก้** โหลด `author_note` เข้า `TroubleshootingNode` และส่งออกใน `RenderedNode` (เช่น `authorNote?: string`) → หน้าจอแสดงป้าย "ผู้พัฒนาเพิ่ม (ไม่มีในคู่มือ)" แทน/คู่กับบรรทัดอ้างอิง · เพิ่มคอลัมน์ `source_page` ใน `nodes` (migration ใหม่) ให้ publish เก็บเลขหน้ารายโหนด และ `renderNode` ใช้เลขหน้าของโหนดก่อน fallback เป็นช่วงของผัง (memory ระบุว่ามีข้อเสนอนี้ใน `docs/exam-prep/18` รอยืนยันอยู่แล้ว)

---

### 🟠 High

#### H-1 error 500 ส่งข้อความภายใน (รวมข้อความ SQL) ให้ client
- **ไฟล์และบรรทัด** `backend/src/common/error-handler.ts:66-74` (`toBody` ใช้ `exception.message` ทุกกรณี รวม `INTERNAL_ERROR`) · `backend/src/health/health.routes.ts:14-23` (`databaseError` = ข้อความ error ของ mysql2 ส่งออกสาธารณะ)
- **ปัญหา** error ที่ไม่รู้จัก (mysql2, TypeError, JSON.parse) ได้ status 500 แต่ `message` ดิบถูกส่งกลับ
- **สถานการณ์** เปิดเซสชันเดียวกันสองแท็บแล้วกด "ใช่" ใกล้กัน → แท็บที่สองชน `UNIQUE (session_id, step_order)` → client ได้ `{"code":"INTERNAL_ERROR","message":"Duplicate entry '…-3' for key 'session_history.uq_history_step'"}` ซึ่งเผยชื่อตาราง/คีย์ · `/health` ตอน DB ล่มจะเผย host/ข้อความเชื่อมต่อ
- **แนวทางแก้** สำหรับ 5xx ที่ไม่ใช่ `ApiError` ให้ส่งข้อความกลาง ("เกิดข้อผิดพลาดภายใน") และ log ข้อความจริงฝั่งเซิร์ฟเวอร์เท่านั้น · `/health` ส่งแค่ `database: 'error'`

#### H-2 Migration ถูกรวบและเปลี่ยนชื่อไฟล์ → ฐานข้อมูลเดิม (Render/Aiven) จะ "รัน" ไฟล์ใหม่แบบไม่มีผล
- **ไฟล์และบรรทัด** `backend/migrations/001_users.sql`…`006_graph_drafts.sql` เทียบกับ `main` ที่มี `001_create_graph_tables.sql`…`012_create_graph_drafts.sql` · `backend/scripts/run-migrations.js:71` (ตัดสิน pending จากชื่อไฟล์)
- **ปัญหา** DB ที่เคยรันชุดเก่าจะมี `schema_migrations` เป็นชื่อเก่า เมื่อรัน `npm run migrate` บน branch นี้ ไฟล์ 001–006 ใหม่ทั้งหมดถูกนับว่า pending → `CREATE TABLE IF NOT EXISTS` ข้ามเงียบๆ แล้วบันทึกว่า "รันแล้ว"
- **สถานการณ์** ถ้าชุดใหม่มีคอลัมน์/ดัชนีที่ชุดเก่าไม่มี (หรือ ENUM ต่างกัน) จะไม่มีอะไรเตือน แอปบูตได้แต่ query ล้มตอนใช้งาน · ถ้าวันหนึ่งรัน migration จาก `main` ใส่ DB ที่สร้างจาก branch นี้ ไฟล์ชุดเก่าจะรันซ้ำ (เช่น `ALTER TABLE ADD COLUMN` → ล้ม)
- **แนวทางแก้** ก่อน merge/deploy ให้ dump schema ของ DB จริงเทียบกับ DB ที่สร้างจาก 001–006 (ดู Needs verification) · ใช้ชุดเดียวตลอด หรือเขียนขั้นตอน "baseline" ที่ใส่ชื่อไฟล์ใหม่ลง `schema_migrations` ให้ DB เดิมโดยตั้งใจ · แก้คอมเมนต์ที่อ้างเลขเก่า (`drafts.service.ts:46` "migration 012", `traversal.dto.ts:19,44`, `graph.repository.ts:74`, `.env.example:26,41`)

#### H-3 หน้าประวัติแสดงได้สูงสุด 50 รายการ และ "ทั้งหมด N รายการ" ผิด
- **ไฟล์และบรรทัด** `backend/src/history/history.store.ts:10` (`MAX_HISTORY_ROWS = 50`) และ `:48-59` (`LIMIT ?`) · `backend/src/history/history.service.ts:24-44` (แบ่งหน้าในหน่วยความจำ, `total = sorted.length`) · `frontend/src/pages/HistoryPage.tsx:89`
- **ปัญหา** SQL ดึงแค่ 50 แถวล่าสุดแล้วค่อยแบ่งหน้าใน JS
- **สถานการณ์** ผู้ใช้ที่ตรวจจบ 70 ครั้ง (ใน 90 วัน) เห็น "ทั้งหมด 50 รายการ" 5 หน้า และ 20 รายการเก่าสุดเปิดไม่ได้เลย ทั้งที่ยังไม่หมดอายุ
- **แนวทางแก้** ทำ pagination ใน SQL (`COUNT(*)` + `LIMIT ? OFFSET ?`) เหมือน `AdminStore.listFeedback` และตัดการ sort ซ้ำใน JS

#### H-4 Rephrase เรียก LLM ซ้ำทุกคำขอเมื่อผลไม่ผ่านด่าน และเรียกแม้แต่ตอน GET
- **ไฟล์และบรรทัด** `backend/src/rephrase/rephrase.service.ts:42-62` (cache เฉพาะผลที่ผ่าน) · `backend/src/traversal/traversal.service.ts:159-182` (`toResponse` → `displayTextOf` ทุก endpoint รวม `GET /sessions/:id`) · `render.yaml:21-22` เปิด `REPHRASE_ENABLED=true`
- **ปัญหา** ข้อความที่ LLM เรียบเรียงแล้ว "ไม่ผ่านด่าน" หรือ timeout ไม่ถูกจำ → ทุกครั้งที่ผู้ใช้มาถึงโหนดนั้น (หรือรีเฟรช) จะรอ Groq ใหม่สูงสุด `REPHRASE_TIMEOUT_MS` (3 วินาที)
- **สถานการณ์** โหนดที่มีเลข/รหัสเยอะมักไม่ผ่านด่าน → ทุกขั้นของผังนั้นช้า +3s และเสียโควตา Groq ฟรี (rate limit) ซึ่งทำให้โหนดอื่นล้มตามด้วย
- **แนวทางแก้** cache ผลลบด้วย (เช่น `Map<string, string | null>` พร้อมอายุ) · ข้ามการ rephrase ใน GET หรือย้ายไปเรียกแบบไม่บล็อก · จำกัดขนาด cache (ดู L-6)

---

### 🟡 Medium

#### M-1 session ของ guest อ่าน/เดินต่อได้โดยใครก็ตามที่รู้ sessionId
- **ไฟล์และบรรทัด** `backend/src/traversal/traversal.service.ts:136-141` (`authorize` ตรวจเฉพาะกรณี `user_id` ไม่เป็น NULL) · `traversal.routes.ts:19-34` ไม่ส่ง X-Client-Id เข้า `getSession/submitAction/submitOutcome`
- **ปัญหา** session ที่ `user_id IS NULL` (guest หรือบัญชีที่ถูกลบ — `ON DELETE SET NULL` ใน `004_sessions.sql:46`) ผ่าน `authorize` ทุกคน
- **สถานการณ์** guest แชร์ลิงก์ `/session/<uuid>` ให้เพื่อน → เพื่อนกดตอบต่อและบันทึก outcome แทนได้ (UUID v4 เดาไม่ได้ จึงเสี่ยงต่ำ แต่เป็นจุด IDOR ที่กรรมการถามได้) · ไม่สอดคล้องกับ `DELETE` ที่ตรวจ client_id
- **แนวทางแก้** ส่ง owner แบบเดียวกับ DELETE/history แล้วตรวจ `client_id` ด้วยเมื่อเป็น guest

#### M-2 คำขอซ้อนบน session เดียว → 500 แทน 409
- **ไฟล์และบรรทัด** `backend/src/traversal/session.store.ts:89-142` (UPDATE ไม่มีเงื่อนไข `current_node_id = ?`) · `004_sessions.sql:57-58` (คอมเมนต์บอก "โค้ดพึ่ง UNIQUE ตัวนี้") แต่ไม่มีที่ใดแปลง `ER_DUP_ENTRY` เป็น 409
- **ปัญหา** ข้อมูลไม่เสียเพราะ transaction rollback แต่ผู้ใช้เห็น "ข้อผิดพลาดที่ระบบไม่รู้จัก" + ข้อความ SQL (H-1) · frontend กันกดซ้ำในแท็บเดียวแล้ว (`SessionPage.tsx:46-56`) จึงเกิดเมื่อเปิดหลายแท็บ/retry ของเครือข่าย
- **แนวทางแก้** จับ `ER_DUP_ENTRY` ใน `update()` → `ApiError(409, 'SESSION_CONFLICT')` และ/หรือใช้ optimistic check `WHERE session_id = ? AND current_node_id = ?`

#### M-3 Dashboard นับไม่ครบ: ลบประวัติ/ยกเลิกการตรวจ = ข้อมูลหายจากสถิติ
- **ไฟล์และบรรทัด** `backend/src/history/history.store.ts:95-103` และ `session.store.ts:161-169` (`DELETE FROM sessions` จริง) · `005_session_feedback.sql:19-21` (`ON DELETE CASCADE`) · `admin.store.ts:111-191` (นับจาก `sessions` ที่เหลือ)
- **ปัญหา** ไม่มี soft delete
- **สถานการณ์** ผู้ใช้กด 👎 แล้วลบรายการ → feedback ถูกลบตาม → `satisfactionRate` สูงเกินจริง · ผู้ใช้กด "ยกเลิกการตรวจ" กลางทาง → session หายจาก `total` จึงไม่เห็นอัตราการเลิกกลางคัน (`expiredUnfinished` นับเฉพาะที่ปล่อยค้าง) · คอมเมนต์ `admin.service.ts:11-12` ยังบอกด้วยว่าตารางใช้ร่วมกับโปรเจกต์เก่า ตัวเลขรวม session ของโปรเจกต์เก่า
- **แนวทางแก้** soft delete (`deleted_at`/`hidden_by_owner`) แล้วหน้าประวัติกรองออก แต่สถิติยังนับ · ระบุในหน้า dashboard ว่าตัวเลขนับอะไร

#### M-4 ดัชนีค้นหาอาจพังเมื่อ publish สองครั้งพร้อมกัน / ไม่อัปเดตเมื่อ publish ระหว่างโหลดโมเดล
- **ไฟล์และบรรทัด** `backend/src/symptom-search/symptom-search.service.ts:104-150` (`info = new Map(this.graphInfo)` ถูกจับไว้ก่อน `await embed` แล้วเขียนทับตอนจบ) และ `:166` (`this.graphInfo.get(...) as GraphInfo`)
- **ปัญหา** (ก) สอง `addGraphs` ซ้อน → การเรียกที่จบทีหลังเขียน `graphInfo` ทับของอีกตัว → ดัชนีมีข้อความของผังที่ไม่มีใน `graphInfo` → `search()` อ่าน `info.entrySymptom` ของ undefined → TypeError 500 ทุกครั้งที่คำค้นใกล้ผังนั้น (ข) ถ้า publish ตอนสถานะ `loading` จะได้ `indexed:false` และไม่มีใครเติมให้จนรีสตาร์ต
- **แนวทางแก้** คัดลอก `graphInfo` หลัง await (ก่อนสลับ) หรือ serialize `addGraphs` ด้วย promise chain · ให้ `prepareIndex` อ่าน `graphs.listAll()` อีกรอบตอนจบ หรือคิวงาน addGraphs ไว้จนพร้อม

#### M-5 การร่างผังแบ่งทีละ 2 หน้า → อาการที่คร่อมรอยต่อหน้าหายไปเงียบๆ
- **ไฟล์และบรรทัด** `backend/src/authoring/drafts.service.ts:19` (`PAGES_PER_LLM_CALL = 2`), `:95-100` · prompt กฎข้อ 7 ใน `draft-llm.client.ts:61` ("symptom is cut off at the page edge, omit it")
- **สถานการณ์** ตาราง Troubleshooting หน้า 36–37 แบ่งเป็นคำขอ (35,36) และ (37,38) → อาการที่เริ่มหน้า 36 จบหน้า 37 ถูก LLM ตัดทิ้งตามกฎ ไม่มี warning ให้ admin รู้
- **แนวทางแก้** ให้ช่วงซ้อนกัน 1 หน้า (sliding window) แล้ว dedupe ตาม `entry_symptom` · หรือเพิ่ม warning "หน้า N–N+1 อยู่คนละคำขอ"

#### M-6 ไม่มี rate limit บน endpoint ที่แพง
- **ไฟล์และบรรทัด** `backend/src/app.ts:84-96` (ไม่มี middleware จำกัดอัตรา) · `/auth/login` (bcrypt), `/symptom-search` (ONNX บน CPU 1 เธรด `embedding.service.ts:39`), `/traversal/sessions*` (เรียก Groq)
- **สถานการณ์** สคริปต์ยิง `/symptom-search` 20 ครั้ง/วินาที บน Render free ทำให้ทุกคนรอคิว embedding · เดารหัสผ่านไม่จำกัด · เผาโควตา Groq
- **แนวทางแก้** `express-rate-limit` (แต่ต้องแก้ package.json — ทำเมื่อผู้ใช้อนุญาต) หรือ limiter อย่างง่ายในหน่วยความจำต่อ IP

#### M-7 `render.yaml` ไม่มีตัวแปรที่ backend บังคับ
- **ไฟล์และบรรทัด** `render.yaml:9-35` ไม่มี `JWT_SECRET`, `GROQ_API_KEY`, `GROQ_MODEL`, `AUTHORING_LLM_MODEL` · `backend/src/auth/token.ts:15-20` (ไม่มี JWT_SECRET = บูตไม่ขึ้น)
- **สถานการณ์** ถ้าสร้าง service ใหม่จาก Blueprint (เช่น เตรียมเดโมสำรอง) จะบูตล้มทันที · `REPHRASE_ENABLED=true` แต่ไม่มีคีย์ → ได้แค่ log เตือน
- **แนวทางแก้** เพิ่มรายการ `sync: false` ของตัวแปรเหล่านี้ใน `render.yaml`

#### M-8 ขนาด body JSON จำกัด 100KB อาจทำให้บันทึกร่างใหญ่ไม่ได้
- **ไฟล์และบรรทัด** `backend/src/app.ts:85` (`express.json()` ไม่ตั้ง `limit`) · `drafts.routes.ts:93-96` (PUT ส่งผังทั้งชุด) · `draft-schema.ts:174` อนุญาตถึง 60 ผัง × 60 โหนด × 2000 ตัวอักษร
- **สถานการณ์** ร่าง 10 หน้าได้ ~20 ผัง ข้อความไทย (3 ไบต์/ตัว) → JSON เกิน 100KB ได้ง่าย → 413 "request entity too large" ตอนกดบันทึกการแก้ (ดู Needs verification)
- **แนวทางแก้** ตั้ง `express.json({ limit: '1mb' })` เฉพาะ router ของ drafts

#### M-9 Confidence ไม่ใช่ความน่าจะเป็น แต่ dashboard เฉลี่ยรวมเป็น "ความมั่นใจเฉลี่ย"
- **ไฟล์และบรรทัด** `symptom-search.service.ts:183-188` (`scoreGraph` = cosine สูงสุดของข้อความอาการผังนั้น) · `admin.store.ts:119-120` (`AVG(confidence)`) · `MATCH_THRESHOLD = 0.55` (`symptom-search.service.ts:11`) ไม่มีหลักฐานการ calibrate ในโค้ด
- **ปัญหา** หน้าผู้ใช้เขียนชัดว่า "แสดงเป็นข้อมูลประกอบเท่านั้น" (ดี) แต่ค่าเฉลี่ยใน dashboard ถูกตีความเป็นคุณภาพได้ ทั้งที่ cosine ของ MiniLM ภาษาไทยไม่ได้สเกลเป็นโอกาสถูก
- **แนวทางแก้** เปลี่ยนชื่อเป็น "คะแนนความคล้ายเฉลี่ย" และอ้างอิงชุดทดสอบที่ใช้เลือก 0.55 (มี `scripts/study-measure.js` — ควรเก็บผลไว้ใน docs)

#### M-10 สคริปต์ migrate/seed อ่าน `DB_SSL_CA` ต่างจากแอป
- **ไฟล์และบรรทัด** `backend/src/database/pool.ts:7-14,43` (มี `normalizePem` แปลง `\n`) เทียบกับ `backend/scripts/run-migrations.js:29` และ `seed-graphs.js:16` (ใช้ค่าดิบ)
- **สถานการณ์** ค่า CA ที่วางเป็นบรรทัดเดียวมี `\n` ใช้กับแอปได้ แต่ `npm run migrate` ล้มด้วย SSL error
- **แนวทางแก้** ใช้ฟังก์ชันเดียวกัน (ย้ายไป `scripts/` ร่วมกัน)

---

### 🟢 Low

| # | ไฟล์:บรรทัด | ปัญหา | แนวทางแก้ |
|---|---|---|---|
| L-1 | `traversal-engine/traversal-engine.ts:108` | `new RegExp(node.pattern)` จากข้อมูลผัง ไม่ anchor (`\d+` ผ่าน "abc1") และไม่กัน ReDoS (validator ตรวจแค่ว่า compile ได้ `graph-validator.ts:284-293`) — ข้อมูล seed ไม่มี input node เลย จึงกระทบเฉพาะผังที่ร่างใหม่ | บังคับ `^…$` และจำกัดรูปแบบที่อนุญาต |
| L-2 | `traversal-engine.ts:168-171` + `rephrase.service.ts:155` | ค่าที่ผู้ใช้พิมพ์ถูกแทนลง `{{var}}` แล้วส่งไป Groq และเป็น key ของ cache → prompt injection (มีด่านตรวจลดความเสี่ยง) + cache โตตามค่าที่พิมพ์ | ไม่ rephrase โหนดที่มีตัวแปร หรือ rephrase ก่อนแทนค่า |
| L-3 | `main.ts:17` | `bootstrap()` ไม่มี `.catch` → บูตล้ม = unhandled rejection (ข้อความไม่สวย) | `bootstrap().catch(err => { console.error(err); process.exit(1) })` |
| L-4 | `auth/auth.middleware.ts:64-73` | `requireAuth` ไม่ตรวจว่าผู้ใช้ยังมีอยู่ → token ของบัญชีที่ถูกลบใช้ต่อได้ถึง 7 วัน (ส่วน admin ตรวจ DB แล้ว) · ไม่มีทาง revoke | ยอมรับเป็นข้อจำกัด หรือตรวจ `findById` ใน `/history` |
| L-5 | `lib/authStorage.ts:1-50` | JWT อยู่ใน `localStorage` → ถ้ามี XSS ขโมยได้ (React escape ข้อความแล้ว ความเสี่ยงต่ำ) | อธิบายเหตุผลตอนสอบ (GitHub Pages คนละโดเมนกับ Render, ใช้ cookie ยาก) |
| L-6 | `rephrase.service.ts:27` | `cache = new Map()` ไม่จำกัดขนาด | LRU ขนาดคงที่ |
| L-7 | `session.store.ts` ทั้งไฟล์ | ไม่มีงานลบ session หมดอายุ → ตารางโตเรื่อยๆ (query ใช้ `expires_at > NOW()` จึงไม่ผิด) | งาน cleanup ตอนบูต/รายวัน |
| L-8 | `admin.store.ts:111-191` | `WHERE UNIX_TIMESTAMP(created_at) >= ?` ใช้ index ไม่ได้ และไม่มี index บน `sessions.created_at` | เทียบ `created_at >= FROM_UNIXTIME(?)` + เพิ่ม index |
| L-9 | `error-handler.ts:83-85,101-103` | รูปแบบ error ไม่เหมือนกัน: 400 JSON เสีย / 404 path / 413 ไม่มี `code` ส่วนที่อื่นมี | ใส่ `code` ทุกกรณี |
| L-10 | `frontend/src/api/types.ts:1-2` | frontend import type จาก `../../../backend/src/...` → build frontend แยก repo/CI ไม่ได้ | ย้าย type ร่วมไปโฟลเดอร์ shared หรือคัดลอก |
| L-11 | `frontend/package.json` (`"test": "vitest run"`) | ไม่มีไฟล์ `*.test.*` ใน `frontend/src` เลย → `npm test` ฝั่ง frontend ไม่มีอะไรรัน | เพิ่มเทสต์อย่างน้อย `lib/errors.ts`, `authStorage.ts` |
| L-12 | `SessionPage.tsx:41,52` | เส้นทางที่ผ่านมา (PathRail) เก็บใน state → รีเฟรชแล้วหาย เพราะ `SessionResponse` ไม่ส่ง history | ส่ง steps จาก backend เหมือน `/history/:id` |
| L-13 | `SessionPage.tsx:70-72` | กด "ยกเลิกการตรวจ" แล้ว DELETE ล้มก็ยัง navigate ออก (session ค้าง 24 ชม.) | navigate เฉพาะ onSuccess หรือแจ้ง error |
| L-14 | `drafts.service.ts:58` | ตรวจ manual_id ชนเฉพาะคู่มือที่ publish แล้ว ไม่ตรวจร่างอื่นที่ยังไม่ publish → สองร่าง manualId เดียวกัน publish ได้ร่างเดียว (อีกร่างได้ DRAFT_ID_CONFLICT ตอนท้าย) · อัปโหลด PDF เล่มเดิมด้วย manualId ใหม่ = ผังซ้ำในดัชนีค้นหา | เตือนเมื่อ `source_manual` ซ้ำ |
| L-15 | `app.ts:84` | `cors({ credentials: true })` ไม่จำเป็น (ใช้ Bearer header ไม่ใช่ cookie) | ตัดออก |
| L-16 | `symptom-search.service.ts:183-188` | `startSession` embed query ซ้ำทั้งที่เพิ่งค้นไป และจัดอันดับทั้งดัชนีเพื่อหาผังเดียว | คำนวณเฉพาะข้อความของผังนั้น |
| L-17 | `symptom-search.routes.ts:15-17` | `/symptom-search/status` สาธารณะ เผย RSS memory และข้อความ error ภายใน | ย้ายไปใต้ `/admin` หรือตัดฟิลด์ |
| L-19 | `frontend/src/lib/clientId.ts:31` | catch ว่าง → ESLint `no-empty` error (lint ไม่ผ่าน) | ใส่คอมเมนต์อธิบายใน catch เหมือน `authStorage.ts:41-43` |
| L-20 | `vite.config.ts:14-17` | plugin 404 อ้าง `dist` ตายตัว ถ้าเปลี่ยน `build.outDir` จะคัดลอกผิดที่ | ใช้ outDir จาก config (`configResolved`) |
| L-18 | `drafts.service.ts:46`, `traversal.dto.ts:19,44`, `graph.repository.ts:74`, `.env.example:26,41` | คอมเมนต์/ข้อความอ้าง migration เลขเก่า (006/007/008/010/012) ที่ไม่มีแล้วใน branch นี้ | แก้เป็นเลขใหม่ |

### สิ่งที่ตรวจแล้ว "ไม่พบปัญหา" (ใช้ตอบกรรมการได้)
- **SQL injection**: ทุกคำสั่งใช้ `?` · ส่วนที่ต่อสตริงเป็นค่าคงที่ในโค้ดเท่านั้น (`ownerWhere` `session-owner.ts:23-28`, `whereSql` `admin.store.ts:57-71`, รายชื่อคอลัมน์ `draft-manual.ts:50-58`)
- **utf8mb4**: pool `charset: 'utf8mb4'` (`pool.ts:39`) และทุกตาราง `utf8mb4_unicode_ci`
- **Connection/transaction**: ทุก `getConnection()` มี `release()` ใน `finally` และ `rollback()` ใน `catch` (`session.store.ts:102-141`, `drafts.store.ts:200-233`)
- **ไม่มีโค้ด Prisma/Supabase/PostgreSQL/pgvector หลงเหลือ** (grep ทั้ง `backend/src`, `scripts`, `frontend/src`, `render.yaml`)
- **ความคล้ายคำนวณในหน่วยความจำ ไม่ query DB ต่อเวกเตอร์**: `symptom-matcher.ts:20-41` สูตร cosine ถูก, กัน norm = 0 (คืน 0), มิติไม่เท่ากัน = throw · เวกเตอร์ normalize แล้วจากโมเดล
- **กรอง metadata ก่อน cosine**: `symptom-search.service.ts:155-158` (manualId) · คำค้นที่ไม่มีอะไรผ่าน 0.55 = แสดง "ไม่พบ ระบบไม่เดา" (`SymptomSearchResults.tsx:13-19`)
- **Reload ผังไม่ทิ้ง cache ครึ่งๆ**: สร้าง Map ใหม่ให้เสร็จก่อนสลับ (`graph.repository.ts:148-170`)
- **ด่านความปลอดภัยบังคับที่ engine**: `continue` บนโหนด safety_critical = 400 (`traversal-engine.ts:91-97`) · validator บังคับ safety_critical ต้องมีคำเตือน และเตือนเมื่อหน้าต้นฉบับมีคำอันตรายแต่ผังไม่มีด่าน (`graph-validator.ts:298-306,382-386`) · ข้อมูล seed: 368 โหนด safety_critical และ**ไม่มี**โหนดที่มี safety_warning แต่ไม่ตั้ง flag
- **Rephrase ไม่แตะโหนดความปลอดภัย/ผลลัพธ์** (`rephrase.service.ts:39`) และมีด่านตรวจตัวเลข/รหัส/คำว่า "ไม่" (`rephrase-guard.ts`)
- **IDOR ของประวัติ/feedback**: ทุก query ใส่เงื่อนไข owner ใน SQL เดียวกัน (`history.store.ts:52,67,97`) · guest มองไม่เห็นของ user (`AND user_id IS NULL`)
- **Feedback**: 1 แถวต่อ session (PK) ส่งซ้ำ = แก้ทับ (`history.store.ts:103-110`) · frontend อัปเดต cache หลังบันทึก (`queries.ts:164-170`)
- **รหัสผ่าน**: bcrypt 10 รอบ, จำกัด 72 ไบต์, login ใช้ dummy hash กัน user enumeration ด้วยเวลา (`auth.service.ts:26,58-60`) · JWT secret จาก env ≥ 32 ตัว, กำหนด `algorithms: ['HS256']`
- **ไฟล์อัปโหลด**: memoryStorage (ไม่เขียนดิสก์ ไม่มีปัญหา path), จำกัดขนาด/จำนวน, ตรวจ magic `%PDF-`, PDF สแกน (ไม่มีข้อความ) = 422 `PDF_NO_TEXT` (`pdf-text.ts:94`)
- **Frontend**: query key มี identity ของผู้ใช้ + `queryClient.clear()` ตอน login/logout/401 (`AuthProvider.tsx`) · มี loading/error/empty state ครบทุกหน้าที่ตรวจ · กันกดซ้ำด้วย ref

---

## 4. คำถามที่กรรมการอาจถาม

| คำถาม | คำตอบสั้นที่แนะนำ |
|---|---|
| "นี่คือ RAG หรือเปล่า LLM ตอบเองไหม" | ไม่ใช่ RAG แบบให้ LLM แต่งคำตอบ ใช้ retrieval (embedding) เพื่อ**เลือกผังขั้นตอน**เท่านั้น เนื้อหาทุกขั้นมาจากฐานข้อมูลที่คนตรวจแล้ว LLM แค่เรียบเรียงถ้อยคำและมีด่านตรวจ ถ้าไม่ผ่านใช้ข้อความต้นฉบับ — ตั้งใจเพื่อตัดปัญหา hallucination ในงานที่เกี่ยวกับไฟฟ้า |
| "คะแนนความมั่นใจคืออะไร มาจากไหน" | cosine similarity ระหว่างข้อความที่ผู้ใช้พิมพ์กับชื่ออาการ/คำพ้องของผัง (0–1) ไม่ใช่ความน่าจะเป็นที่จะซ่อมได้ จึงแสดงเป็น "ข้อมูลประกอบ" และไม่ใช้ตัดสินขั้นตอน (ระวัง M-9: อย่าเรียกค่าเฉลี่ยใน dashboard ว่า "ความมั่นใจ") |
| "ทำไม threshold 0.55, top-3" | ควรตอบด้วยผลทดลอง (`scripts/study-measure.js`) ถ้าไม่มีตัวเลขให้ยอมรับว่าเลือกเชิงประจักษ์และเป็นงานต่อยอด — ตรงนี้ควรเตรียมกราฟ precision/recall ไว้ |
| "ถ้าผู้ใช้พิมพ์อาการที่ไม่มีในคู่มือ" | ไม่มีผลผ่านเกณฑ์ = บอกว่าไม่พบ ไม่เดา และพาไป "อาการทั้งหมด"/แนะนำศูนย์บริการ |
| "ไม่รู้รุ่น / brand ล่ะ" | เลือก "ไม่ทราบรุ่น" → เลือกรุ่นใกล้เคียงเอง ระบบบันทึก `model_selection='unknown'` และแสดงคำเตือนว่าขั้นตอนอาจไม่ตรง (`SessionPage.tsx:148-150`) — กรรมการอาจแย้งว่ายังใช้คู่มือผิดรุ่นได้ ควรตอบว่าเป็นการตัดสินใจโดยผู้ใช้ที่มีคำเตือน |
| "การอ้างอิง 'คู่มือหน้า X' เชื่อได้แค่ไหน" | **จุดอ่อนที่สุด (C-1)** ปัจจุบันอ้างระดับช่วงหน้าของผัง และ 27% ของโหนดเป็นข้อความที่ผู้พัฒนาเพิ่ม ซึ่งหน้าจอไม่ได้บอก — แนะนำให้แก้ก่อนสอบ หรืออย่างน้อยเตรียมคำตอบว่ามี `author_note` บันทึกไว้ทุกจุดในข้อมูลและกำลังแสดงผล |
| "ถ้า LLM ร่างผังผิด/ข้ามคำเตือน" | validator แบบ deterministic (โครงสร้าง, ทุกทางต้องจบ, ตัวแปร, source_page ต้องอยู่ในหน้าที่อัปโหลด, ตรวจคำอันตรายในหน้าต้นฉบับ) + คนตรวจต้องกดยืนยัน warning ก่อน publish · กรรมการอาจถามว่า warning "ยืนยันข้าม" ได้ → ตอบว่าเป็น human-in-the-loop โดยตั้งใจ แต่ error ข้ามไม่ได้ |
| "ด่านความปลอดภัยกดข้ามได้ไหม ถ้ายิง API ตรง" | ไม่ได้ engine ปฏิเสธ `continue` บนโหนด safety_critical ต้องส่ง `confirm_safety` (`traversal-engine.ts:91-97`) |
| "คนอื่นดูประวัติของฉันได้ไหม" | user: ไม่ได้ ตรวจ user_id ใน SQL · guest: ผูกกับ UUID ในเบราว์เซอร์ ใครได้ UUID นั้นก็ดูได้ (ยอมรับเป็นข้อจำกัด) · session ที่ยังเดินอยู่ของ guest เปิดได้ด้วย sessionId (M-1) |
| "embedding อยู่ที่ไหน เพิ่มคู่มือใหม่ต้องรีสตาร์ตไหม" | โหลดเข้าหน่วยความจำตอนบูต publish แล้ว reload ผัง + เติมดัชนีโดยไม่ต้องรีสตาร์ต (ข้อจำกัด M-4) |
| "satisfaction rate เชื่อได้ไหม" | ระวัง M-3: ลบประวัติแล้ว feedback หาย และอาจรวมข้อมูลโปรเจกต์เก่า |
| "LLM ล่ม/ช้าแล้วผู้ใช้เห็นอะไร" | rephrase: timeout 3s แล้วใช้ข้อความต้นฉบับ ผู้ใช้ไม่เห็น error (แต่ช้าลง H-4) · ร่างผัง: สถานะ failed พร้อมรหัส `LLM_TIMEOUT/LLM_HTTP/...` · ค้นหา: โมเดลอยู่ในเครื่อง ไม่พึ่ง API ภายนอก |

---

## 5. Needs verification

1. **Schema ของ DB จริงเทียบกับ migration 001–006 ชุดใหม่ (H-2)** — ไม่ได้เชื่อมต่อ DB (กติกาไม่อ่าน `.env`) ต้อง `SHOW CREATE TABLE` ทุกตารางบน DB ที่ deploy แล้วเทียบกับ DB ใหม่ที่สร้างจาก 001–006
2. **Render ตั้ง `JWT_SECRET`/`GROQ_*`/`AUTHORING_LLM_MODEL` ใน dashboard แล้วหรือยัง (M-7)** — ไม่มีสิทธิ์ดู dashboard
3. **ขนาดจริงของ JSON ร่างผัง (M-8)** — ประเมินจากเพดานใน schema ไม่ได้ทดลองร่างจริง ควรลองร่าง 10 หน้าแล้วกดบันทึก
4. **คอมเมนต์ "ตารางใช้ร่วมกับโปรเจกต์เก่า" (`admin.service.ts:11-12`)** — ไม่ทราบว่ายังจริงกับ DB ปัจจุบันหรือไม่
5. **ค่า 0.55 เหมาะกับภาษาไทยหรือไม่ (M-9)** — ไม่ได้รันโมเดลวัดผล
6. **ReDoS (L-1)** — ไม่ได้ทดสอบ pattern จริงจาก LLM เพราะข้อมูล seed ไม่มี input node
7. **ไฟล์ที่ยังไม่ commit ~90 ไฟล์** — รายงานนี้ตรวจตามสภาพบนดิสก์ ถ้า commit/stash ต่างไปจากนี้ เลขบรรทัดอาจเลื่อน
