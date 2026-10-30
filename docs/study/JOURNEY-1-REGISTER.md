# User Walkthrough ช่วงที่ 1: สมัครสมาชิก (Register)

> บันทึกจากการเดินตาม `docs/USER_JOURNEY_WALKTHROUGH.md` เฉพาะช่วงที่ 1 · ไว้ให้กลับมาอ่านและจดเองว่าแต่ละขั้นผ่าน **ไฟล์ไหน → function ไหน → โค้ดบรรทัดไหน**
> เลขบรรทัดตามไฟล์บนดิสก์ ณ 24 ต.ค. 2569 (backend หลายไฟล์ถูกลบคอมเมนต์แล้ว เลขในเอกสารเก่าอาจคลาดเคลื่อน) · ทุกข้อความมาจากการอ่านโค้ด ไม่ได้รันทดสอบจริง
> **ช่องว่างสำหรับจด:** คอลัมน์ "โน้ตของฉัน" ในตารางเส้นทาง

## เรื่องเล่า
สมชาย (guest) กดลิงก์ "สมัครสมาชิก" กรอกชื่อ/อีเมล/รหัสผ่าน แล้วกดปุ่ม → หน้าจอตรวจเบื้องต้น → ยิง `POST /auth/register` → backend ตรวจซ้ำ, hash รหัสผ่าน, บันทึกแถวใหม่ในตาราง `users`, ออกบัตรผ่าน (JWT) กลับมา → หน้าจอเก็บบัตรไว้แล้วถือว่าสมชายล็อกอินแล้ว (สมัครแล้วเข้าสู่ระบบทันที)

การสมัครเป็นทางเลือกเสริม ไม่สมัครก็ตรวจอาการได้ตามปกติ (เป็น guest)

## ภาพรวมเส้นทาง
```
หน้าจอ (Frontend)                                         เซิร์ฟเวอร์ (Backend)                     ฐานข้อมูล
RegisterPage  → ตรวจฟอร์ม → useMutation → AuthProvider    cors → express.json → router /auth        users
  .tsx          authForm.ts    .register     .register →     auth.routes.ts → parseRegisterBody
                                api/auth.ts → api/http.ts      → AuthService.register → UsersStore.create ──► INSERT
                                      └───── POST /auth/register ─────────►                │
                                      ◄──── 201 { accessToken, user } ◄────────────────────┘
  ← เก็บใน localStorage ← applySession ← toStoredAuth
```

## ตารางเส้นทาง (ขั้น → ไฟล์:บรรทัด → function)

| ขั้น | เกิดอะไร | ไฟล์:บรรทัด | function / โค้ด | โน้ตของฉัน |
|---|---|---|---|---|
| 1 | กดลิงก์ "สมัครสมาชิก" ในเมนูซ้าย | `frontend/src/components/layout/AppShell.tsx:74-76` · `frontend/src/App.tsx:49` | `NavLink to="/register"` · `<Route path="/register" element={<RegisterPage/>}>` | |
| 2 | หน้าเก็บค่าที่พิมพ์ | `frontend/src/pages/RegisterPage.tsx:24-27` | `useState` ×3 (`email`, `password`, `displayName`) + `fieldErrors` | |
| 3 | กดปุ่ม "สมัครสมาชิก" | `RegisterPage.tsx:97-99` (ปุ่ม), `:53` (`<form onSubmit>`) | `Button type="submit"` → `handleSubmit` | |
| 4 | ตรวจเบื้องต้นฝั่งหน้าจอ | `RegisterPage.tsx:38-44` · `frontend/src/lib/authForm.ts:44-62` | `handleSubmit` → `validateRegister(email, password, displayName)` ผิด → แสดงใต้ช่อง แล้ว `return` (ไม่ยิง API) | |
| 5 | สั่งส่ง | `RegisterPage.tsx:29-32` | `useMutation({ mutationFn: () => register(email.trim(), password, displayName.trim()), onSuccess: navigate(...) })` → `submit.mutate()` | |
| 6 | provider รับช่วง | `frontend/src/components/auth/AuthProvider.tsx:75-80` | `register` → `applySession(await apiRegister(...))` | |
| 7 | api client | `frontend/src/api/auth.ts:22-29` | `register()` → `request<AuthResponse>('/auth/register', { method:'POST', body:{email,password,displayName}, anonymous:true })` | |
| 8 | ประกอบและยิง fetch | `frontend/src/api/http.ts:59-107` (`anonymous` `:63`, header `:65-70`, fetch `:74-78`) | `request()`: URL = `VITE_API_URL + '/auth/register'`, `Content-Type: application/json`, **ไม่แนบ token** | |
| 9 | **backend** ผ่านด่านแรก | `backend/src/app.ts:66-67` | `cors(...)` → `express.json()` (แปลง body เป็น `request.body`) | |
| 10 | เข้า router ตาม path | `app.ts:71` · `backend/src/auth/auth.routes.ts:11-14` | `app.use('/auth', authRoutes(...))` → `router.post('/register', asyncRoute(...))` (ไม่มี auth middleware) ตอบ **201** | |
| 11 | ตรวจ input ซ้ำ | `backend/src/auth/auth.dto.ts:89` (`parseEmail :53`, `parsePassword :65`, `parseDisplayName :80`) | `parseRegisterBody(request.body)` หยิบเฉพาะ 3 ฟิลด์ (เมินฟิลด์อื่นเช่น `role`) ผิด → `ApiError 400 INVALID_AUTH_REQUEST` | |
| 12 | ตรรกะสมัคร | `backend/src/auth/auth.service.ts:33-53` | `AuthService.register`: `hash(password, 10)` `:34` → `usersStore.create({... role: Role.User })` `:38-44` → `issue(user)` `:52` | |
| 13 | บันทึกลง DB | `backend/src/auth/users.store.ts:65-84` (SQL `:68-70`, อ่านกลับ `:79`) | `UsersStore.create` → `INSERT INTO users ...` แล้ว `findById` | |
| 14 | ตาราง | `backend/migrations/001_users.sql:12-23` | `users` (`id`, `email` UNIQUE, `password_hash`, `display_name`, `role`, `created_at`, `updated_at`) | |
| 15 | ออกบัตรผ่าน | `auth.service.ts:74-77` · `backend/src/auth/token.ts:32-34` | `issue` → `tokens.sign({ sub: user.id, role: user.role })` (HS256 อายุเริ่มต้น 7 วัน) | |
| 16 | ตอบกลับ 201 | `auth.routes.ts:12` | `response.status(201).json({ accessToken, user })` | |
| 17 | หน้าจอแปลงผลที่ได้ | `frontend/src/api/auth.ts:9-11` | `toStoredAuth` → `{ token, user:{ id, displayName, role } }` (**ไม่เก็บอีเมล**) | |
| 18 | เก็บการล็อกอิน | `AuthProvider.tsx:58-66` · `frontend/src/lib/authStorage.ts:46-53` (key `:3`) | `applySession`: `storeAuth` → `localStorage['fixstep.auth']`, `setStored`, `queryClient.clear()` | |
| 19 | ไปหน้าถัดไป | `RegisterPage.tsx:31` | `onSuccess` → `navigate(next ?? '/history', { replace: true })` | |

## โค้ดสำคัญของแต่ละขั้น

### ขั้น 4–5: ตรวจฟอร์มแล้วสั่งส่ง (`RegisterPage.tsx`)
```tsx
// :29-32
const submit = useMutation({
  mutationFn: () => register(email.trim(), password, displayName.trim()),
  onSuccess: () => navigate(next ?? '/history', { replace: true }),
})
// :38-44
function handleSubmit(event) {
  event.preventDefault()
  const errors = validateRegister(email, password, displayName)
  setFieldErrors(errors)
  if (hasErrors(errors)) return      // ไม่ผ่าน → ไม่ส่ง
  submit.mutate()
}
```
- `useMutation` = "การกระทำที่เปลี่ยนข้อมูล" (ต่างจาก `useQuery` ที่อ่านข้อมูลเอง) ทำงานเมื่อสั่ง `.mutate()` เท่านั้น
- กฎใน `validateRegister` (`lib/authForm.ts:44-62`): อีเมลรูปแบบหลวม · รหัสผ่าน 8–72 ตัวอักษร **และ** ไม่เกิน 72 ไบต์ (bcrypt อ่านแค่ 72 ไบต์ อักษรไทย 1 ตัว = 3 ไบต์) · ชื่อ 1–100

### ขั้น 7: `anonymous: true` หมายความว่า
`api/http.ts:30-34, :63` — ไม่แนบ token และ 401 ที่ตอบกลับไม่ถือว่า "token เสีย" (ผู้สมัครยังไม่มี token)

### ขั้น 11: ตรวจ input ฝั่ง backend (`auth.dto.ts`)
backend **ไม่เชื่อหน้าจอ** ตรวจซ้ำเสมอ และหยิบเฉพาะ `email`, `password`, `displayName` ผลลัพธ์ไม่มีฟิลด์ `role` ให้ service ใช้เลย อีเมลถูก `trim` + แปลงเป็นตัวพิมพ์เล็ก (`:53`)

### ขั้น 12: ตรรกะสมัคร (`auth.service.ts:33-53`)
```ts
async register(body: RegisterBody): Promise<AuthResponseDto> {
  const passwordHash = await hash(body.password, BCRYPT_ROUNDS);   // :34  bcrypt hash ไม่เก็บรหัสจริง
  let user: UserRecord;
  try {
    user = await this.usersStore.create({
      id: globalThis.crypto.randomUUID(),
      email: body.email,
      passwordHash,
      displayName: body.displayName,
      role: Role.User,                                              // :43  ตายตัวในโค้ด
    });
  } catch (err) {
    if (err instanceof DuplicateEmailError) throw emailTaken();     // :46-47  → 409 EMAIL_TAKEN
    throw err;
  }
  return this.issue(user);                                          // :52
}
```
- **bcrypt hash** ช้าโดยตั้งใจและมี salt: ถ้า DB รั่ว คนร้ายได้แค่ hash เดารหัสทีละตัวแพง
- `role` ตายตัวเป็น `user` สมัครเป็น admin ไม่ได้ (admin สร้างได้ทางเดียวคือ `backend/scripts/seed-admin.js`)

### ขั้น 13: SQL (`users.store.ts:65-84`)
```sql
-- :68-70
INSERT INTO users (id, email, password_hash, display_name, role)
VALUES (?, ?, ?, ?, ?)
-- อ่านกลับ (:79 ใช้ SELECT_USER :37-39 + :61) ให้ได้ created_at จริงจาก DB
SELECT id, email, password_hash, display_name, role, UNIX_TIMESTAMP(created_at) AS created_epoch
  FROM users WHERE id = ? LIMIT 1
```
ค่าทุกตัวเข้าทาง `?` (ไม่ต่อข้อความ SQL) · อีเมลซ้ำ → MySQL ตอบ `ER_DUP_ENTRY` → `users.store.ts:73-75` แปลงเป็น `DuplicateEmailError`

### ขั้น 16: ผลที่ตอบกลับ
```json
// 201
{ "accessToken": "<JWT>",
  "user": { "id": "uuid", "email": "a@b.com", "displayName": "สมชาย", "role": "user", "createdAt": "2026-10-24T03:00:00.000Z" } }
```
JWT ข้างในมีแค่ `sub` (user id), `role`, `iat`, `exp` (ใครก็อ่านได้ แต่ปลอมไม่ได้เพราะมีลายเซ็นจาก `JWT_SECRET`)

## สายพานที่คำขอสมัครผ่าน (สั้นๆ)
```
คำขอ → [cors app.ts:66] → [express.json app.ts:67] → [router /auth app.ts:71]
     → [route handler auth.routes.ts:11, ห่อด้วย asyncRoute error-handler.ts:111-115]
     → [parseRegisterBody] → service → store → DB
 error จากจุดไหนก็ตาม → [errorHandler app.ts:79 → error-handler.ts:74-100] → JSON {statusCode, code, message}
```

## ถ้ามีอะไรผิดพลาด
| กรณี | เกิดอะไร |
|---|---|
| ข้อมูลไม่ผ่านที่หน้าจอ | แสดงใต้ช่อง ไม่ยิง API |
| ข้อมูลไม่ผ่านที่ backend | 400 `INVALID_AUTH_REQUEST` → `ErrorNotice` |
| **อีเมลซ้ำ** | `INSERT` ชน UNIQUE `uq_users_email` → `ER_DUP_ENTRY` → `DuplicateEmailError` (`users.store.ts:73-75`) → `ApiError 409 EMAIL_TAKEN` (`auth.service.ts:46-47`) → `errorHandler` → `http.ts:95-99` → กล่อง error + ลิงก์ "ไปหน้าเข้าสู่ระบบ" (`RegisterPage.tsx:85-95`) |
| เซิร์ฟเวอร์ไม่ตอบ | `NETWORK_ERROR` (`http.ts:80`) |

## ข้อสังเกต
- ตรวจ 2 ที่: หน้าจอ (บอกผู้ใช้ทันที) และ backend (ตัวตัดสินจริง) กฎฝั่งหน้าจอคัดลอกมือ ต้องแก้ 2 ที่เมื่อเปลี่ยนกฎ (หัวไฟล์ `authForm.ts` เตือนไว้)
- ไม่มี rate limit กันสมัครรัว และไม่มียืนยันอีเมล
- token เก็บใน `localStorage` (ถ้าเว็บมีช่องโหว่ XSS สคริปต์อ่านได้)
- error ถูกแปลงทีละชั้น: DB → store → service → HTTP

## ถาม-ตอบ

**1. รหัสผ่านพิมพ์ 5 ตัวแล้วกดสมัคร มีคำขอไป backend ไหม?**
ไม่มี `validateRegister` พบข้อผิดพลาดแล้ว `return` ก่อน `submit.mutate()` (`RegisterPage.tsx:40-42`) แต่ถ้ามีคนยิง API ตรงๆ backend ก็ตอบ 400 เพราะตรวจซ้ำที่ `parsePassword`

**2. สมัครด้วยอีเมลที่มีอยู่แล้ว ไล่เส้นทางจาก DB ถึงหน้าจอ**
`INSERT` ชน UNIQUE `uq_users_email` → MySQL `ER_DUP_ENTRY` → store โยน `DuplicateEmailError` (`users.store.ts:73-75`) → service แปลงเป็น `ApiError 409 EMAIL_TAKEN` (`auth.service.ts:46-47`) → `errorHandler` ตอบ JSON → `http.ts:95-99` สร้าง `ApiError` ฝั่งหน้าจอ → `ErrorNotice` พร้อมลิงก์ไปล็อกอิน

**3. ทำไมหน้าจอเก็บแค่ id / ชื่อ / role ไม่เก็บอีเมล?**
เก็บเท่าที่ต้องใช้แสดงผล (`toAuthUser` `api/auth.ts:5-7`) ลดข้อมูลส่วนตัวที่ค้างใน `localStorage` อีเมลไม่จำเป็นต่อการแสดงผลหรือส่งคำขอ

## ที่ผมจดเพิ่มให้ (ดูแล้วเติมเองได้)
- ไฟล์ที่ช่วงนี้แตะ เรียงตามลำดับการเรียก
  Frontend: `AppShell.tsx` → `App.tsx` → `RegisterPage.tsx` → `lib/authForm.ts` → `AuthProvider.tsx` → `api/auth.ts` → `api/http.ts` → `lib/authStorage.ts`
  Backend: `app.ts` → `auth/auth.routes.ts` → `auth/auth.dto.ts` → `auth/auth.service.ts` → `auth/users.store.ts` → `auth/token.ts` · `common/error-handler.ts` (เมื่อเกิด error)
  DB: `migrations/001_users.sql`
