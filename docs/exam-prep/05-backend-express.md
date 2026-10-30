# 05 — Backend (Express + raw SQL)

> backend ย้ายจาก NestJS 10 เป็น **Express 4** เมื่อ 21 ต.ค. 2569 (commit `129f256` บน branch `express-migration`) · **`main` และ Render ยังเป็น NestJS** (ดูไฟล์ 11, 14)
> หัวข้อของ NestJS (module, DTO+ValidationPipe, guard, interceptor) ยังถูกถามได้ ไฟล์นี้จึงเทียบให้ว่าใน Express ทำแบบไหน

## 1. โครงสร้างและการประกอบแอป (แทน `app.module`)

### อธิบายแบบง่าย
ไฟล์ `app.ts` คือ "แผงประกอบ" สร้างทุกชิ้นด้วย `new` ตามลำดับ แล้วผูก URL กับแต่ละโมดูล ไม่มีอะไรถูกสร้างให้อัตโนมัติ อ่านจากบนลงล่างก็รู้ว่าใครใช้ใคร

### เชิงเทคนิค
- `main.ts` โหลด `.env` → `createApp()` → `listen(PORT ?? 3000)` (`backend/src/main.ts:1-17`)
- `createApp()` = composition root (`backend/src/app.ts:45-85`)
  ```ts
  // app.ts:46-57 (ย่อ)
  const tokens = TokenService.fromEnv();                // JWT_SECRET ไม่ผ่าน = บูตไม่ขึ้น
  const pool = await createDbPool();                     // ping DB ก่อน
  const graphs = new GraphRepository(pool);
  const symptomSearch = new SymptomSearchService(new EmbeddingService(), graphs);
  const traversal = new TraversalService(graphs, equipment, new SessionStore(pool), symptomSearch, createRephraseService());
  ...
  ```
- ทุกโมดูลมีโครงเดียวกัน

| ชั้น | ชื่อไฟล์ | หน้าที่ | เทียบ NestJS |
|---|---|---|---|
| Route | `*.routes.ts` | อ่าน req → เรียก parse → เรียก service → ส่ง status/json | Controller |
| DTO / validation | `*.dto.ts` | `parseXxx(body: unknown)` ตรวจทุกช่อง โยน `ApiError(400, CODE)` | DTO + `ValidationPipe` |
| Service | `*.service.ts` | business logic, ประกอบ response | Provider/Service |
| Store / Repository | `*.store.ts`, `*.repository.ts` | SQL ดิบผ่าน `mysql2` | Repository |
| Middleware | `auth/auth.middleware.ts` | ตรวจ token/สิทธิ์ | Guard |
| Error | `common/error-handler.ts` | แปลง error → HTTP | Exception filter |

โมดูล: `health`, `auth`, `symptom-search` (+`embedding`), `traversal` (+`traversal-engine`), `history`, `admin`, `authoring`, `rephrase`, `common`, `database`

ลำดับ middleware (`app.ts:67-82`): `cors` (origin จาก `CORS_ORIGIN`) → `express.json()` → `urlencoded` → routes → `notFoundHandler` → `errorHandler`

## 2. Repository layer: raw SQL + mysql2 + parameterized query

### อธิบายแบบง่าย
ทุกคำสั่ง SQL เขียนเอง และค่าที่มาจากผู้ใช้จะใส่ผ่านเครื่องหมาย `?` เสมอ ห้ามต่อสตริงเอง ไลบรารีจะ escape ให้ ผู้ใช้จึงแทรกคำสั่ง SQL ไม่ได้

### เชิงเทคนิค
```ts
// backend/src/auth/users.store.ts:55-58
const [rows] = await this.pool.query<UserRow[]>(`${SELECT_USER} WHERE email = ? LIMIT 1`, [email]);
```
- pool: 5 connections, `utf8mb4`, TLS ด้วย `DB_SSL_CA` ถ้ามี (`backend/src/database/pool.ts:25-45`) · ping ตอนบูต ต่อไม่ได้ = บูตล้ม (`:48-66`)
- จุดที่ประกอบ SQL แบบ dynamic ยังปลอดภัย เพราะส่วนที่ต่อเป็น**ค่าคงที่ในโค้ด** ส่วนค่าผู้ใช้ยังเป็น `?`
  - `ownerWhere()` คืน `'(user_id = ?)'` หรือ `'(client_id = ? AND user_id IS NULL)'` (`backend/src/auth/session-owner.ts:25-30`)
  - `listFeedback` ต่อ `clauses` ที่เป็นสตริงคงที่ (`backend/src/admin/admin.store.ts:57-71`)
  - publish ใช้ชื่อคอลัมน์จาก const array `MANUAL_COLUMNS`/`GRAPH_COLUMNS`/`NODE_COLUMNS` (`backend/src/authoring/draft-manual.ts:50-58`, `drafts.store.ts:224-226`)
- Transaction ใช้ใน 3 จุด
  1. เดินขั้น: UPDATE sessions + INSERT history (`backend/src/traversal/session.store.ts:102-141`)
  2. publish ร่าง (`backend/src/authoring/drafts.store.ts:210-245`)
  3. seed (`backend/scripts/seed-graphs.js:259-268`)
- คำสั่งเดียวที่ "ตัดสิน + เปลี่ยน" พร้อมกัน กัน race condition เช่น
  - `DELETE … WHERE session_id = ? AND <owner> AND expires_at > NOW()` (`session.store.ts:161-169`)
  - `UPDATE … SET outcome_text = ? WHERE … AND outcome_text IS NULL` → บันทึกได้ครั้งเดียว (`session.store.ts:171-182`)
  - `UNIQUE (session_id, step_order)` กันสองคำขอซ้อนบน session เดียว (`backend/migrations/004_sessions.sql:58, 74`)
- ข้อมูลที่อ่านบ่อยและแทบไม่เปลี่ยน (ผัง 631, อุปกรณ์) **โหลดเข้า RAM ครั้งเดียวตอนบูต** (`graph.repository.ts:79-81`, `equipment.repository.ts:23-25`) คำขอเดินผังจึงไม่ต้อง query ตารางผัง

## 3. DTO + validation (แทน ValidationPipe)

- รับ `unknown` แล้วตรวจทีละช่องด้วยมือ คืน object ที่ type แคบลง ตัวอย่าง `parseTraversalAction` ยอมรับเฉพาะ 4 รูป (`backend/src/traversal/traversal.dto.ts:119-159`)
- ผลเทียบได้กับ `whitelist` ของ ValidationPipe เพราะ parse คืนเฉพาะช่องที่ประกาศ ช่องเกินจะถูกทิ้งไป
- ข้อจำกัดที่ตรวจ เช่น query ≤ 200, input ≤ 255, outcome ≤ 1000, comment ≤ 500, email regex, password 8–72 ตัว/72 ไบต์, `X-Client-Id` ต้องเป็น UUID (`traversal.dto.ts:5-6, 25-42` · `auth.dto.ts:5-12`)
- authoring ตรวจ JSON ของผังด้วย `parseDraftGraphs` และ validator อีกชั้น (ไฟล์ 02)

## 4. Middleware (แทน guard) และ "interceptor"

| ตัว | ทำอะไร | ใช้ที่ |
|---|---|---|
| `optionalAuth` | มี `Authorization` ก็ตรวจ (ผิด = 401) · ไม่มีก็ผ่านเป็น guest | `/traversal/*`, `/history/*` (`backend/src/auth/auth.middleware.ts:54-62`) |
| `requireAuth` | ต้องมี token ที่ถูกต้อง | `/auth/me`, `/admin/*` (`:64-73`) |
| `requireAdmin` | **อ่าน role ล่าสุดจาก DB** ไม่เชื่อ role ใน token (ถูกถอดสิทธิ์แล้วใช้ token เก่าไม่ได้) → 403 | `/admin/*` (`:75-87`) |
| `adminArea` | ใส่ `requireAuth, requireAdmin` ครั้งเดียวที่ router แม่ route ใหม่ใต้ `/admin` จึงถูกป้องกันอัตโนมัติ | `backend/src/admin/admin.routes.ts:9-14` · `app.ts:76-79` |
| `uploadPdf()` | ห่อ multer (คล้าย `FileInterceptor`) แปลง error ของ multer เป็น 413/400 ของเราเอง | `backend/src/authoring/drafts.routes.ts:43-71` |
| `asyncRoute` | ส่ง error ของ async handler ไป errorHandler (Express 4 ไม่ทำให้เอง) | `backend/src/common/error-handler.ts:111-115` |

ไม่มี interceptor แบบ NestJS (เช่น logging/transform) — **ไม่พบในโค้ด**

## 5. รูปแบบ response และ error handling

- **สำเร็จ:** ส่ง DTO ตรงๆ ไม่มี envelope เช่น `{sessionId, node, …}` · สร้างใหม่ 201 · งานเบื้องหลัง 202 (`drafts.routes.ts:79`) · ลบ 204
- **error ปกติ:** `{ statusCode, code, message }` โดย `code` เป็นค่าคงที่ที่ frontend ใช้ตัดสิน (`frontend/src/lib/errors.ts`) ส่วน `message` เป็นภาษาไทยไว้แสดงผล
- ลำดับการตัดสินใน `errorHandler` (`backend/src/common/error-handler.ts:74-100`)
  1. JSON ผิดไวยากรณ์ / URI ผิด → 400 `{message, error: 'Bad Request', statusCode}` (คงรูปแบบเดิมของ NestJS)
  2. `ApiError` → status/code ตามที่โยน
  3. error ของ engine → `SAFETY_CONFIRMATION_REQUIRED` 400 · `INVALID_ACTION` 400 · `SESSION_COMPLETED` 409 · `GRAPH_NODE_MISSING` 500 (`:38-43`)
  4. error ที่มี `statusCode` 4xx–5xx ของตัวเอง เช่น body ใหญ่เกิน → `{statusCode, message}`
  5. อื่นๆ → 500 `INTERNAL_ERROR` · log stack เฉพาะ 5xx
- 404 ของ path ที่ไม่มี → `{message: 'Cannot GET /x', error: 'Not Found', statusCode: 404}` (`:103-105`)
- ⚠ **จุดอ่อน:** ข้อ 5 ส่ง `exception.message` ดิบกลับไปให้ client รวมถึงข้อความ error ของ MySQL (`:67-71`) ดูไฟล์ 14

## 6. ตาราง endpoint ทั้งหมด (24 ตัว)

| Method | Path | Auth / Role | หน้าที่ | โค้ด |
|---|---|---|---|---|
| GET | `/health` | สาธารณะ | สถานะ + `SELECT 1` ไปที่ DB | `health/health.routes.ts:8-27` |
| POST | `/auth/register` | สาธารณะ | สมัคร (role = user เสมอ) → token | `auth/auth.routes.ts:11-14` |
| POST | `/auth/login` | สาธารณะ | ล็อกอิน → token | `auth.routes.ts:16-19` |
| GET | `/auth/me` | requireAuth | ข้อมูลผู้ใช้ปัจจุบันจาก DB | `auth.routes.ts:21-24` |
| POST | `/symptom-search` | สาธารณะ | ค้นอาการ ≤ 3 ผัง | `symptom-search/symptom-search.routes.ts:9-13` |
| GET | `/symptom-search/status` | สาธารณะ | สถานะดัชนี/โมเดล/RAM | `symptom-search.routes.ts:15-17` |
| GET | `/traversal/graphs?manualId=` | สาธารณะ | รายการผัง (กรองรุ่นได้) | `traversal/traversal.routes.ts:12-14` |
| GET | `/traversal/manuals` | สาธารณะ | รายการคู่มือ/รุ่น | `traversal.routes.ts:16-18` |
| POST | `/traversal/sessions` | optionalAuth (+X-Client-Id) | เริ่ม session | `traversal.routes.ts:20-25` |
| GET | `/traversal/sessions/:id` | optionalAuth · session ของ user ต้องเป็นเจ้าของ | อ่านขั้นปัจจุบัน | `traversal.routes.ts:27-30` |
| POST | `/traversal/sessions/:id/actions` | เหมือนข้างบน | ส่งคำตอบ/ยืนยัน | `traversal.routes.ts:32-36` |
| POST | `/traversal/sessions/:id/outcome` | เหมือนข้างบน | บันทึกผลลัพธ์ (ครั้งเดียว) | `traversal.routes.ts:38-42` |
| DELETE | `/traversal/sessions/:id` | ต้องมีเจ้าของ (token หรือ X-Client-Id) | ยกเลิก session | `traversal.routes.ts:44-49` |
| GET | `/history?page=&pageSize=` | ต้องมีเจ้าของ | รายการประวัติที่จบแล้ว | `history/history.routes.ts:13-17` |
| GET | `/history/:id` | ต้องมีเจ้าของ | รายละเอียด + เล่นซ้ำขั้นตอน | `history.routes.ts:20-24` |
| POST | `/history/:id/feedback` | ต้องมีเจ้าของ | 👍/👎 + comment (upsert) | `history.routes.ts:27-31` |
| DELETE | `/history/:id` | ต้องมีเจ้าของ | ลบประวัติ | `history.routes.ts:34-39` |
| GET | `/admin/feedback` | admin | รายการ feedback กรองได้ | `admin/admin.routes.ts:20-23` |
| GET | `/admin/analytics/summary?days=` | admin | สถิติ N วัน (1–90) | `admin.routes.ts:26-29` |
| POST | `/admin/drafts` | admin | อัปโหลด PDF → 202 | `authoring/drafts.routes.ts:76-81` |
| GET | `/admin/drafts` | admin | รายการร่าง | `drafts.routes.ts:83-86` |
| GET | `/admin/drafts/:id` | admin | รายละเอียดร่าง + ข้อความหน้า + รายงาน validator | `drafts.routes.ts:88-91` |
| PUT | `/admin/drafts/:id` | admin | แก้ผัง (เฉพาะ ready) | `drafts.routes.ts:93-96` |
| POST | `/admin/drafts/:id/reject` · `/publish` | admin | ปฏิเสธ / เผยแพร่ | `drafts.routes.ts:98-108` |

(path ในคอลัมน์ "โค้ด" นับจาก `backend/src/`)

## 7. Test

- เหลือไฟล์เดียว: `backend/src/admin/admin-guard.spec.ts` (ยังไม่ได้ commit) ทดสอบ `createApp()` ด้วย pool ปลอม และด่านสิทธิ์ของ `/admin`
- `docs/README.md` บันทึกว่าเทสต์อื่น "ถูกลบตามคำสั่งผู้ใช้" · frontend มี vitest ติดตั้งไว้แต่**ไม่มีไฟล์เทสต์**
- การันตีตอนย้าย framework: ชุดเทียบ HTTP 120 กรณี + error 46 ชนิด (ตรงทั้งหมด) แต่ชุดนี้**อยู่นอก repo** (`docs/STUDY_GUIDE.md` §5.7)
