# Walkthrough: 1 รอบการใช้งาน (สมัครสมาชิก → ตรวจอาการ → ประวัติ → ให้คะแนน → แดชบอร์ดผู้ดูแล)

> จัดทำ 22 ต.ค. 2569 · **อ่านอย่างเดียว** ไม่ได้แก้โค้ดใดๆ · ทุกการอ้างอิงเป็น `path:บรรทัด` ที่อ่านจากไฟล์บนดิสก์ ณ วันที่เขียน (backend หลายไฟล์ถูกลบคอมเมนต์แล้ว เลขบรรทัดจึงต่างจากเอกสารเก่า เช่น `docs/STUDY_GUIDE.md`)
> ข้อที่ไม่พบ/ไม่ implement เขียนว่า **"ไม่พบ"** พร้อมบอกว่าค้นที่ไหน · ไม่ได้รันระบบจริง ทุกข้อมาจากการอ่านโค้ด

## 0. ข้อควรรู้ก่อนอ่าน: โจทย์ต่างจากโค้ดจริงตรงไหน

โจทย์ระบุสถาปัตยกรรมแบบ "RAG + LLM ตอบคำถาม + embeddings ใน MySQL + chat/message" แต่โค้ดจริงต่างออกไป (สรุป เทียบละเอียดใน §Gap Analysis):

| โจทย์ | โค้ดจริง |
|---|---|
| RAG ให้ LLM สร้างคำตอบ | **ไม่มี** การให้ LLM ตอบ ระบบ "ค้นอาการที่ใกล้เคียง" ด้วย embedding แล้ว **เดินผังขั้นตอนที่เขียนไว้แล้ว** ด้วยเครื่องสถานะ (`traversal-engine`) LLM ใช้ 2 งานเท่านั้น: เรียบเรียงถ้อยคำบางโหนด (`rephrase/`) และช่วยร่างผังจาก PDF ให้ admin ตรวจ (`authoring/`) |
| embeddings เก็บใน MySQL | **ไม่เก็บ** (ค้น `embedding`/`vector` ใน `backend/migrations` และ `backend/scripts` ไม่พบ) เวกเตอร์สร้างในหน่วยความจำตอนบูต |
| Metadata filter (SQL) ตาม device/brand/model | กรองในหน่วยความจำด้วย `manualId` (ไม่ใช่ SQL) · ผู้ใช้เลือก ประเภทเครื่อง → รุ่น ในหน้าเลือกเครื่อง ไม่มีช่องกรอก brand แยก |
| chat / message / references tables | **ไม่พบ** มีแต่ `sessions`, `session_history`, `session_feedback` |
| Problem / Possible Cause / Confidence / Solution / Safety / References | บางส่วน: ไม่มี "Possible Cause" (ตั้งใจ ดู `history.service.ts:7` และ `HistoryDetailPage.tsx:28`) |
| Zustand | **ไม่พบ** (ค้น `zustand` ใน `frontend/package.json` และ `frontend/src` ไม่พบ) ใช้ React Query + React Context |

**ฐานของเอกสารนี้:** backend คือ **Express 4** (`backend/src/main.ts` เรียก `createApp()` ใน `backend/src/app.ts`) ไม่มีไฟล์ `server.ts` · คำศัพท์ฝั่ง backend ใช้ตามโค้ดจริง: **router** (`*.routes.ts`), **route handler** (callback ที่ห่อด้วย `asyncRoute`), **auth middleware** (`auth.middleware.ts`), **ฟังก์ชัน `parse*`** ใน `*.dto.ts` (ตรวจ input ใน handler ไม่ใช่ middleware), **service**, **store/repository** · ลำดับ middleware ดู §2.1

## 1. โครงสร้างโปรเจกต์ (สรุป)

```
appliance-repair-assistant/
├── frontend/            React 19 + Vite + TS + Tailwind + TanStack Query + react-router-dom 7
│   └── src/
│       ├── main.tsx, App.tsx          entry + router
│       ├── api/                       http.ts (fetch + token), auth.ts, traversal.ts, history.ts, admin.ts, drafts.ts, queries.ts (React Query hooks), types.ts
│       ├── pages/                     Home, Devices, Symptoms, AllSymptoms, Session, History, HistoryDetail, Login, Register, Admin*
│       ├── components/                step/*, history/*, admin/*, auth/*, layout/*, ui/*, OutcomeForm, SessionHeader ...
│       └── lib/                       authStorage, clientId, clientHeaders, modelSelection, textInput, errors ...
├── backend/             Express 4 + TS + mysql2 (SQL ดิบ ไม่มี ORM)
│   ├── src/
│   │   ├── main.ts, app.ts            จุดเริ่ม + ประกอบแอป
│   │   ├── auth/ traversal/ traversal-engine/ symptom-search/ embedding/ rephrase/ history/ admin/ authoring/ health/ common/ database/
│   ├── migrations/                    001_users … 006_graph_drafts (.sql)
│   ├── scripts/                       run-migrations, seed-admin, seed-graphs, seed-equipment, backup-graph-tables, study-measure
│   └── model/                         โมเดล embedding (โหลดจากดิสก์ ห้ามดึงจากเน็ต)
├── data/manuals/*.json  ข้อมูลผังที่ seed-graphs.js อ่านเข้า DB (ingest ฝั่ง "คู่มือที่เขียนไว้แล้ว")
└── docs/
```
(ingest ของระบบนี้มี 2 ทาง: `backend/scripts/seed-graphs.js` อ่านไฟล์ JSON ใน `data/manuals/` ลง DB และ `authoring/` ที่ admin อัปโหลด PDF → LLM ร่าง → ตรวจ → publish ลง DB)

## 2. Entry points

| ฝั่ง | ไฟล์:บรรทัด | ทำอะไร |
|---|---|---|
| Frontend | `frontend/src/main.tsx:6-10` | `createRoot(...).render(<App/>)` ใน `StrictMode` |
| Frontend | `frontend/src/App.tsx:34-90` | `QueryClientProvider` → `BrowserRouter` → `AuthProvider` → `AppShell` → `Routes` (เส้นทางเฉพาะ `/admin/*` ครอบด้วย `AdminRoute` `:51-82`) |
| Backend | `backend/src/main.ts:8-15` | `createApp()` แล้ว `app.listen(PORT)` |
| Backend | `backend/src/app.ts:45-82` | `createApp()`: `TokenService.fromEnv` `:46` → `createDbPool` `:47` → สร้าง store/service `:49-56` → `graphs.load()` `:58`, `equipment.load()` `:59`, `symptomSearch.start()` `:60` (ไม่รอ), `drafts.failInterruptedDrafts()` `:61` → CORS `:66`, `express.json()` `:67`, routes `:70-76`, `notFoundHandler` `:78`, `errorHandler` `:79` |

## 2.1 ลำดับ middleware ของ request (Express)

คำขอหนึ่งตัวเดินจากบนลงล่างตามลำดับที่ลงทะเบียนใน `createApp()` (`backend/src/app.ts`) · ไม่มีไฟล์ `server.ts` จุดเริ่มคือ `main.ts:8-15`

| ลำดับ | ชั้น | ไฟล์:บรรทัด | ทำอะไร |
|---|---|---|---|
| 1 | `cors({ origin: CORS_ORIGIN ?? 'http://localhost:5173', credentials: true })` | `app.ts:66` | ใส่หัว CORS / ตอบ preflight ให้ทุก path (global) |
| 2 | `express.json()` | `app.ts:67` | อ่าน body JSON → `request.body` · JSON ผิดไวยากรณ์ → error `entity.parse.failed` → `errorHandler` ตอบ 400 (`common/error-handler.ts:80-86`) |
| 3 | `express.urlencoded({ extended: true })` | `app.ts:68` | อ่าน body แบบ form (journey นี้ส่ง JSON ทั้งหมดผ่าน `api/http.ts:67`; ส่ง `FormData` เฉพาะอัปโหลด PDF ของ admin ซึ่งใช้ multer) |
| 4 | **mount router ตามลำดับ:** `/health` `:70`, `/auth` `:71`, `/symptom-search` `:72`, `/traversal` `:73`, `/history` `:74`, `/admin` `:75`, `/admin/drafts` `:76` | `app.ts:70-76` | แต่ละ router อยู่ในไฟล์ `*.routes.ts` ที่รับ service และ middleware ผ่านพารามิเตอร์ (เช่น `traversalRoutes(traversal, optionalAuth)` `:73`) |
| 4a | **auth middleware ราย route** (ไม่ได้ครอบทั้ง path) | `auth/auth.middleware.ts`: `optionalAuth :49-57`, `requireAuth :59-68`, `requireAdmin :70-80` · สร้างที่ `app.ts:63` | ตัวอย่างที่ติด: `traversal.routes.ts:42` (`optionalAuth`), `history.routes.ts:13` (`optionalAuth`), `auth.routes.ts:21` (`requireAuth`), `admin.routes.ts:26-27, 36-37` (`requireAuth` → `requireAdmin`), `authoring/drafts.routes.ts:75-77` (`adminOnly = [requireAuth, requireAdmin]` แล้ว `uploadPdf()` ตามหลัง) · ติดทีละ route จึงทำให้ path ที่ไม่มีจริงใต้ `/admin` ยังได้ 404 |
| 4b | **route handler** ห่อด้วย `asyncRoute` | `common/error-handler.ts:111-115` | ส่ง error ของฟังก์ชัน async ไป `next(err)` (Express 4 ไม่จับให้เอง) |
| 4c | **validation** | ฟังก์ชัน `parse*` ใน `*.dto.ts` เรียกใน handler (เช่น `auth.routes.ts:12` เรียก `parseRegisterBody`) | ไม่ใช่ middleware · **ไม่พบ** validation middleware หรือไลบรารี schema (ค้น `zod`/`joi`/`class-validator`/`express-validator` ใน `backend/package.json` และ `backend/src` ไม่พบ) |
| 4d | **multer** (เฉพาะอัปโหลด PDF ของ admin) | `authoring/drafts.routes.ts:43` `uploadPdf()` | อยู่หลังด่านสิทธิ์ (ตรวจ admin ก่อนรับไฟล์) |
| 5 | `notFoundHandler` | `app.ts:78` → `common/error-handler.ts:103-105` | ไม่ตรง route ไหน → 404 `{message:'Cannot GET /x', error:'Not Found', statusCode:404}` |
| 6 | `errorHandler` (ต้องอยู่ท้ายสุด) | `app.ts:79` → `common/error-handler.ts:74-100` | แปลง error ทุกชนิดเป็น `{statusCode, code, message}`: body-parser/URIError → 400 `:82-86` · error ที่มี `statusCode` ของไลบรารี `:89-92` · `ApiError`/error ของ engine (`ENGINE_ERRORS` `:38-43`) · ที่เหลือ 500 `INTERNAL_ERROR` (`toBody` `:62-72`) · log เฉพาะ 5xx `:96-98` |

**ไม่พบ:** logging middleware, `helmet`, `compression`, rate limit (ค้น `morgan`/`helmet`/`compression`/`rate-limit`/`throttle` ใน `backend/package.json` และ `backend/src` ไม่พบ)

---

# ช่วงที่ 1: สมัครสมาชิก (Register)

### 1) ภาพรวม
ผู้ใช้กรอกชื่อที่แสดง/อีเมล/รหัสผ่าน → ฟอร์มตรวจฝั่งหน้าจอ → `POST /auth/register` → backend ตรวจซ้ำ, hash รหัสผ่าน, INSERT `users`, ออก JWT กลับมา → หน้าจอเก็บ token แล้วเข้าสู่ระบบทันที (สมัครแล้วถือว่าล็อกอิน) การสมัครเป็นทางเลือกเสริม ไม่สมัครก็ตรวจอาการได้ (เป็น guest)

### 2) Frontend
- **หน้า:** `frontend/src/pages/RegisterPage.tsx` (route `/register` — `App.tsx:49`) ลิงก์เข้าจากเมนูซ้าย `components/layout/AppShell.tsx:74-76`
- **ปุ่ม/ฟอร์ม:** `<form onSubmit={handleSubmit}>` `RegisterPage.tsx:53` · ปุ่ม "สมัครสมาชิก" `:97-99` (`Button type="submit"`)
- **handler:** `handleSubmit` `RegisterPage.tsx:38-44` → `validateRegister(...)` (`lib/authForm.ts:44-62`) ถ้ามีข้อผิดพลาดแสดงใต้ช่องและไม่ส่ง → ไม่งั้น `submit.mutate()`
- **hook:** `useMutation` ในหน้า `RegisterPage.tsx:29-32` (`mutationFn: () => register(email.trim(), password, displayName.trim())`, `onSuccess: navigate(next ?? '/history')`) · `register` มาจาก `useAuth()` = `AuthProvider.register` (`components/auth/AuthProvider.tsx:75-80`) → `applySession` (`:58-66`: `storeAuth`, `setStored`, `queryClient.clear()`)
- **API client:** `frontend/src/api/auth.ts:22-29` `register()` → `request('/auth/register', { method:'POST', body:{ email, password, displayName }, anonymous:true })` (`anonymous` = ไม่แนบ token และ 401 ไม่ถือว่า token เสีย `api/http.ts:30-34`, `:63`)
- **method + URL:** `POST {VITE_API_URL}/auth/register` · body `{ "email": "...", "password": "...", "displayName": "..." }`
- **State ที่เก็บ:** React Context `AuthProvider` (ไม่ใช่ Zustand) + token ใน `localStorage` (ดูช่วง 2)

### 3) Backend
- **Router / route handler:** `backend/src/auth/auth.routes.ts:11-14` `router.post('/register', asyncRoute(...))` mount ที่ `/auth` ใน `app.ts:71` · **ไม่มี auth middleware** (สาธารณะ) ตอบ **201** (`:12`)
- **Validation (`parse*` ใน `*.dto.ts` เรียกใน handler):** `parseRegisterBody` `backend/src/auth/auth.dto.ts:89` (`parseEmail` `:53` — trim + lowercase + รูปแบบ, `parsePassword` `:65` — 8–72 ตัวอักษรและ ≤ 72 ไบต์, `parseDisplayName` `:80` — 1–100) ผิด → `ApiError 400 INVALID_AUTH_REQUEST` · **อ่านเฉพาะ email/password/displayName** ฟิลด์อื่น (เช่น `role`) ถูกเมิน
- **Service:** `AuthService.register` `backend/src/auth/auth.service.ts:33-53`: `hash(password, 10)` `:34` → `usersStore.create({... role: Role.User })` `:38-44` (role ตายตัว) → ซ้ำ → `DuplicateEmailError` → `ApiError 409 EMAIL_TAKEN` `:46-47` → `issue(user)` `:52` = `tokens.sign({sub, role})` (`:74-77`, `auth/token.ts:32-34` HS256 อายุเริ่มต้น 7 วัน)
- **Store/Repository:** `UsersStore.create` `backend/src/auth/users.store.ts:65-84`

```sql
-- users.store.ts:68-70
INSERT INTO users (id, email, password_hash, display_name, role)
VALUES (?, ?, ?, ?, ?)
-- แล้วอ่านกลับ (users.store.ts:37-39 + :61)
SELECT id, email, password_hash, display_name, role, UNIX_TIMESTAMP(created_at) AS created_epoch
  FROM users WHERE id = ? LIMIT 1
```
- ซ้ำอีเมล: MySQL ตอบ `ER_DUP_ENTRY` (ชน UNIQUE `uq_users_email`) → `users.store.ts:73-75` แปลงเป็น `DuplicateEmailError`

### 4) Database
- ตาราง `users` (สร้างที่ `backend/migrations/001_users.sql:12-23`): `id CHAR(36)` PK, `email VARCHAR(255)` UNIQUE, `password_hash` (bcrypt), `display_name`, `role ENUM('user','admin') DEFAULT 'user'`, `created_at`, `updated_at`
- เขียน: 1 แถวต่อการสมัคร

### 5) Response
```json
// 201
{ "accessToken": "<JWT>", "user": { "id": "uuid", "email": "a@b.com", "displayName": "สมชาย", "role": "user", "createdAt": "2026-10-22T03:00:00.000Z" } }
```
หน้าจอ: `api/auth.ts:9-11` เก็บเฉพาะ `{ token, user:{id, displayName, role} }` (**ไม่เก็บอีเมล**) → `navigate(next ?? '/history')` (`RegisterPage.tsx:31`) · error: `ErrorNotice` `:85-95` (ถ้า `EMAIL_TAKEN` มีลิงก์ไปหน้าเข้าสู่ระบบ `:87-93`)

### 6) ข้อสังเกต
- ไม่มี rate limit กันสมัครรัว/เดารหัส (ค้นใน `backend/src` ไม่พบ) และไม่มียืนยันอีเมล
- กฎตรวจฝั่งหน้าจอ (`lib/authForm.ts:9-17`) คัดลอกจาก backend ด้วยมือ ต้องแก้สองที่เมื่อเปลี่ยนกฎ (หัวไฟล์เตือนไว้)
- `role` ตายตัว `user` ที่ `auth.service.ts:43` ผู้ใช้สมัครเป็น admin ไม่ได้ (admin มาจาก `scripts/seed-admin.js` เท่านั้น)

---

# ช่วงที่ 2: เข้าสู่ระบบ (Login) + JWT + auth middleware

### 1) ภาพรวม
`POST /auth/login` → ตรวจอีเมล/รหัสผ่านด้วย bcrypt → ออก JWT → หน้าจอเก็บใน `localStorage` (key `fixstep.auth`) แล้วแนบ `Authorization: Bearer <token>` ทุกคำขอ · backend ตรวจ token ด้วย middleware 3 ตัว (`optionalAuth`/`requireAuth`/`requireAdmin`)

### 2) Frontend
- **หน้า:** `pages/LoginPage.tsx` (route `/login` — `App.tsx:48`) · ลิงก์ `AppShell.tsx:71-73`
- **ปุ่ม/handler:** ปุ่ม "เข้าสู่ระบบ" `LoginPage.tsx:90-92` · `handleSubmit` `:42-48` (`validateLogin` `lib/authForm.ts:36-42`) → `useMutation` `:32-35` → `login` = `AuthProvider.login` `AuthProvider.tsx:68-73` → `apiLogin` → `applySession`
- **API client:** `api/auth.ts:13-20` · `POST /auth/login` body `{ email, password }` (`anonymous:true`)
- **เก็บ token ที่ไหน:** `lib/authStorage.ts` — `localStorage['fixstep.auth']` (`:19`) = `{token, user}`, สำเนาในหน่วยความจำ (`:27`), `storeAuth` `:70-77`, `getStoredToken` `:66-68` · ห่อ `try/catch` เผื่อ localStorage ใช้ไม่ได้ (`:50-58`)
- **แนบ token ทุกคำขอ:** `api/http.ts:63` (`getStoredToken()`), `:69` (`Authorization: Bearer ${token}`) ยกเว้นคำขอ `anonymous`
- **ตอนเปิดแอป:** `AuthProvider.tsx:39-56` ถ้ามี token → `GET /auth/me` (`api/auth.ts:31-33`) ยืนยันและอัปเดตชื่อ/role
- **token หมดอายุ/เสีย:** `http.ts:91-93` เรียก `unauthorizedHandler` → `AuthProvider.tsx:25-36` ล้างล็อกอิน + `queryClient.clear()` + พาไป `/login?reason=expired&next=...`
- **ออกจากระบบ:** ปุ่ม `AppShell.tsx:84-86` → `AuthProvider.logout` `:106-112` (ล้าง localStorage, ล้างแคช, ไปหน้าแรก) · **ฝั่งเซิร์ฟเวอร์ไม่มีอะไรเกิดขึ้น**

### 3) Backend
- **Router / route handler:** `auth.routes.ts:16-19` `POST /auth/login` ตอบ 200 (สาธารณะ) · `auth.routes.ts:21-24` `GET /auth/me` ใช้ `requireAuth`
- **Validation (`parse*` ใน `*.dto.ts` เรียกใน handler):** `parseLoginBody` `auth.dto.ts:99` (อีเมล/รหัสผ่านต้องเป็นข้อความไม่ว่าง ตรวจน้อยกว่าตอนสมัครโดยตั้งใจ)
- **Service:** `AuthService.login` `auth.service.ts:55-64`:
```ts
const user = await this.usersStore.findByEmail(body.email);                          // :56
const matches = await compare(body.password, user ? user.passwordHash : this.dummyHash); // :58
if (!user || !matches) throw invalidCredentials();   // 401 INVALID_CREDENTIALS ข้อความเดียวกันทุกกรณี
return this.issue(user);                              // :63
```
  `dummyHash` `:26` กัน timing ที่เผยว่าอีเมลมีในระบบ
- **Auth middleware (ฝั่ง backend):** `backend/src/auth/auth.middleware.ts`
  - `readUser` `:20-42`: ไม่มี header → `undefined` · รูปแบบ `Bearer <token>` ผิด → 401 · `tokens.verify` ล้ม → 401 · `sub` ไม่ใช่ข้อความ/`role` ไม่ใช่บทบาทจริง → 401
  - `optionalAuth` `:49-57` (ไม่มี token = guest · token เสีย = 401) · `requireAuth` `:59-68` · `requireAdmin` `:70-80` (ไม่ใช่ admin → 403 `FORBIDDEN`)
  - `TokenService.verify` `auth/token.ts:37-40` บังคับ `algorithms: ['HS256']`
- **`GET /auth/me`:** `AuthService.me` `auth.service.ts:66-72` → `UsersStore.findById` (SELECT ที่ `users.store.ts:61`) ไม่พบ → 401

### 4) Database
- อ่านตาราง `users` อย่างเดียว:
```sql
SELECT id, email, password_hash, display_name, role, UNIX_TIMESTAMP(created_at) AS created_epoch
  FROM users WHERE email = ? LIMIT 1      -- users.store.ts:37-39, :56
```
- **ไม่มีตาราง session ของการล็อกอิน** JWT ไม่ถูกเก็บในฐานข้อมูล

### 5) Response
```json
// 200 POST /auth/login  (shape เดียวกับ register)
{ "accessToken": "<JWT>", "user": { "id": "...", "email": "...", "displayName": "...", "role": "user", "createdAt": "..." } }
// 401 รหัสผ่านผิด
{ "statusCode": 401, "code": "INVALID_CREDENTIALS", "message": "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }
```
payload ใน JWT มีแค่ `sub` (user id), `role`, `iat`, `exp` (`token.ts:32-34`)

### 6) ข้อสังเกต
- **ไม่มี logout ฝั่งเซิร์ฟเวอร์:** token ยังใช้ได้จนหมดอายุ (7 วัน) แม้กดออกจากระบบ (ข้อจำกัดที่ยอมรับ)
- token ใน `localStorage` อ่านได้ด้วยสคริปต์ในหน้า ถ้าเว็บมีช่องโหว่ XSS (หัวไฟล์ `authStorage.ts:4-7` ระบุไว้เอง)
- `role` ใน token เชื่อตามที่ออก ไม่ query DB ทุกคำขอ เปลี่ยน role แล้วต้องรอ token เก่าหมดอายุ (`/auth/me` เท่านั้นที่อ่าน DB)
- `AdminRoute` ฝั่งหน้าจอเป็น UX อย่างเดียว (`AdminRoute.tsx:16-17`) ตัวบังคับจริงคือ `requireAdmin`

---

# ช่วงที่ 3: เลือก/กรอกเครื่อง (ประเภท → รุ่น) และไปหน้าเลือกอาการ

### 1) ภาพรวม
ผู้ใช้เลือก "ประเภทเครื่อง" แล้ว "รุ่น" (หรือกด "ฉันไม่ทราบรุ่น") ระบบโหลดรายการรุ่นจาก `GET /traversal/manuals` แล้วพาไปหน้าเลือกอาการของรุ่นนั้น · **ไม่มีช่องกรอก brand/device แบบอิสระ** brand มากับรุ่น ส่วนช่อง "พิมพ์เลขรุ่นเพื่อกรอง" กรองรายการที่ได้มาแล้วฝั่งหน้าจอ

### 2) Frontend
- **หน้า:** `pages/DevicesPage.tsx` (route `/devices` — `App.tsx:42`) · ทางเข้า: ปุ่ม "เลือกเครื่องที่มีปัญหา" `pages/HomePage.tsx:17` และเมนู `AppShell.tsx:28`
- **hook:** `useManuals()` `api/queries.ts:70-72` (`staleTime: Infinity`) → `listManuals()` `api/traversal.ts:24-26`
- **ขั้น 1 (ประเภทเครื่อง):** `CategoryStep` `DevicesPage.tsx:71-93` ปุ่มการ์ด `:81` → `onPick` → `setParams({ category })` `:61`
- **ขั้น 2 (รุ่น):** `ModelStep` `:95-157`
  - ช่องกรองเลขรุ่น `:119` (`manualMatches` `lib/models.ts:22-24` — กรองฝั่งหน้าจอด้วย pattern + alias)
  - ปุ่ม "ฉันไม่ทราบรุ่น" `:151-153` สลับ `isUnknown` · เมื่อ unknown แสดงคำเตือน `:123-127`
  - เลือกรุ่น: `pick(manual)` `:104-106` → `navigate(symptomsPath(manualId, isUnknown ? 'unknown' : 'selected'))` (`lib/modelSelection.ts:17-21` → `/symptoms?manual=...[&unknown=1]`)
- **เก็บรุ่นที่เลือก:** ใน URL query (`?manual=`, `unknown=1`) อ่านด้วย `useChosenModel()` `lib/modelSelection.ts:9-14` (ไม่มี store)
- **API:** `GET /traversal/manuals` ไม่มี body ไม่ต้องล็อกอิน

### 3) Backend
- **Router / route handler:** `traversal.routes.ts:32-34` `router.get('/manuals', ...)` (ไม่มี auth middleware) → `TraversalService.listManuals` `traversal.service.ts:48-50` → `GraphRepository.listManuals` `traversal/graph.repository.ts:99-118`
- **ไม่มี SQL ตอนรับคำขอ:** อ่านจากหน่วยความจำ (`Map` ที่โหลดตอนบูต) `listManuals` รวมผังเป็นรุ่น: นับ `graphCount`, แนบ `displayName`/`modelAliases` จาก `manualExtras`
- **ข้อมูลโหลดตอนบูต** (`graphs.load()` `app.ts:58` → `GraphRepository.loadAll` `graph.repository.ts:120-172`):
```sql
-- graph.repository.ts:121-129
SELECT g.graph_id, g.manual_id, g.entry_symptom, g.entry_symptom_th, g.entry_symptom_aliases,
       g.source, g.page_start, g.page_end, g.source_chunk_id, g.entry_node,
       m.device_category, m.brand, m.model_pattern, m.display_name, m.model_aliases
  FROM graphs g JOIN manuals m ON m.manual_id = g.manual_id ORDER BY g.graph_id
-- graph.repository.ts:133-138
SELECT graph_id, node_id, node_type, text_content, on_yes, on_no, next_node, on_invalid,
       input_type, input_pattern, store_as, outcome_kind, safety_critical, safety_warning
  FROM nodes ORDER BY graph_id, display_order
```
- **ทางเลือก "อาการทั้งหมด":** `pages/AllSymptomsPage.tsx` → `useGraphs(manualId)` `queries.ts:61-67` → `GET /traversal/graphs?manualId=` `api/traversal.ts:19-22` → `traversal.routes.ts:27-29` (`parseOptionalManualId` `traversal.dto.ts:66`) → `TraversalService.listGraphs` `traversal.service.ts:42-45` → `GraphRepository.listAll` `graph.repository.ts:87-97`

### 4) Database
- **ตารางที่อ่านตอนบูต:** `graphs`, `manuals`, `nodes` (migration `002_graphs.sql`) และ `equipment`, `equipment_usage` (migration `003_equipment.sql` — โหลดที่ `traversal/equipment.repository.ts:31-37`)
- **ระหว่างใช้งานไม่แตะ DB** สำหรับขั้นนี้

### 5) Response
```json
// GET /traversal/manuals
[ { "manualId": "samsung_...", "deviceCategory": "microwave", "brand": "Samsung", "modelPattern": "GE83MDT...",
    "displayName": "...", "modelAliases": ["..."], "graphCount": 21 } ]
```
หน้าจอ: การ์ดรุ่นแสดง `brand + manualTitle(manual)` และ `{graphCount} อาการ` (`DevicesPage.tsx:139-141`)

### 6) ข้อสังเกต
- ขั้น "ไม่ทราบรุ่น" ระบบ **ไม่เลือกให้** ผู้ใช้เลือกรุ่นใกล้เคียงเอง และบันทึก `modelSelection='unknown'` ไว้แยกเคสตอนวัดผล (`SessionPage.tsx:155-157` แสดงคำเตือนซ้ำ)
- รายการเปลี่ยนเฉพาะตอน seed/publish แล้ว `invalidateQueries(['manuals'])` (`queries.ts:318-321`) จึงตั้ง `staleTime: Infinity` ได้
- "device/brand/model" ที่โจทย์ว่า ไม่มีช่องกรอกอิสระ: ประเภทเครื่องเป็นตัวเลือกคงที่ (`lib/labels.ts` — `DEVICE_CATEGORIES`) ยี่ห้ออยู่ในข้อมูลคู่มือ

---

# ช่วงที่ 4: พิมพ์อาการ → ค้นหา (แทน "RAG Pipeline") → เลือกผัง → เริ่มตรวจ

### 1) ภาพรวม
ผู้ใช้พิมพ์อาการ → `POST /symptom-search` → backend แปลงข้อความเป็นเวกเตอร์ แล้วเทียบ cosine กับเวกเตอร์ของชื่ออาการทุกผังในหน่วยความจำ → คืน ≤ 3 ผังที่คะแนน ≥ 0.55 → ผู้ใช้เลือกเอง → `POST /traversal/sessions` เริ่มเดินผัง **ไม่มีการสร้างคำตอบด้วย LLM**

### 2) Frontend
- **หน้า:** `pages/SymptomsPage.tsx` (route `/symptoms` — `App.tsx:43`)
- **ฟอร์ม:** `components/SymptomSearchForm.tsx` `<form onSubmit>` `:24` · ช่องพิมพ์ `:29` (`maxLength` = `MAX_QUERY_LENGTH` 200) · ปุ่ม "ค้นหา" `:30-32` (ปิดเมื่อ `checkText(value, MAX_QUERY_LENGTH) !== 'ok'` `lib/textInput.ts:10-15`)
- **handler:** `handleSearch` `SymptomsPage.tsx:28-31` → `search.mutate({ query: query.trim(), manualId })`
- **hook:** `useSymptomSearch()` `api/queries.ts:141-145` (`useMutation` ไม่แคชโดยตั้งใจ `:134-140`)
- **API client:** `api/traversal.ts:47-52` `searchSymptoms` · `POST /symptom-search` body `{ "query": "ไมโครเวฟไม่ร้อน", "manualId": "samsung_..." }`
- **แสดงผลค้นหา:** `components/SymptomSearchResults.tsx` — ไม่มีผล (`matches.length===0`) `:13-19` แสดง "ไม่พบอาการที่ใกล้เคียง… แนะนำให้ติดต่อศูนย์บริการ Samsung" · มีผล `:21-32` แต่ละแถว `components/SymptomRow.tsx` (ชื่ออาการ `:25`, **คะแนนความคล้าย** `:28-33`)
- **เลือกผล → เริ่มตรวจ:** `SymptomRow.tsx:23` onClick → `onSelect(graphId)` → `SymptomsPage.tsx:83` → `start(graphId, { query, manualId, modelSelection })` `lib/useStartSymptom.ts:27-33` → `useStartSession()` `queries.ts:171-176` → `startSession` `api/traversal.ts:37-44` · `POST /traversal/sessions` body `{ graphId, query, manualId, modelSelection }` + `headers: ownerHeaders()` (`lib/clientHeaders.ts:12-14`: ล็อกอิน → ไม่ส่ง `X-Client-Id` / guest → ส่ง UUID จาก `lib/clientId.ts:34-53`)
- สำเร็จ → `navigate('/session/:id')` (`useStartSymptom.ts:31`) · ผลถูกใส่ในแคชก่อน (`queries.ts:154-160`) หน้าตรวจเปิดมาพร้อมข้อมูลโดยไม่ยิงซ้ำ

### 3) Backend

#### 3.1 ค้นอาการ
- **Router / route handler:** `symptom-search/symptom-search.routes.ts:9-13` `POST /symptom-search` (ไม่มี auth middleware) ตอบ 200 · `GET /symptom-search/status` `:15-17`
- **Validation (`parse*` ใน `*.dto.ts` เรียกใน handler):** `parseSearchBody` `symptom-search.dto.ts:14` (`query` trim ไม่ว่าง ≤ 200, `manualId` ไม่บังคับ ≤ 80) ผิด → `400 INVALID_QUERY`
- **Service:** `SymptomSearchService.search` `symptom-search/symptom-search.service.ts:160-192`
  1. ยังโหลดโมเดล → `503 SEARCH_NOT_READY` `:161` · ไม่พร้อม/ปิด → `503 SEARCH_UNAVAILABLE` `:162`
  2. `embedding.embed(query)` `:164` → `EmbeddingService.embed` `embedding/embedding.service.ts:46-55` (mean pooling + normalize, 384 มิติ)
  3. **กรองด้วย manualId (ในหน่วยความจำ ไม่ใช่ SQL)** `:165-168`
  4. `rankGraphs` `symptom-matcher.ts:64-88`: cosine `:20-41` กับทุกข้อความ เก็บ "คะแนนสูงสุดต่อผัง" เรียงมาก→น้อย
  5. `selectMatches(ranked, 0.55, 3)` `:172` (`MATCH_THRESHOLD` `:11`, `MAX_RESULTS` `:12`; `symptom-matcher.ts:90-96`) → เทียบเกณฑ์ด้วยค่าเต็ม แล้วปัดเศษ 3 ตำแหน่งตอนส่งออก (`round3` `:180`)
- **การโหลด embeddings เข้า memory ตอน server start:**
  - `app.ts:60` `symptomSearch.start()` (ไม่รอ) → `symptom-search.service.ts:45-54` (ต้องตั้ง `SYMPTOM_SEARCH_ENABLED=true`) → `prepareIndex` `:56-102`: `embedding.load()` `:62` (โหลดโมเดลจาก `backend/model`, `allowRemoteModels=false` `embedding.service.ts:23-34`) → `buildSymptomTexts` `symptom-matcher.ts:43-62` (ข้อความ = `entry_symptom_th`, `entry_symptom`, aliases) → `embed` ทีละข้อความ (ข้อความซ้ำใช้เวกเตอร์เดียวกัน `:78-88`) → เก็บใน `this.index` `:90`
  - **กลไก reload หลัง ingest:** admin publish ผังใหม่ → `drafts.service.ts:199` `graphRepository.reload()` (`graph.repository.ts:179-182`) → `drafts.service.ts:205` `symptomSearch.addGraphs(graphIds)` (`symptom-search.service.ts:112-158` embed เฉพาะผังใหม่ แล้วสลับดัชนีในครั้งเดียว) · ผังที่ seed ด้วย `seed-graphs.js` ต้อง **รีสตาร์ต backend** (ไม่มีทาง reload จากสคริปต์ — ค้นแล้วไม่พบ endpoint reload)
- **Top-K / threshold:** K = 3, threshold = 0.55 (**ไม่ทราบเหตุผลที่เลือกค่าเหล่านี้** ไม่ได้ระบุในโค้ด)

#### 3.2 เริ่ม session
- **Router / route handler:** `traversal.routes.ts:40-48` `POST /traversal/sessions` (`optionalAuth`) ตอบ **201** · เจ้าของ: `resolveOptionalOwner` `auth/session-owner.ts:14-23` (ล็อกอิน → `{kind:'user'}` / ไม่ล็อกอิน + `X-Client-Id` → guest / ไม่ส่งอะไรเลย → ไม่มีเจ้าของ)
- **Validation (`parse*` ใน `*.dto.ts` เรียกใน handler):** `parseStartSessionBody` `traversal.dto.ts:92-117` (`graphId` บังคับ, `query`, `manualId`, `modelSelection` ไม่บังคับ)
- **Service:** `TraversalService.startSession` `traversal.service.ts:56-73`
  - `requireGraph` `:63` → ไม่พบ `404 GRAPH_NOT_FOUND`
  - `manualId` ไม่ตรงผัง → `400 GRAPH_MANUAL_MISMATCH` `:64-66`
  - `computeConfidence` `:186-193` → `symptomSearch.scoreGraph(query, graphId)` `symptom-search.service.ts:193-199` (**embed คำค้นอีกครั้ง** แล้ว rank ทุกผัง เพื่อหาคะแนนของผังที่เลือก)
  - `engineStartSession(graph, confidence)` `traversal-engine/traversal-engine.ts:4-24` (สร้าง `sessionId` ด้วย `crypto.randomUUID()` โหนดแรก = `entry_node`)
  - `sessionStore.create(...)` `:70`
- **Store/Repository + SQL:** `SessionStore.create` `traversal/session.store.ts:38-57`
```sql
INSERT INTO sessions
  (session_id, graph_id, current_node_id, status, variables, confidence, model_selection, client_id, user_id, expires_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW() + INTERVAL ? HOUR)   -- 24 ชั่วโมง (SESSION_TTL_HOURS)
```
- **การสร้าง prompt ส่ง LLM / parse คำตอบ ในช่วงนี้: ไม่พบ / ไม่ implement** ค้นแล้วใน `symptom-search/`, `traversal/` ไม่มีการเรียก LLM ตอนค้นหาหรือเริ่ม session LLM ถูกเรียกที่ (ก) `rephrase.service.ts:35-62` ผ่าน `traversal.service.ts:174-184` ตอนประกอบ response (ดูช่วง 5) และ (ข) `authoring/` (ฝั่ง admin)

### 4) Database
- **อ่าน:** ไม่มี (ค้น/จับคู่ทั้งหมดในหน่วยความจำ)
- **เขียน:** `sessions` 1 แถว (migration `004_sessions.sql:17-55`): `session_id` PK, `graph_id` FK→`graphs`, `current_node_id`, `status ENUM('in_progress','completed')`, `variables JSON`, `confidence DECIMAL(4,3) NULL` (คะแนน cosine ของผังที่เลือก), `model_selection ENUM('selected','unknown') NULL`, `client_id`/`user_id` (เจ้าของแบบใดแบบหนึ่ง), `expires_at`

### 5) Response
```json
// POST /symptom-search → 200
{ "query": "ไมโครเวฟไม่ร้อน", "threshold": 0.55, "bestScore": 0.845,
  "matches": [ { "graphId": "...", "entrySymptom": "...", "entrySymptomTh": "...", "deviceCategory": "microwave", "score": 0.845, "matchedText": "..." } ] }
// POST /traversal/sessions → 201 (รูปเดียวกับ GET /traversal/sessions/:id ดูช่วง 5)
```
กรณี **confidence ต่ำ/ไม่พบ:** `matches: []` → หน้าจอแสดง "ไม่พบอาการที่ใกล้เคียง… ระบบไม่เดาอาการให้… แนะนำให้ติดต่อศูนย์บริการ Samsung" (`SymptomSearchResults.tsx:13-19`) พร้อมทางเลือก "ดูอาการทั้งหมด" `SymptomsPage.tsx:88-93`

### 6) ข้อสังเกต
- "confidence" คือ **คะแนนความคล้ายของข้อความ ไม่ใช่ความน่าจะเป็นที่ถูกต้อง** หน้าจอบอกไว้ชัด (`SymptomSearchResults.tsx:24`, `SessionHeader.tsx:36`) และ `formatScore` ไม่แปลงเป็น % (`textInput.ts:22-24`)
- เกณฑ์ 0.55 เป็น "ตัดสินรายการที่จะเสนอ" ไม่ใช่ตัวสั่งให้ตอบ/ไม่ตอบ ผู้ใช้ยังเลือกจาก "อาการทั้งหมด" ได้เสมอ (ตั้งใจ)
- `scoreGraph` embed คำค้นซ้ำ (ครั้งที่สองหลังค้น) และ rank ทั้งดัชนีเพียงเพื่อดึงคะแนนผังเดียว ทำงานซ้ำซ้อน แต่เล็กน้อย (ข้อสังเกตจากโค้ด ไม่ได้วัด)
- ข้อความ "ติดต่อศูนย์บริการ **Samsung**" ตายตัวในหน้าจอ `SymptomSearchResults.tsx:16` (ข้อมูลที่ seed ตอนนี้เป็น Samsung ตามชื่อไฟล์ `data/manuals/samsung_*.json` ถ้าเพิ่มยี่ห้ออื่นข้อความจะไม่ตรง)
- ถ้า `SYMPTOM_SEARCH_ENABLED` ไม่ใช่ `true` ค้นหาตอบ 503 และหน้าจอใช้กล่องสีฟ้า (`SymptomsPage.tsx:31`, `:102-111`) ผู้ใช้ยังใช้ "อาการทั้งหมด" ได้
- ผังของ session ที่เริ่มแล้ว อยู่ในหน่วยความจำของ instance เดียว ถ้า deploy หลาย instance ต้อง reload แยก (ข้อสังเกต ไม่ได้ตรวจการ deploy)

---

# ช่วงที่ 5: แสดงผลขั้นตอน/คำตอบ (Problem / Cause / Confidence / Solution / Safety / References)

### 1) ภาพรวม
หน้า `/session/:id` แสดงขั้นปัจจุบันของผัง ผู้ใช้ตอบ ใช่/ไม่ใช่ / กดถัดไป / ยืนยันความปลอดภัย / กรอกรหัส → ส่ง action → backend ให้ engine ตัดสินขั้นถัดไป ตอบ session ใหม่กลับมา **ขั้นถัดไปตัดสินโดยโค้ด (engine) เสมอ ไม่ผ่าน LLM**

### 2) Frontend
- **หน้า:** `pages/SessionPage.tsx` (route `/session/:sessionId` — `App.tsx:47`)
- **โหลดข้อมูล:** `useSession(sessionId)` `queries.ts:80-83` (ปกติอ่านจากแคชที่ใส่ไว้ตอนเริ่ม ไม่ยิงซ้ำ; เปิดลิงก์ตรง/F5 → `GET /traversal/sessions/:id` `api/traversal.ts:54-56`)
- **ส่วนที่แสดง** (`SessionPage.tsx:149-176`):
  | หัวข้อในโจทย์ | component / ที่แสดง | ที่มาของข้อมูล |
  |---|---|---|
  | **Problem** (อาการ) | `SessionHeader.tsx:19` `<h1>{symptomName(summary)}</h1>` + ยี่ห้อ/รุ่น `:22-27` | `graphs` ที่โหลดไว้ (`SessionPage.tsx:42`) |
  | **Possible Cause** | **ไม่พบ / ไม่ implement** (ค้น "possible_cause" / "สาเหตุ" ใน `backend/src` และ `frontend/src` ไม่พบ ผังไม่มีฟิลด์นี้ หัวไฟล์ `HistoryDetailPage.tsx:28` ระบุว่าตั้งใจไม่ใส่) | – |
  | **Confidence** | `SessionHeader.tsx:34-38` "คะแนนความคล้ายกับที่พิมพ์ค้นหา 0.812 (แสดงเป็นข้อมูลประกอบเท่านั้น)" (ซ่อนถ้า `null`) | `session.confidence` |
  | **Solution** (ขั้นตอน) | `components/step/StepView.tsx:24-44` เลือกหน้าตาตามชนิดโหนด: `CheckpointStep` `:47-60` (ปุ่ม ใช่/ไม่ใช่ `:51-56`), `InstructionStep` `:63-71` (ปุ่ม ถัดไป `:66-68`), `InputStep.tsx:11-38`, `OutcomeStep.tsx:28-48` (ข้อสรุป) | `session.node` (`RenderedNode`) |
  | **Safety** | `SafetyGateStep.tsx:8-36`: กล่องแดงคำเตือน `:16-18` + ช่องติ๊กยืนยัน `:26-27` + ปุ่ม "ยืนยันและทำขั้นตอนนี้" `:30-32` (ปิดจนกว่าจะติ๊ก) · ฝั่ง engine บังคับด้วย (ดูล่าง) | `node.safetyWarning`, `requiresSafetyConfirmation` |
  | **References** | `step/ReferenceLine.tsx:23-36` "ที่มาของขั้นตอนนี้: คู่มือ {ยี่ห้อ รุ่น} หน้า 12–14" + ปุ่ม "ดูรหัสเอกสาร" ติดท้าย **ทุกขั้น** ผ่าน `StepCard.tsx:37` | `node.reference` |
  | อุปกรณ์ที่ต้องใช้ | `EquipmentPanel.tsx:31-70` | `session.equipment` |
  | ข้อความที่ปรับถ้อยคำด้วย AI | `RephraseNote.tsx` (ปุ่มดูต้นฉบับ) `SessionPage.tsx:173` | `session.displayText` |
- **ส่ง action:** `handleAction` `SessionPage.tsx:50-61` → `useSubmitAction(sessionId)` `queries.ts:179-184` → `submitAction` `api/traversal.ts:58-66` · `POST /traversal/sessions/:id/actions` body ตัวอย่าง `{ "type":"answer", "value":"yes" }` | `{ "type":"continue" }` | `{ "type":"confirm_safety" }` | `{ "type":"input", "value":"E4" }` ผลใส่แคชเลย (`onSuccess: useCacheSession`)
- **เส้นทางที่ผ่านมา:** `PathRail` (`SessionPage.tsx:162`, `lib/trail.ts:12` `toTrailEntry`) สะสมใน state `trail` `:45`, `:56`

### 3) Backend
- **Router / route handler:** `traversal.routes.ts:51-57` `GET /sessions/:id` · `:60-67` `POST /sessions/:id/actions` ตอบ **201** (ทั้งสองใช้ `optionalAuth`)
- **Validation (`parse*` ใน `*.dto.ts` เรียกใน handler):** `parseTraversalAction` `traversal.dto.ts:119` (`type` ∈ answer/continue/confirm_safety/input; `answer` ต้อง yes/no; `input` ≤ 255)
- **Service (`traversal.service.ts`):**
  - `submitAction` `:88-106`: `authorize` `:93` → `requireSession` `:94` → `requireGraph` `:95` → **`engineSubmitAction(session, graph, action)` `:97`** → `sessionStore.update(...)` `:100-103` (บรรทัด 99 คอมเมนต์ "ถึงตรงนี้ engine อนุมัติแล้ว" — ถ้า engine โยน error บรรทัด update ไม่ถูกรัน) → `toResponse` `:105`
  - `getSession` `:76-85`
  - `toResponse` `:156-172`: ประกอบ `{ sessionId, graphId, status, node, equipment (หน่วยความจำ: equipmentRepository.findByCategory), confidence, outcome, displayText }`
  - `displayTextOf` `:174-184` เรียก `rephrase.rephrase(node.text, {nodeType, safetyCritical})` ล้ม → `null`
- **Engine** `traversal-engine/traversal-engine.ts`: `submitAction` `:41-72` → `resolveNextNode` `:74-125`:
  - `checkpoint`: ต้องเป็น `answer` → `on_yes`/`on_no` `:80-88`
  - `instruction`: ถ้า `safety_critical` — ส่ง `continue` → **`SafetyConfirmationRequiredError`** (400 `SAFETY_CONFIRMATION_REQUIRED` ผ่าน `ENGINE_ERRORS` `common/error-handler.ts:38-43`) `:91-94` ต้องส่ง `confirm_safety` ตรงๆ
  - `input`: ตรวจ `pattern` ผ่าน → เก็บค่าใน `variables[store_as]` ไม่ผ่าน → `on_invalid` `:104-119`
  - ถึง `resolution`/`escalation` → `status = 'completed'` `:61`
  - `renderNode` `:126-148`: ประกอบ `text` (แทน `{{ตัวแปร}}` `:168-172`), `requiresSafetyConfirmation`, `reference = { source, pageRange }` `:131-134`, `isTerminal`, `outcomeKind`
- **Rephrase (LLM ปรับถ้อยคำ):** `rephrase/rephrase.service.ts:35-62` — ข้าม safety/โหนดจบ `:40`, timeout 3 วินาที `:46`, ผ่านด่านตรวจ `checkRephrase` `rephrase-guard.ts:26-61`; prompt (`groq-llm.client.ts:5-11`) ห้ามเปลี่ยนความหมาย/ตัวเลข; เรียก Groq `:20-44`

```sql
-- SessionStore.find   session.store.ts:60-64   (ใช้ใน getSession/submitAction)
SELECT session_id, graph_id, current_node_id, status, variables, confidence
  FROM sessions WHERE session_id = ? AND expires_at > NOW()
SELECT node_id, action_type, action_value FROM session_history WHERE session_id = ? ORDER BY step_order  -- :71-75
-- SessionStore.findUserId  session.store.ts:144-148  (authorize)
SELECT user_id FROM sessions WHERE session_id = ? AND expires_at > NOW()
```

### 4) Database
- อ่าน `sessions`, `session_history` (migration `004_sessions.sql:17-77`)
- ผังและโหนดมาจากหน่วยความจำ ไม่ query ต่อคำขอ

### 5) Response
```json
// GET /traversal/sessions/:id  หรือ POST /actions → 200/201
{ "sessionId": "uuid", "graphId": "...", "status": "in_progress",
  "node": { "nodeId": "n3", "type": "instruction", "text": "ถอดปลั๊ก…", "safetyCritical": true,
            "safetyWarning": "…", "requiresSafetyConfirmation": true, "isTerminal": false,
            "reference": { "source": "…คู่มือ…", "pageRange": [12, 13] } },
  "equipment": [ { "equipmentId": "…", "nameTh": "…", "purposeTh": "…", "sourcePage": 5 } ],
  "confidence": 0.812, "outcome": null, "displayText": null }
```
ข้อผิดพลาดที่พบบ่อย: `400 SAFETY_CONFIRMATION_REQUIRED`, `400 INVALID_ACTION`, `409 SESSION_COMPLETED`, `404 SESSION_NOT_FOUND`

### 6) ข้อสังเกต
- **ด่านความปลอดภัยบังคับทั้งสองฝั่ง:** หน้าจอ (ติ๊กก่อนกด) และ engine (ไม่ยอมรับ `continue` ที่โหนด safety `traversal-engine.ts:91-94`) แม้เรียก API ตรงก็ข้ามไม่ได้
- **guest session ไม่ถูกตรวจ owner ที่ GET/actions/outcome:** `authorize` `traversal.service.ts:138-143` เช็กเฉพาะกรณีที่ session มี `user_id` เท่านั้น ถ้าเป็น session ของ guest (`user_id` เป็น NULL) ใครรู้ `sessionId` (UUID) ก็อ่าน/เดิน/บันทึกผลได้ มีเฉพาะ `DELETE` และ `/history` ที่ตรวจ `client_id` (ข้อสังเกตจากการอ่านโค้ด ไม่ได้ทดสอบ)
- ผู้แพ้ในการส่ง action พร้อมกันบน session เดียว ได้ **500** แทน 409 (UNIQUE `uq_history_step` ใน `session_history` ชน แล้ว error ของ MySQL ไม่ได้ห่อเป็น `ApiError`) — ข้อจำกัดที่บันทึกไว้แล้วใน STUDY_GUIDE (ไม่ได้ทดสอบ)
- LLM ที่ `displayTextOf` ถูกเรียก **ทุกครั้งที่ประกอบ response** (แคชผลที่ผ่านในหน่วยความจำ `rephrase.service.ts:27`, `:42-43`) ล้ม/ช้า → ใช้ข้อความต้นฉบับ

---

# ช่วงที่ 6: บันทึกประวัติ (chat / session / message / references ถูก INSERT ที่ไหน)

### 1) ภาพรวม
**ไม่มีตาราง chat/message/references** ระบบบันทึก (ก) แถว `sessions` ตอนเริ่ม (ข) แถว `session_history` ทุกครั้งที่ส่ง action (ค) ข้อความผลลัพธ์ที่ผู้ใช้พิมพ์เองหลังจบ (`sessions.outcome_text`) "references" ไม่ถูกบันทึกต่อ session แต่คำนวณจากผังตอนอ่าน (`renderNode` `traversal-engine.ts:131-134`)

### 2) Frontend
- **ไม่มีปุ่ม "บันทึก" ของประวัติ** บันทึกอัตโนมัติจากการใช้งาน
- **ปุ่มบันทึกข้อความผลลัพธ์ (ไม่บังคับ):** `components/OutcomeForm.tsx` — ฟอร์ม `:52-87`, ปุ่ม "บันทึกผล" `:83-85`, `handleSubmit` `:46-50` → `onSubmit` = `handleOutcome` `SessionPage.tsx:63-72` → `useSubmitOutcome(sessionId)` `queries.ts:192-197` → `submitOutcome` `api/traversal.ts:68-73` · `POST /traversal/sessions/:id/outcome` body `{ "text": "ทำตามแล้วหาย" }` · แสดงเมื่อถึงโหนดจบเท่านั้น (`StepView.tsx:27-29` → `OutcomeStep` `:44`) · บันทึกได้ครั้งเดียว (หลังบันทึกเปลี่ยนเป็นข้อความอ่านอย่างเดียว `OutcomeForm.tsx:32-41`)
- **ปุ่มยกเลิกระหว่างเดิน:** "ยกเลิกการตรวจ" `SessionHeader.tsx:28-32` → `handleAbandon` `SessionPage.tsx:74-76` → `useAbandonSession` `queries.ts:203-212` → `DELETE /traversal/sessions/:id` `api/traversal.ts:75-81` (แนบ `ownerHeaders()`)

### 3) Backend
- **สร้าง session:** `SessionStore.create` (ดูช่วง 4) · **ทุกขั้น:** `SessionStore.update` `session.store.ts:89-142` — transaction เดียว:
```sql
-- session.store.ts:106-112
UPDATE sessions SET current_node_id = ?, status = ?, variables = ?, expires_at = NOW() + INTERVAL ? HOUR
 WHERE session_id = ?
-- session.store.ts:122-125
INSERT INTO session_history (session_id, step_order, node_id, action_type, action_value)
VALUES (?, ?, ?, ?, ?)
```
  `ttlHours`: เดินอยู่ 24 ชั่วโมง (ต่ออายุทุกขั้น) · **จบแล้ว 90 วัน** (`session.store.ts:8-10`, `:99-100`)
- **บันทึกผลลัพธ์:** `routes :70-77` → `parseOutcomeBody` `traversal.dto.ts:166` → `TraversalService.submitOutcome` `:116-136` (ต้อง `status==='completed'` ไม่งั้น `409 SESSION_NOT_COMPLETED` `:125-127`; ซ้ำ → `409 OUTCOME_ALREADY_SUBMITTED` `:129-132`) → `SessionStore.saveOutcome` `:171-182`:
```sql
UPDATE sessions SET outcome_text = ?, outcome_at = NOW()
 WHERE session_id = ? AND status = 'completed' AND outcome_text IS NULL    -- คำสั่งเดียว (atomic) ชนะได้คนเดียว
```
- **ยกเลิก:** `SessionStore.delete` `:161-169` (`DELETE FROM sessions WHERE session_id = ? AND ${ownerWhere} AND expires_at > NOW()`; `session_history`/`session_feedback` ถูกลบตามด้วย `ON DELETE CASCADE`)

### 4) Database
| ตาราง | คอลัมน์ที่เขียน | migration |
|---|---|---|
| `sessions` | ทั้งแถวตอน `create` · `current_node_id`, `status`, `variables`, `expires_at` ทุกขั้น · `outcome_text`, `outcome_at` ตอนบันทึกผล | `004_sessions.sql:17-55` |
| `session_history` | 1 แถวต่อ action: `step_order`, `node_id`, `action_type`, `action_value` · UNIQUE `(session_id, step_order)` กัน action ซ้อน | `004_sessions.sql:59-77` |

### 5) Response
`POST /outcome` → 200 ตอบ session เดิมพร้อม `outcome` ที่บันทึก (รูปเดียวกับช่วง 5) · `DELETE` → 204 ไม่มี body

### 6) ข้อสังเกต
- ผู้ใช้ **ไม่ได้เห็นปุ่ม "บันทึกประวัติ"** ประวัติเกิดเองถ้าเริ่มตรวจโดยมีเจ้าของ (token หรือ `X-Client-Id`) · `POST /sessions` ที่ไม่ส่งอะไรเลยสร้าง session ที่ไม่มีเจ้าของ จะไม่ปรากฏในประวัติใคร (`traversal.routes.ts:38`, `session-owner.ts:14-23`)
- ตั้งหมดอายุ 90 วันตอนจบ **ไม่มีงานลบแถวที่หมดอายุ** (ค้น cron/job ลบใน `backend/src` และ `scripts` ไม่พบ) แถวที่หมดอายุเพียงถูกกรองออกตอนอ่าน (`expires_at > NOW()`) ยังค้างในฐานข้อมูล
- ประวัติก่อนล็อกอิน (ผูก `client_id`) **ไม่ย้ายเข้าบัญชี** (หน้าจอบอกชัด `HistoryPage.tsx:67`, `:74-76`)

---

# ช่วงที่ 7: Repair History (หน้า list และหน้า detail)

### 1) ภาพรวม
หน้า `/history` แสดงการตรวจที่ **จบแล้ว** ของเจ้าของนั้น (user หรือ guest) ใหม่สุดก่อน หน้าละ 10 รายการ · หน้า `/history/:id` แสดงขั้นตอนที่เคยผ่าน ผลการตรวจ คำเตือน ที่มา และฟอร์มให้คะแนน

### 2) Frontend
- **หน้า list:** `pages/HistoryPage.tsx` (route `/history` — `App.tsx:45`; เมนู `AppShell.tsx:30`) · เลขหน้าอยู่ใน URL `?page=` `:24-28`, `:32` · `useHistory(page)` `queries.ts:91-98` (key มี identity ป้องกันปนผู้ใช้; `keepPreviousData`) → `listHistory` `api/history.ts:11-13` · **`GET /history?page=N`** + `headers: ownerHeaders()`
- แต่ละแถว: `components/history/HistoryRow.tsx:23-78` (ลิงก์ไปรายละเอียด `:32-35`, ปุ่มลบ `:59-61` → `DeleteConfirm` `:65-75` → `useDeleteHistory` `queries.ts:218-232`)
- **หน้า detail:** `pages/HistoryDetailPage.tsx` (route `/history/:sessionId` — `App.tsx:46`) · `useHistoryDetail` `queries.ts:101-104` → `getHistory` `api/history.ts:16-18` · **`GET /history/:id`**
- ส่วนที่แสดง: คำเตือนความปลอดภัย `:122-130`, ผลการตรวจ + ที่มา `:132-149`, ความมั่นใจ `:151-163`, ขั้นตอนที่ผ่านมา `:165-183`, ผลที่ผู้ใช้บันทึก `:185-190`, ฟอร์มให้คะแนน `:192-199` (ดูช่วง 8), ปุ่ม "ตรวจอาการนี้อีกครั้ง" `:205-207` (`handleRestart` `:88-91`) และปุ่มลบ `:226-228`
- ผังเปลี่ยนไปแล้ว (`available:false`) → `Notice` "ผังขั้นตอนถูกเปลี่ยนหลังจากที่ตรวจ…" `:115-119`

### 3) Backend
- **Router / route handler:** `history/history.routes.ts:13-17` (list), `:20-24` (detail), `:34-39` (delete) — ทุกตัว `optionalAuth` + `resolveRequiredOwner(currentUser(request), request.headers['x-client-id'])` (ล็อกอิน → user; ไม่ล็อกอิน → `X-Client-Id` บังคับ ไม่มี → `400 INVALID_CLIENT_ID`)
- **Validation (`parse*` ใน `*.dto.ts` เรียกใน handler):** `parseHistoryQuery` `history.dto.ts:41` (`page` ≥ 1 ค่าเริ่มต้น 1; `pageSize` 1–50 ค่าเริ่มต้น 10 `:6-7`)
- **Service:** `history/history.service.ts`
  - `list` `:45-65`: `store.listCompleted` → เรียงใหม่สุดก่อน → แบ่งหน้าในหน่วยความจำ (หน้าเกิน → ดึงกลับหน้าสุดท้าย) → `toListItem` `:110-124` (ชื่ออาการ/รุ่นจากผังในหน่วยความจำ; ผังหาย → `graph:null`)
  - `detail` `:68-75` → `requireOwned` `:100-104` (ไม่ใช่ของเรา → `404 HISTORY_NOT_FOUND` ไม่ใช่ 403) → `store.findFeedback`, `store.findSteps` → `buildDetail` `:126-187`: ตรวจว่าผังเดิมยังพาไปถึงข้อสรุปเดิมด้วย `replayReaches` `:232-258` ถ้าไม่ → `available:false` (HTTP 200)
- **Store/Repository + SQL:** `history/history.store.ts`
```sql
-- listCompleted  :50-57   (ownerWhere = "(user_id = ?)" หรือ "(client_id = ? AND user_id IS NULL)")
SELECT session_id, graph_id, current_node_id, UNIX_TIMESTAMP(created_at) AS created_epoch
  FROM sessions
 WHERE ${where.sql} AND status = 'completed' AND expires_at > NOW()
 ORDER BY created_at DESC LIMIT ?          -- LIMIT = MAX_HISTORY_ROWS (=50)
-- findCompleted  :64-71
SELECT session_id, graph_id, current_node_id, variables, confidence, model_selection, outcome_text,
       UNIX_TIMESTAMP(created_at) AS created_epoch
  FROM sessions WHERE session_id = ? AND ${where.sql} AND status = 'completed' AND expires_at > NOW()
-- findSteps  :85-91
SELECT node_id, action_type, action_value FROM session_history WHERE session_id = ? ORDER BY step_order
-- findFeedback  :115-119
SELECT helpful, `comment` FROM session_feedback WHERE session_id = ?
-- deleteCompleted  :97-101
DELETE FROM sessions WHERE session_id = ? AND ${where.sql} AND status = 'completed' AND expires_at > NOW()
```
  `ownerWhere` / `ownerColumns` อยู่ที่ `auth/session-owner.ts:25-39`

### 4) Database
อ่าน `sessions`, `session_history`, `session_feedback` (+ผัง/คู่มือจากหน่วยความจำ) · ลบ: `sessions` (CASCADE ไปลบ `session_history`, `session_feedback`)

### 5) Response
```json
// GET /history?page=1
{ "items": [ { "sessionId": "...", "graphId": "...", "startedAt": "2026-10-22T03:00:00.000Z",
               "outcomeKind": "user_fixed", "graph": { "manualId": "...", "entrySymptom": "...", "deviceCategory": "microwave", "brand": "Samsung", "modelPattern": "..." } } ],
  "total": 12, "page": 1, "pageSize": 10, "totalPages": 2 }
// GET /history/:id → HistoryDetail  (available, steps[], finalNode, safetyWarnings[], reference, outcome, feedback)  — shape ที่ frontend/src/api/types.ts:214-233
```

### 6) ข้อสังเกต
- **เพดาน 50 รายการต่อผู้ใช้** (`MAX_HISTORY_ROWS` `history.store.ts:10`) รายการที่เก่ากว่าเปิดดู/ลบจากหน้ารายการไม่ได้ (ผู้พัฒนาตั้งใจลดจาก 500 เมื่อ 21 ต.ค.)
- guest ใช้ `client_id` จาก localStorage: ล้างข้อมูลเบราว์เซอร์ = ประวัติหาย (`lib/clientId.ts:7`) และใครรู้ id ก็เปิดประวัติ guest ของ id นั้นได้ (ไม่ใช่การยืนยันตัวตน)
- `available:false` เป็นวิธีรับมือเมื่อผังถูกแก้ แทนที่จะโชว์ขั้นเก่าคู่ข้อสรุปใหม่

---

# ช่วงที่ 8: Feedback (👍/👎 + ข้อความ)

### 1) ภาพรวม
ผู้ใช้ให้คะแนนผลการตรวจ **จากหน้ารายละเอียดประวัติ** (ไม่ใช่หน้าตรวจ) → `POST /history/:id/feedback` → UPSERT ที่ `session_feedback` → แสดง "บันทึกแล้ว" · ข้อมูลนี้ถูกอ่านใน Dashboard Analytics ของ admin

### 2) Frontend
- **ฟอร์ม:** `components/history/FeedbackButtons.tsx` ใช้ใน `HistoryDetailPage.tsx:192-199` (แสดงเมื่อ `data.available` เท่านั้น)
- **ปุ่ม:** 👍 "ช่วยได้" `FeedbackButtons.tsx:45-47` · 👎 "ไม่ช่วย" `:48-50` (เลือกบังคับ) · ช่องข้อความ (≤ 500 ตัว ไม่บังคับ) `:60-69` · ปุ่ม "บันทึก" `:78-80` (ปิดถ้ายังไม่เลือก/ไม่มีอะไรเปลี่ยน `:31-32`)
- **handler:** `handleSubmit` `:34-38` → `onSubmit(toFeedback(helpful, comment))` (`lib/textInput.ts:26-29` comment ว่างเป็น `null`) → `HistoryDetailPage.tsx:195` `feedback.mutate(value)`
- **hook:** `useSubmitFeedback(sessionId)` `queries.ts:238-249` (สำเร็จ → ใส่ค่าที่บันทึกลงแคชรายละเอียด → ขึ้น "บันทึกแล้ว" `FeedbackButtons.tsx:81-85`)
- **API:** `api/history.ts:29-35` · `POST /history/:id/feedback` body `{ "helpful": true, "comment": "ช่วยได้มาก" | null }`

### 3) Backend
- **Router / route handler:** `history.routes.ts:27-31` (`optionalAuth`; ตอบ 200 เพราะส่งซ้ำ = แก้ค่าเดิม)
- **Validation (`parse*` ใน `*.dto.ts` เรียกใน handler):** `parseFeedbackBody` `history.dto.ts:112` (`helpful` ต้องเป็น boolean จริง; `comment` ตัดช่องว่าง ≤ 500 ว่าง→`null`) ผิด → `400 INVALID_FEEDBACK`
- **Service:** `HistoryService.saveFeedback` `history.service.ts:86-94` → `requireOwned` `:91` (session ต้องเป็นของผู้ขอ และจบแล้ว ไม่งั้น 404) → `store.saveFeedback`
- **Store/Repository + SQL:** `HistoryStore.saveFeedback` `history.store.ts:105-112`
```sql
INSERT INTO session_feedback (session_id, helpful, `comment`)
VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE helpful = VALUES(helpful), `comment` = VALUES(`comment`)
```

### 4) Database
- ตาราง `session_feedback` (`migrations/005_session_feedback.sql:10-22`): `session_id` PK+FK (`ON DELETE CASCADE`), `helpful TINYINT(1)` (1=👍, 0=👎), `comment TEXT NULL`, `created_at`, `updated_at` · 1 session = 1 แถว

### 5) Response
```json
// 200
{ "helpful": true, "comment": "ช่วยได้มาก" }
```
หน้าจอ: ปุ่มกลายเป็น "บันทึกแล้ว" และปุ่มบันทึกถูกปิด

### 6) ข้อสังเกต
- **ให้คะแนนได้เฉพาะหลังเข้าหน้ารายละเอียดประวัติ** (ไม่มีฟอร์มให้คะแนนที่หน้าจบการตรวจ `OutcomeStep`) ผู้ใช้ต้องกดเข้า `/history/:id` เอง (ข้อสังเกตจากการอ่าน `SessionPage.tsx`, `OutcomeStep.tsx`)
- ไม่มีผลต่อขั้นตอนหรือการตัดสินใดของระบบ ใช้เก็บไว้ประเมินเท่านั้น (`FeedbackButtons.tsx:19-22`)
- ความเห็นเป็นข้อความอิสระ อาจมีข้อมูลส่วนตัวปน หน้าจอเตือนผู้ใช้ `:57-59`

---

# ช่วงที่ 9: Dashboard Analytics (admin) และการใช้ feedback

### 1) ภาพรวม
ผู้ดูแลระบบเปิด `/admin/analytics` (สถิติรวม N วันล่าสุด) และ `/admin/feedback` (รายการความเห็น) · อ่านอย่างเดียว

### 2) Frontend
- **หน้า:** `pages/AdminAnalyticsPage.tsx` (route `/admin/analytics` ครอบ `AdminRoute` — `App.tsx:51-58`) เมนูผู้ดูแลแสดงเมื่อ `role==='admin'` (`AppShell.tsx:46`)
- **ปุ่มเลือกช่วง:** 7/30/90 วัน `AdminAnalyticsPage.tsx:47-57` → `setSearchParams({days})` · `useAdminSummary(days)` `queries.ts:121-128` → `getAdminSummary` `api/admin.ts:23-25` · **`GET /admin/analytics/summary?days=30`**
- **ที่ feedback ปรากฏ:** การ์ด "ความเห็น 👍 / 👎" `:92-96` และ "อัตราความพอใจ" `:97` (`formatPercent(feedback.satisfactionRate)`; `null` แสดง "-")
- **ส่วนอื่น:** `StatCard` `:84-102`, `DailyBars` `:118`, `BarList` ผลการตรวจ/ประเภทเครื่อง/อาการยอดนิยม `:120-142`
- **หน้าความเห็น:** `pages/AdminFeedbackPage.tsx` (`/admin/feedback`) ตัวกรอง 👍/👎 + ช่วงวันที่ `:50-92` → `useAdminFeedback` `queries.ts:111-118` → `GET /admin/feedback?helpful=&from=&to=&page=&pageSize=20` (`api/admin.ts:12-20`)

### 3) Backend
- **Router / route handler:** `admin/admin.routes.ts:24-31` (`/feedback`), `:34-41` (`/analytics/summary`) — ทั้งคู่ `requireAuth` → `requireAdmin` ก่อน (ไม่ใช่ admin: 401/403)
- **Validation (`parse*` ใน `*.dto.ts` เรียกใน handler):** `parseFeedbackQuery` `admin.dto.ts:122`, `parseSummaryQuery` `:140` (`days` 1–90 ค่าเริ่มต้น 30; วันที่ `YYYY-MM-DD` เวลาไทย)
- **Service:** `AdminService.feedback` `admin/admin.service.ts:30-49`, `summary` `:52-134` (ยิง 5 query พร้อมกัน `Promise.all` `:57-63`; `satisfactionRate = helpful/total` หรือ `null` ถ้า total=0 `:123`)
- **Store/Repository + SQL:** `admin/admin.store.ts`
```sql
-- feedbackTotals  :142-144     (ที่ analytics ใช้อ่าน feedback)
SELECT COUNT(*) AS total, SUM(helpful = 1) AS helpful_count
  FROM session_feedback
 WHERE UNIX_TIMESTAMP(created_at) >= ? AND UNIX_TIMESTAMP(created_at) < ?
-- listFeedback  :73-93  (รายการ; ตัวกรองต่อเป็น WHERE แบบ dynamic)
SELECT f.session_id, f.helpful, f.`comment`, UNIX_TIMESTAMP(f.created_at) AS created_epoch,
       UNIX_TIMESTAMP(f.updated_at) AS updated_epoch, s.graph_id,
       CASE WHEN s.user_id IS NOT NULL THEN 'user' WHEN s.client_id IS NOT NULL THEN 'guest' ELSE 'none' END AS owner_type
  FROM session_feedback f JOIN sessions s ON s.session_id = f.session_id
 [WHERE ...] ORDER BY f.created_at DESC, f.session_id LIMIT ? OFFSET ?
-- sessionTotals  :113-123  (นับ session/เจ้าของ/ค่าเฉลี่ย confidence)
SELECT COUNT(*) AS total, SUM(status='completed') AS completed,
       SUM(status='in_progress' AND expires_at > NOW()) AS in_progress,
       SUM(status='in_progress' AND expires_at <= NOW()) AS expired_unfinished,
       SUM(user_id IS NOT NULL) AS by_user, SUM(user_id IS NULL AND client_id IS NOT NULL) AS by_guest,
       SUM(user_id IS NULL AND client_id IS NULL) AS by_none, AVG(confidence) AS avg_confidence, COUNT(confidence) AS confidence_samples
  FROM sessions WHERE UNIX_TIMESTAMP(created_at) >= ? AND UNIX_TIMESTAMP(created_at) < ?
-- graphCounts :152-155, completedEndNodes :163-167, perDay :179-184  → อันดับอาการ, ผลการตรวจ, ยอดรายวัน
```

### 4) Database
อ่าน `session_feedback`, `sessions` · **ไม่แตะตาราง `users`** (ไม่ SELECT email/ชื่อ/user_id/client_id; รู้เจ้าของแค่ชนิด user/guest/none)

### 5) Response
```json
// GET /admin/analytics/summary?days=30 → 200
{ "window": { "days": 30, "from": "2026-09-23", "to": "2026-10-22" },
  "sessions": { "total": 40, "completed": 25, "inProgress": 3, "expiredUnfinished": 12, "byOwner": { "user": 10, "guest": 30, "none": 0 } },
  "feedback": { "total": 8, "helpful": 6, "notHelpful": 2, "satisfactionRate": 0.75 },
  "confidence": { "average": 0.79, "sampleSize": 20 },
  "outcomes": { "user_fixed": 15, "normal_behavior": 1, "handoff_informed": 8, "handoff_unknown": 1, "unknown": 0 },
  "topGraphs": [ { "graphId": "...", "entrySymptomTh": "...", "count": 7 } ], "topDevices": [ ... ], "perDay": [ { "date": "...", "started": 3, "completed": 2 } ] }
```

### 6) ข้อสังเกต
- feedback **ถูกใช้ในแดชบอร์ด** จริง (จำนวน 👍/👎 และ `satisfactionRate`) แต่ **ไม่ย้อนกลับไปปรับระบบ** (ไม่มีการเรียนรู้จาก feedback ในโค้ด)
- ตัวเลขนับจากตาราง `sessions` ซึ่ง **ใช้ร่วมกับโปรเจกต์เก่า** ตามคอมเมนต์เดิม `admin.service.ts` หัวไฟล์ (ผู้พัฒนาเคยยืนยันว่าฐานข้อมูลเก่าไม่ใช้แล้ว ข้อจำกัดนี้อาจเลิกเป็นจริง ยังไม่ได้ตรวจคอมเมนต์ให้ตรงกัน)
- ไม่มี dashboard ฝั่งผู้ใช้ทั่วไป (ค้นแล้ว มีเฉพาะ `/admin/*`)

---

# Sequence Diagram (ทั้ง flow)

```mermaid
sequenceDiagram
    autonumber
    actor U as ผู้ใช้
    participant FE as Frontend (React)
    participant APP as Express app (app.ts: cors → express.json → router)
    participant MW as auth middleware (auth.middleware.ts)
    participant H as route handler (*.routes.ts + parse* ใน *.dto.ts)
    participant SVC as Service
    participant MEM as หน่วยความจำ (GraphRepository / ดัชนี embeddings)
    participant DB as MySQL
    participant LLM as Groq (rephrase)
    participant ERR as errorHandler (common/error-handler.ts)

    Note over APP,MEM: ตอนบูต: โหลดผัง/อุปกรณ์จาก DB เข้า MEM, เริ่มโหลดโมเดล + สร้างดัชนี embedding (ไม่รอ)

    rect rgb(235,245,255)
    Note over U,DB: ช่วง 1-2: สมัคร / เข้าสู่ระบบ
    U->>FE: กรอกฟอร์มสมัคร/ล็อกอิน
    FE->>APP: POST /auth/register | /auth/login (cors → express.json)
    APP->>H: auth.routes.ts (ไม่มี auth middleware)
    H->>H: parseRegisterBody | parseLoginBody
    H->>SVC: AuthService.register | login
    SVC->>DB: INSERT users | SELECT users WHERE email
    DB-->>SVC: แถวผู้ใช้
    SVC-->>FE: { accessToken(JWT), user }
    FE->>FE: เก็บใน localStorage["fixstep.auth"]
    end

    rect rgb(240,255,240)
    Note over U,DB: ช่วง 3-4: เลือกรุ่น → ค้นอาการ → เริ่มตรวจ
    U->>FE: เลือกประเภท/รุ่น
    FE->>APP: GET /traversal/manuals
    APP->>H: traversal.routes.ts:32 (ไม่มี auth middleware)
    H->>MEM: listManuals()
    MEM-->>FE: รายการรุ่น
    U->>FE: พิมพ์อาการ กด ค้นหา
    FE->>APP: POST /symptom-search {query, manualId}
    APP->>H: symptom-search.routes.ts:9
    H->>H: parseSearchBody
    H->>MEM: embed(query) → cosine กับดัชนี (กรอง manualId) → top3 ≥ 0.55
    MEM-->>FE: matches[]
    U->>FE: เลือกผัง
    FE->>APP: POST /traversal/sessions (+Bearer หรือ X-Client-Id)
    APP->>MW: optionalAuth (traversal.routes.ts:42)
    MW->>H: request.user (หรือ guest)
    H->>H: parseStartSessionBody + resolveOptionalOwner
    H->>SVC: TraversalService.startSession
    SVC->>MEM: requireGraph, scoreGraph(query)
    SVC->>DB: INSERT sessions
    SVC->>LLM: rephrase(node.text) [ข้ามโหนด safety/จบ; timeout 3s]
    LLM-->>SVC: ข้อความ (ผ่านด่านตรวจ) หรือ ล้ม → ใช้ต้นฉบับ
    SVC-->>FE: 201 SessionResponse
    end

    rect rgb(255,248,235)
    Note over U,DB: ช่วง 5-6: เดินผัง + บันทึก
    loop ทุกขั้น
      U->>FE: ใช่/ไม่ใช่/ถัดไป/ยืนยันความปลอดภัย/กรอกรหัส
      FE->>APP: POST /traversal/sessions/:id/actions
      APP->>MW: optionalAuth
      MW->>H: request.user
      H->>H: parseTraversalAction
      H->>SVC: submitAction
      SVC->>DB: SELECT sessions + session_history
      SVC->>SVC: engine.submitAction (ตัดสินขั้นถัดไป + ด่าน safety)
      alt engine ปฏิเสธ (เช่น SAFETY_CONFIRMATION_REQUIRED)
        SVC-->>ERR: throw error (asyncRoute → next(err))
        ERR-->>FE: 400 {statusCode, code, message}
      else อนุมัติ
        SVC->>DB: BEGIN; UPDATE sessions; INSERT session_history; COMMIT
        SVC-->>FE: 201 SessionResponse (node ถัดไป + reference)
      end
    end
    U->>FE: (ไม่บังคับ) พิมพ์ผลลัพธ์ กดบันทึก
    FE->>APP: POST /traversal/sessions/:id/outcome
    APP->>MW: optionalAuth
    H->>SVC: submitOutcome
    SVC->>DB: UPDATE sessions SET outcome_text (ครั้งเดียว)
    end

    rect rgb(250,240,255)
    Note over U,DB: ช่วง 7-8: ประวัติ + feedback
    U->>FE: เปิด /history
    FE->>APP: GET /history?page=1 (+Bearer หรือ X-Client-Id)
    APP->>MW: optionalAuth (history.routes.ts:13)
    MW->>H: request.user
    H->>H: resolveRequiredOwner + parseHistoryQuery
    H->>SVC: HistoryService.list
    SVC->>DB: SELECT sessions (ownerWhere, completed, ยังไม่หมดอายุ)
    SVC-->>FE: รายการ
    U->>FE: เปิดรายละเอียด
    FE->>APP: GET /history/:id
    APP->>MW: optionalAuth
    H->>SVC: HistoryService.detail
    SVC->>DB: sessions + session_history + session_feedback
    SVC->>SVC: replayReaches (ตรวจว่าผังยังตรงเดิม)
    SVC-->>FE: HistoryDetail
    U->>FE: กด 👍/👎 + ข้อความ
    FE->>APP: POST /history/:id/feedback
    APP->>MW: optionalAuth (history.routes.ts:27)
    H->>H: parseFeedbackBody
    H->>SVC: HistoryService.saveFeedback
    SVC->>DB: INSERT … ON DUPLICATE KEY UPDATE session_feedback
    SVC-->>FE: { helpful, comment }
    end

    rect rgb(255,240,240)
    Note over U,DB: ช่วง 9: แดชบอร์ด (admin)
    U->>FE: เปิด /admin/analytics
    FE->>APP: GET /admin/analytics/summary?days=30
    APP->>MW: requireAuth → requireAdmin (admin.routes.ts:36-37)
    alt ไม่มี/token เสีย → 401 · ไม่ใช่ admin → 403
      MW-->>ERR: next(ApiError)
      ERR-->>FE: 401 | 403 {statusCode, code, message}
    else admin
      MW->>H: request.user (role=admin)
      H->>H: parseSummaryQuery
      H->>SVC: AdminService.summary
      SVC->>DB: sessionTotals/feedbackTotals/graphCounts/completedEndNodes/perDay (Promise.all)
      SVC-->>FE: สถิติรวม
    end
    end
```

---

# ตารางสรุป "ปุ่ม / Action → ไฟล์ → Function → API → DB table"

| # | ปุ่ม / Action | ไฟล์ (หน้าจอ) | Handler / Hook | API | Backend (router/route handler → service → store) | DB table |
|---|---|---|---|---|---|---|
| 1 | สมัครสมาชิก | `RegisterPage.tsx:97` | `handleSubmit :38` → `AuthProvider.register :99` → `api/auth.ts:22` | `POST /auth/register` | `auth.routes.ts:11` → `parseRegisterBody` → `AuthService.register :33` → `UsersStore.create :65` | `users` (INSERT) |
| 2 | เข้าสู่ระบบ | `LoginPage.tsx:90` | `handleSubmit :42` → `AuthProvider.login :92` → `api/auth.ts:13` | `POST /auth/login` | `auth.routes.ts:16` → `parseLoginBody` → `AuthService.login :55` → `UsersStore.findByEmail :55` | `users` (SELECT) |
| 3 | (เปิดแอป) ยืนยันตัวตน | `AuthProvider.tsx:39-56` | `getMe` `api/auth.ts:31` | `GET /auth/me` | `auth.routes.ts:21` [`requireAuth`] → `AuthService.me :66` → `UsersStore.findById :60` | `users` (SELECT) |
| 4 | ออกจากระบบ | `AppShell.tsx:84` | `AuthProvider.logout :106` | – (ล้าง localStorage เท่านั้น) | – | – |
| 5 | เลือกเครื่องที่มีปัญหา | `HomePage.tsx:17` | `navigate('/devices')` | – | – | – |
| 6 | (เปิดหน้า) รายการรุ่น | `DevicesPage.tsx:29` | `useManuals` `queries.ts:70` → `api/traversal.ts:24` | `GET /traversal/manuals` | `traversal.routes.ts:32` → `listManuals :48` → `GraphRepository.listManuals :99` | – (หน่วยความจำ) |
| 7 | เลือกประเภท / เลือกรุ่น / ไม่ทราบรุ่น | `DevicesPage.tsx:81, :137, :151` | `onPick`, `pick :104`, `setIsUnknown` | – | – | – |
| 8 | อาการทั้งหมด (รายการ) | `AllSymptomsPage.tsx:30` | `useGraphs` `queries.ts:61` → `api/traversal.ts:19` | `GET /traversal/graphs?manualId=` | `traversal.routes.ts:27` → `parseOptionalManualId` → `listGraphs :42` → `GraphRepository.listAll :87` | – |
| 9 | ค้นหา (อาการ) | `SymptomSearchForm.tsx:30` | `handleSearch SymptomsPage.tsx:43` → `useSymptomSearch queries.ts:141` → `api/traversal.ts:47` | `POST /symptom-search` | `symptom-search.routes.ts:9` → `parseSearchBody` → `SymptomSearchService.search :160` → `EmbeddingService.embed` + `rankGraphs` | – (ดัชนีในหน่วยความจำ) |
| 10 | เลือกอาการ/ผัง (เริ่มตรวจ) | `SymptomRow.tsx:23` | `start useStartSymptom.ts:27` → `useStartSession queries.ts:171` → `api/traversal.ts:37` | `POST /traversal/sessions` | `traversal.routes.ts:40` [`optionalAuth`] → `parseStartSessionBody` → `TraversalService.startSession :56` → `SessionStore.create :38` | `sessions` (INSERT) |
| 11 | ใช่ / ไม่ใช่ / ถัดไป / ยืนยันความปลอดภัย / ส่งรหัส | `StepView.tsx:51,54,66` · `SafetyGateStep.tsx:30` · `InputStep.tsx:32` | `handleAction SessionPage.tsx:50` → `useSubmitAction queries.ts:179` → `api/traversal.ts:58` | `POST /traversal/sessions/:id/actions` | `traversal.routes.ts:60` [`optionalAuth`] → `parseTraversalAction` → `submitAction :88` → `engine.submitAction` → `SessionStore.update :89` | `sessions` (UPDATE) + `session_history` (INSERT) |
| 12 | (เปิดหน้า/F5) โหลดขั้นปัจจุบัน | `SessionPage.tsx:29` | `useSession queries.ts:80` → `api/traversal.ts:54` | `GET /traversal/sessions/:id` | `traversal.routes.ts:51` [`optionalAuth`] → `getSession :76` → `SessionStore.find :59`, `findOutcome :184` | `sessions`, `session_history` (SELECT) |
| 13 | บันทึกผล | `OutcomeForm.tsx:83` | `handleOutcome SessionPage.tsx:63` → `useSubmitOutcome queries.ts:192` → `api/traversal.ts:68` | `POST /traversal/sessions/:id/outcome` | `traversal.routes.ts:70` [`optionalAuth`] → `parseOutcomeBody` → `submitOutcome :116` → `SessionStore.saveOutcome :171` | `sessions` (UPDATE outcome_text) |
| 14 | ยกเลิกการตรวจ | `SessionHeader.tsx:28` | `handleAbandon SessionPage.tsx:74` → `useAbandonSession queries.ts:203` → `api/traversal.ts:75` | `DELETE /traversal/sessions/:id` | `traversal.routes.ts:83` [`optionalAuth`] → `abandonSession :109` → `SessionStore.delete :161` | `sessions` (DELETE → CASCADE) |
| 15 | ตรวจอาการอื่น / เริ่มอาการนี้ใหม่ | `TerminalActions.tsx:12,15` | `navigate(otherSymptomPath)` / `handleRestart SessionPage.tsx:78` | (เริ่มใหม่ = ข้อ 10) | – | `sessions` (INSERT) |
| 16 | (เปิดหน้า) ประวัติ | `HistoryPage.tsx:32` | `useHistory queries.ts:91` → `api/history.ts:11` | `GET /history?page=` | `history.routes.ts:13` [`optionalAuth`] → `parseHistoryQuery` → `HistoryService.list :45` → `HistoryStore.listCompleted :48` | `sessions` (SELECT) |
| 17 | เปิดรายละเอียดประวัติ | `HistoryRow.tsx:32` → `HistoryDetailPage.tsx:52` | `useHistoryDetail queries.ts:101` → `api/history.ts:16` | `GET /history/:id` | `history.routes.ts:20` [`optionalAuth`] → `HistoryService.detail :68` → `findCompleted :62`, `findSteps :84`, `findFeedback :114` | `sessions`, `session_history`, `session_feedback` (SELECT) |
| 18 | ลบ (จากประวัติ) | `HistoryRow.tsx:59` · `HistoryDetailPage.tsx:226` + `DeleteConfirm` | `useDeleteHistory queries.ts:218` → `api/history.ts:21` | `DELETE /history/:id` | `history.routes.ts:34` [`optionalAuth`] → `HistoryService.remove :78` → `HistoryStore.deleteCompleted :95` | `sessions` (DELETE → CASCADE) |
| 19 | ตรวจอาการนี้อีกครั้ง (จากประวัติ) | `HistoryDetailPage.tsx:205` | `handleRestart :88` → ข้อ 10 | `POST /traversal/sessions` | ข้อ 10 | `sessions` (INSERT) |
| 20 | 👍 ช่วยได้ / 👎 ไม่ช่วย + บันทึก | `FeedbackButtons.tsx:45,48,78` | `handleSubmit :34` → `useSubmitFeedback queries.ts:238` → `api/history.ts:29` | `POST /history/:id/feedback` | `history.routes.ts:27` [`optionalAuth`] → `parseFeedbackBody` → `HistoryService.saveFeedback :86` → `HistoryStore.saveFeedback :105` | `session_feedback` (UPSERT) |
| 21 | แดชบอร์ด (เลือก 7/30/90 วัน) | `AdminAnalyticsPage.tsx:47-57` | `useAdminSummary queries.ts:121` → `api/admin.ts:23` | `GET /admin/analytics/summary?days=` | `admin.routes.ts:34` [`requireAuth` → `requireAdmin`] → `parseSummaryQuery` → `AdminService.summary :52` → `AdminStore.sessionTotals :111` ฯลฯ | `sessions`, `session_feedback` (SELECT) |
| 22 | หน้าความเห็นผู้ใช้ (ตัวกรอง) | `AdminFeedbackPage.tsx:50-92` | `useAdminFeedback queries.ts:111` → `api/admin.ts:12` | `GET /admin/feedback?…` | `admin.routes.ts:24` [`requireAuth` → `requireAdmin`] → `parseFeedbackQuery` → `AdminService.feedback :30` → `AdminStore.listFeedback :52` | `session_feedback` JOIN `sessions` |

(ปุ่มของ admin สำหรับร่างผังจาก PDF — `UploadDraftForm`, `DraftActions` ฯลฯ ที่ `/admin/drafts*` — อยู่นอก journey นี้ ไม่ได้ trace รายละเอียด; ดู `docs/study/BACKEND-FILES-EXPRESS.md` หัวข้อ `authoring/`)

---

# แผนผังไฟล์ที่ถูกแตะใน journey (เรียงตามลำดับการเรียก)

**Frontend**
1. `main.tsx` → `App.tsx` (router, `AuthProvider`, `QueryClientProvider`)
2. `components/layout/AppShell.tsx` (เมนู, ลิงก์เข้า/ออกจากระบบ)
3. ช่วง 1–2: `pages/RegisterPage.tsx`, `pages/LoginPage.tsx`, `lib/authForm.ts`, `components/auth/AuthProvider.tsx`, `api/auth.ts`, `api/http.ts`, `lib/authStorage.ts`
4. ช่วง 3: `pages/HomePage.tsx`, `pages/DevicesPage.tsx`, `lib/modelSelection.ts`, `lib/models.ts`, `api/queries.ts` (`useManuals`), `api/traversal.ts` (`listManuals`), `pages/AllSymptomsPage.tsx`
5. ช่วง 4: `pages/SymptomsPage.tsx`, `components/SymptomSearchForm.tsx`, `lib/textInput.ts`, `components/SymptomSearchResults.tsx`, `components/SymptomRow.tsx`, `lib/useStartSymptom.ts`, `lib/clientHeaders.ts`, `lib/clientId.ts`
6. ช่วง 5–6: `pages/SessionPage.tsx`, `components/SessionHeader.tsx`, `components/EquipmentPanel.tsx`, `components/step/{PathRail,StepView,StepCard,SafetyGateStep,InputStep,OutcomeStep,ReferenceLine}.tsx`, `components/RephraseNote.tsx`, `components/OutcomeForm.tsx`, `components/TerminalActions.tsx`, `lib/trail.ts`
7. ช่วง 7–8: `pages/HistoryPage.tsx`, `components/history/{HistoryRow,DeleteConfirm,Pagination,FeedbackButtons}.tsx`, `pages/HistoryDetailPage.tsx`, `api/history.ts`
8. ช่วง 9: `components/auth/AdminRoute.tsx`, `pages/AdminAnalyticsPage.tsx`, `pages/AdminFeedbackPage.tsx`, `components/admin/*`, `api/admin.ts`, `lib/adminParams.ts`, `lib/adminView.ts`

**Backend**
1. `main.ts` → `app.ts` (ประกอบแอป: `cors` → `express.json` → `express.urlencoded` → mount router → `notFoundHandler` → `errorHandler` ตามลำดับใน §2.1) · `database/pool.ts` · `common/{error-handler,api-error,logger,helpers}.ts`
2. ช่วง 1–2: `auth/auth.routes.ts` (router) → `auth/auth.dto.ts` (`parse*`) → `auth/auth.service.ts` → `auth/users.store.ts` → `auth/token.ts` · `auth/auth.middleware.ts` · `auth/role.enum.ts`
3. ช่วง 3: `traversal/traversal.routes.ts` (router + `optionalAuth`) → `traversal/traversal.service.ts` → `traversal/graph.repository.ts` · `traversal/equipment.repository.ts`
4. ช่วง 4: `symptom-search/symptom-search.routes.ts` (router) → `.dto.ts` (`parseSearchBody`) → `.service.ts` → `symptom-matcher.ts` → `embedding/embedding.service.ts` · `traversal/traversal.dto.ts` · `auth/session-owner.ts` · `traversal-engine/{traversal-engine,types}.ts` · `traversal/session.store.ts`
5. ช่วง 5: `rephrase/{rephrase.service,rephrase-guard,groq-llm.client}.ts`
6. ช่วง 7–8: `history/history.routes.ts` (router + `optionalAuth`) → `history.dto.ts` (`parse*`) → `history.service.ts` → `history.store.ts`
7. ช่วง 9: `admin/admin.routes.ts` (router + `requireAuth`/`requireAdmin`) → `admin.dto.ts` (`parse*`) → `admin.service.ts` → `admin.store.ts`
8. ตอน ingest (นอก journey): `scripts/seed-graphs.js`, `authoring/*`

**DB:** `migrations/001_users.sql`, `002_graphs.sql`, `003_equipment.sql`, `004_sessions.sql`, `005_session_feedback.sql`

---

# Gap Analysis: spec (ตามโจทย์/แนวคิดโปรเจกต์) เทียบกับโค้ดจริง

สัญลักษณ์: ✔ ตรง · ✘ ไม่ตรง/ไม่มี · ◐ บางส่วน

| # | สิ่งที่ spec ระบุ | สถานะ | หลักฐานในโค้ด / หมายเหตุ |
|---|---|:-:|---|
| 1 | ทุกคำตอบ/ขั้นตอนมี Source Reference | ✔ | ทุกโหนดมี `reference = {source, pageRange}` จาก `renderNode` `traversal-engine.ts:131-134`; แสดงทุกขั้นที่ `StepCard.tsx:37` → `ReferenceLine.tsx:23-36` · ประวัติก็มี `HistoryDetailPage.tsx:142-147` |
| 2 | ห้ามตอบเมื่อ retrieval ไม่พอ / แนะนำศูนย์บริการ | ◐ | ค้นหาคืนเฉพาะ ≥ 0.55 (`symptom-search.service.ts:11,172`); ไม่พบ → "ระบบไม่เดาอาการให้… ติดต่อศูนย์บริการ" `SymptomSearchResults.tsx:13-19` ✔ · แต่ผู้ใช้ยังเลือกผังเองจากรายการได้ และข้อความระบุ "Samsung" ตายตัว `:16` |
| 3 | Feedback 👍/👎 + comment บันทึกลง DB | ✔ | `session_feedback` (`005_session_feedback.sql`), UPSERT `history.store.ts:105-112` |
| 4 | Feedback ใช้ใน Analytics | ✔ (อ่านอย่างเดียว) | `admin.store.ts:140-148`, `admin.service.ts:119-124`, `AdminAnalyticsPage.tsx:92-97`; ไม่มีการนำไปปรับระบบ |
| 5 | JWT + auth middleware ฝั่ง backend | ✔ | `auth.middleware.ts:44-83` (HS256 บังคับ `token.ts:38`) · ข้อจำกัด: ไม่มี logout ฝั่งเซิร์ฟเวอร์, token ใน localStorage |
| 6 | RAG: LLM สร้างคำตอบจากข้อมูลที่ดึงมา | ✘ (โดยออกแบบ) | ไม่มีขั้น "ให้ LLM เขียนคำตอบ" ขั้นตอนมาจากผังที่เขียนไว้ LLM เรียบเรียงถ้อยคำบางโหนด (`rephrase.service.ts:35-62`, ข้ามโหนด safety/จบ `:40`, มีด่านตรวจ `rephrase-guard.ts:26-61`) · ค้นหาไม่พบ prompt ส่ง LLM ในช่วงค้นหา |
| 7 | Embeddings เก็บใน MySQL | ✘ | ค้น `embedding`/`vector` ใน `migrations/`, `scripts/` ไม่พบ; ดัชนีสร้างในหน่วยความจำตอนบูต `symptom-search.service.ts:56-102` (ต้องบูตใหม่หรือ `addGraphs` เมื่อมีผังใหม่) |
| 8 | Metadata filter ด้วย SQL ตาม device/brand/model | ✘ | กรองในหน่วยความจำด้วย `manualId` `symptom-search.service.ts:165-168` (ผู้ใช้เลือกรุ่นผ่าน `DevicesPage`) ไม่มีช่อง brand แยก |
| 9 | Cosine ใน TypeScript, Top-K, threshold | ✔ | `symptom-matcher.ts:20-41`, `:90-96`; K=3, threshold=0.55 (เหตุผลที่เลือกค่า: **ไม่ทราบ**) |
| 10 | โหลด embeddings ตอน start + กลไก reload หลัง ingest | ◐ | ตอน start ✔ (`app.ts:60`); reload หลัง publish ✔ (`drafts.service.ts:199,205`, `addGraphs`) · หลัง `seed-graphs.js` ✘ ต้องรีสตาร์ต |
| 11 | แสดงผล Problem / Possible Cause / Confidence / Solution / Safety / References | ◐ | Problem ✔, Confidence ✔ (เป็นคะแนนความคล้าย ไม่ใช่ความน่าจะเป็น), Solution ✔, Safety ✔, References ✔ · **Possible Cause ✘** (ไม่มีในผัง/DB ตั้งใจ) |
| 12 | บันทึก chat / session / message / references | ◐ | มี `sessions` + `session_history` + `outcome_text`; **ไม่มี** message/chat/references table (references คำนวณจากผังตอนอ่าน) |
| 13 | Repair History หน้า list + detail | ✔ | `HistoryPage.tsx`, `HistoryDetailPage.tsx`; detail มี replay ตรวจความตรงของผัง `history.service.ts:232-258` · ข้อจำกัด: ≤ 50 รายการ/ผู้ใช้ |
| 14 | Dashboard Analytics | ✔ (admin เท่านั้น) | `/admin/analytics`; ไม่มีฝั่งผู้ใช้ทั่วไป |
| 15 | ความเป็นเจ้าของ session ถูกบังคับทุก endpoint | ◐ | `/history/*` และ `DELETE /traversal/sessions/:id` ตรวจเจ้าของใน SQL ✔ · `GET`/`actions`/`outcome` ตรวจเฉพาะ session ที่มี `user_id` (`traversal.service.ts:138-143`) session ของ guest ใครรู้ id ก็เข้าถึงได้ |
| 16 | Zustand store | ✘ | ไม่ใช้ ใช้ React Query + Context (`AuthProvider`) + URL query |
| 17 | ให้คะแนน (feedback) หลังจบการตรวจ | ◐ | ทำได้เฉพาะในหน้ารายละเอียดประวัติ ไม่มีฟอร์มที่หน้าจบการตรวจ (`OutcomeStep` มีแต่ฟอร์ม "ผลเป็นอย่างไร") |
| 18 | ข้อมูลหมดอายุถูกลบ | ✘ | ไม่มีงานลบแถวหมดอายุ (ค้นแล้วไม่พบ) แถวถูกกรองออกตอนอ่านเท่านั้น |

## ข้อมูลที่ไม่ได้ตรวจ / ข้อจำกัดของเอกสารนี้
- ไม่ได้รันระบบ ไม่ได้ทดสอบ HTTP จริง ทุกอย่างมาจากการอ่านโค้ด
- ไม่ได้ trace ปุ่มของหน้า admin ร่างผังจาก PDF (`/admin/drafts*`) เพราะอยู่นอก journey ผู้ใช้
- `lib/errors.ts` (ตารางข้อความ error ภาษาไทย), `lib/labels.ts`, `lib/historyView.ts`, `components/ErrorNotice.tsx` ใช้ทุกช่วงแต่ไม่ได้อ่านเต็ม
- เลขบรรทัดตรงกับไฟล์ ณ 22 ต.ค. 2569 ถ้าไฟล์ถูกแก้/ลบคอมเมนต์ต่อ เลขจะเลื่อน (เอกสารเก่า `docs/STUDY_GUIDE.md` และ `docs/study/QA-WALKTHROUGH-BACKEND.md` อ้างเลขบรรทัดของ backend ก่อนลบคอมเมนต์ จึงคลาดเคลื่อนในหลายไฟล์)
