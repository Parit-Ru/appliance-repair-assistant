# User Walkthrough ช่วงที่ 2: เข้าสู่ระบบ + JWT + auth middleware

> บันทึกจากการเดินตาม `docs/USER_JOURNEY_WALKTHROUGH.md` เฉพาะช่วงที่ 2 · ไว้ให้กลับมาอ่านและจดเองว่าแต่ละขั้นผ่าน **ไฟล์ไหน → function ไหน → โค้ดบรรทัดไหน**
> เลขบรรทัดตามไฟล์บนดิสก์ ณ 24 ต.ค. 2569 (backend หลายไฟล์ถูกลบคอมเมนต์แล้ว เลขในเอกสารเก่าอาจคลาดเคลื่อน) · ทุกข้อความมาจากการอ่านโค้ด ไม่ได้รันทดสอบจริง
> **ช่องว่างสำหรับจด:** คอลัมน์ "โน้ตของฉัน" ในตารางเส้นทาง
> ต่อจาก `docs/study/JOURNEY-1-REGISTER.md` (ช่วงที่ 1 สมัครสมาชิก)

## เรื่องเล่า
วันถัดมา สมชายมีบัญชีแล้ว เปิดเว็บและกด "เข้าสู่ระบบ" กรอกอีเมล/รหัสผ่าน → หน้าจอตรวจเบื้องต้น → ยิง `POST /auth/login` → backend ค้นผู้ใช้ เทียบรหัสผ่านด้วย bcrypt แล้วออกบัตรผ่าน (JWT) → หน้าจอเก็บบัตรใน `localStorage` และแนบบัตรไปกับ **ทุกคำขอถัดไป** → backend ตรวจบัตรด้วย auth middleware ก่อนยอมให้เข้า route ที่ต้องรู้ตัวตน

ช่วงนี้มี 3 เรื่องหลัก: **บัตรผ่าน (JWT) คืออะไร**, **เก็บและแนบอย่างไร**, **backend ตรวจอย่างไร**

## JWT คืออะไร (พื้นฐาน)
บัตรผ่านที่เซิร์ฟเวอร์ออกให้หลังล็อกอิน ผู้ใช้แนบมาทุกคำขอ แทนการถามรหัสผ่านทุกครั้ง
- ข้างในบัตร (`backend/src/auth/token.ts:32-34`): `sub` (id ผู้ใช้), `role`, `iat` (ออกเมื่อ), `exp` (หมดเมื่อ ค่าเริ่มต้น 7 วัน)
- **ใครก็อ่านข้อมูลในบัตรได้** (ไม่ได้เข้ารหัส) แต่ **ปลอมไม่ได้** เพราะมีลายเซ็นจาก `JWT_SECRET` (HS256) แก้ข้อมูลแม้ตัวเดียว ลายเซ็นไม่ตรง
- ห้ามใส่ความลับในบัตร (ที่นี่ใส่แค่ `sub` กับ `role`)

## ภาพรวมเส้นทาง
```
หน้าจอ (Frontend)                                                เซิร์ฟเวอร์ (Backend)                    ฐานข้อมูล
LoginPage → validateLogin → useMutation → AuthProvider.login      cors → express.json → /auth router         users
  api/auth.ts login → api/http.ts request ── POST /auth/login ──►  auth.routes.ts → parseLoginBody
                                                                    → AuthService.login → UsersStore.findByEmail ─► SELECT
                                                                    → compare(bcrypt) → issue → tokens.sign
  ◄── 201/200 { accessToken, user } ◄─────────────────────────────┘
  ← localStorage['fixstep.auth'] ← applySession

หลังจากนั้นทุกคำขอ:
  api/http.ts แนบ  Authorization: Bearer <token>
        ──►  router → [auth middleware: optionalAuth | requireAuth | requireAdmin] → handler
```

## ตารางเส้นทาง (ขั้น → ไฟล์:บรรทัด → function)

### ส่วน A: กดล็อกอิน (หน้าจอ → backend → DB → กลับมาเก็บบัตร)
| ขั้น | เกิดอะไร | ไฟล์:บรรทัด | function / โค้ด | โน้ตของฉัน |
|---|---|---|---|---|
| 1 | กดลิงก์ "เข้าสู่ระบบ" ในเมนู | `frontend/src/components/layout/AppShell.tsx:71-73` · `frontend/src/App.tsx:48` | `NavLink to="/login"` · `<Route path="/login">` | |
| 2 | หน้าเก็บค่าที่พิมพ์ | `frontend/src/pages/LoginPage.tsx:28-30` | `useState` (`email`, `password`, `fieldErrors`) | |
| 3 | กดปุ่ม "เข้าสู่ระบบ" ตรวจเบื้องต้น | `LoginPage.tsx:90-92` (ปุ่ม), `:42-48` · `frontend/src/lib/authForm.ts:36-42` | `handleSubmit` → `validateLogin` (อีเมลถูกรูปแบบ + รหัสผ่านไม่ว่าง) ผิด → แสดงใต้ช่อง ไม่ยิง API | |
| 4 | สั่งส่ง | `LoginPage.tsx:32-35` | `useMutation({ mutationFn: () => login(email.trim(), password), onSuccess: navigate(next ?? '/') })` | |
| 5 | provider รับช่วง | `frontend/src/components/auth/AuthProvider.tsx:92-97` | `login` → `applySession(await apiLogin(...))` | |
| 6 | api client | `frontend/src/api/auth.ts:24-31` | `login()` → `request('/auth/login', { method:'POST', body:{email,password}, anonymous:true })` | |
| 7 | ยิง fetch | `frontend/src/api/http.ts:59-107` | `request()` (ไม่แนบ token เพราะ `anonymous`) | |
| 8 | **backend** ผ่านด่านแรก | `backend/src/app.ts:66-67` | `cors` → `express.json()` | |
| 9 | เข้า router | `app.ts:71` · `backend/src/auth/auth.routes.ts:16-19` | `router.post('/login', asyncRoute(...))` (ไม่มี auth middleware) ตอบ **200** | |
| 10 | ตรวจ input | `backend/src/auth/auth.dto.ts:99` | `parseLoginBody` (อีเมล/รหัสผ่านต้องเป็นข้อความไม่ว่าง ตรวจน้อยกว่าตอนสมัครโดยตั้งใจ) | |
| 11 | ตรรกะล็อกอิน | `backend/src/auth/auth.service.ts:55-64` | `AuthService.login` | |
| 11.1 | หาผู้ใช้ตามอีเมล | `auth.service.ts:56` · `backend/src/auth/users.store.ts:37-39`, `:55-58` | `usersStore.findByEmail` → `SELECT ... FROM users WHERE email = ? LIMIT 1` | |
| 11.2 | เทียบรหัสผ่าน | `auth.service.ts:58` (`dummyHash` `:26`) | `compare(body.password, user ? user.passwordHash : this.dummyHash)` | |
| 11.3 | ผิด → 401 | `auth.service.ts:59-61` | `invalidCredentials()` = `ApiError(401, 'INVALID_CREDENTIALS', ...)` ข้อความเดียวทุกกรณี | |
| 11.4 | ผ่าน → ออกบัตร | `auth.service.ts:63`, `:74-77` · `backend/src/auth/token.ts:32-34` | `issue` → `tokens.sign({ sub, role })` | |
| 12 | ตาราง | `backend/migrations/001_users.sql:12-23` | `users` (อ่านอย่างเดียวในช่วงนี้) | |
| 13 | ตอบกลับ | `auth.routes.ts:17` | `response.status(200).json({ accessToken, user })` | |
| 14 | หน้าจอแปลงผล | `frontend/src/api/auth.ts:15-21` | `toSession` → `{ token, user:{id, displayName, role} }` (ไม่เก็บอีเมล) | |
| 15 | เก็บบัตร | `AuthProvider.tsx:81-90` · `frontend/src/lib/authStorage.ts:19`, `:70-77` | `applySession`: `storeAuth` → `localStorage['fixstep.auth']` (+สำเนาในหน่วยความจำ `:27`) + `queryClient.clear()` | |
| 16 | ไปหน้าถัดไป | `LoginPage.tsx:34` | `onSuccess` → `navigate(next ?? '/', { replace: true })` | |

### ส่วน B: ใช้บัตรกับทุกคำขอถัดไป + backend ตรวจ
| ขั้น | เกิดอะไร | ไฟล์:บรรทัด | function / โค้ด | โน้ตของฉัน |
|---|---|---|---|---|
| 17 | อ่านบัตรจากที่เก็บ | `frontend/src/api/http.ts:63` · `authStorage.ts:66-68` | `getStoredToken()` (อ่านจาก storage ตรงๆ ไม่ผ่าน React state) | |
| 18 | แนบบัตรทุกคำขอ | `http.ts:65-70` | `Authorization: Bearer ${token}` (ยกเว้นคำขอ `anonymous`) | |
| 19 | backend อ่านบัตร | `backend/src/auth/auth.middleware.ts:20-42` | `readUser(request, tokens)` | |
| 19.1 | ไม่มี header | `auth.middleware.ts:22-24` | คืน `undefined` (ให้ตัวเรียกตัดสิน: guest หรือ 401) | |
| 19.2 | รูปแบบผิด | `auth.middleware.ts:26-29` | ต้อง `Bearer <token>` พอดี 2 ชิ้น ไม่งั้น 401 | |
| 19.3 | ตรวจลายเซ็น/วันหมดอายุ | `auth.middleware.ts:31-36` · `auth/token.ts:37-40` | `tokens.verify` (บังคับ `algorithms: ['HS256']`) ล้ม → 401 | |
| 19.4 | ตรวจรูปข้อมูลในบัตร | `auth.middleware.ts:38-41` | `sub` ต้องเป็นข้อความไม่ว่าง, `role` ต้องเป็นบทบาทจริง (`isRole`) ไม่งั้น 401 | |
| 20 | middleware 3 ตัว | `auth.middleware.ts:49-57`, `:59-68`, `:70-80` | `optionalAuth`, `requireAuth`, `requireAdmin` | |
| 21 | ผลวางที่ `request.user` | `auth.middleware.ts:13-15` | `currentUser(request)` ให้ handler อ่านต่อ | |
| 22 | ตัวอย่าง: ตอนเปิดเว็บ ยืนยันตัวตน | `AuthProvider.tsx:59-79` → `api/auth.ts:44-46` → `auth.routes.ts:21-24` → `auth.service.ts:66-72` → `users.store.ts:60-63` | `getMe` → `GET /auth/me` (`requireAuth`) → `AuthService.me` → `findById` แล้วหน้าจอเอา role/ชื่อจากเซิร์ฟเวอร์ทับ (`:64-70`) | |

### ส่วน C: บัตรเสีย/หมดอายุ และออกจากระบบ
| ขั้น | เกิดอะไร | ไฟล์:บรรทัด | function / โค้ด | โน้ตของฉัน |
|---|---|---|---|---|
| 23 | backend ตอบ 401 | `auth.middleware.ts:35`, `:39`, `:62` | `unauthenticated()` = `ApiError(401, 'UNAUTHENTICATED', 'กรุณาเข้าสู่ระบบ')` → `errorHandler` | |
| 24 | หน้าจอรู้ว่า token เสีย | `frontend/src/api/http.ts:91-93` | เฉพาะคำขอที่แนบ token (`status === 401 && token !== undefined`) → `unauthorizedHandler(token)` | |
| 25 | ล้างแล้วพาไปล็อกอินใหม่ | `AuthProvider.tsx:43-56` | `clearStoredAuth`, `queryClient.clear()`, `navigate('/login?reason=expired&next=<หน้าเดิม>')` (เมินถ้า token ไม่ใช่ตัวปัจจุบัน `:46`) | |
| 26 | ออกจากระบบ | `AppShell.tsx:84-86` → `AuthProvider.tsx:106-112` | `logout`: ล้าง localStorage + แคช + กลับหน้าแรก **ฝั่งเซิร์ฟเวอร์ไม่มีอะไรเกิดขึ้น** | |

## โค้ดสำคัญของแต่ละขั้น

### ขั้น 3–4: ตรวจฟอร์มแล้วสั่งส่ง (`LoginPage.tsx`)
```tsx
// :32-35
const submit = useMutation({
  mutationFn: () => login(email.trim(), password),
  onSuccess: () => navigate(next ?? '/', { replace: true }),
})
// :42-48
function handleSubmit(event) {
  event.preventDefault()
  const errors = validateLogin(email, password)
  setFieldErrors(errors)
  if (hasErrors(errors)) return
  submit.mutate()
}
```
`validateLogin` (`lib/authForm.ts:36-42`) ตรวจน้อยกว่าตอนสมัคร: อีเมลรูปแบบถูก + รหัสผ่านไม่ว่าง (ตั้งใจ เพราะกฎรหัสผ่านอาจเปลี่ยนทีหลัง คนที่สมัครไว้ด้วยกฎเก่ายังต้องล็อกอินได้)

### ขั้น 11: ตรรกะล็อกอิน (`auth.service.ts:55-64`)
```ts
async login(body: LoginBody): Promise<AuthResponseDto> {
  const user = await this.usersStore.findByEmail(body.email);                          // :56
  const matches = await compare(body.password, user ? user.passwordHash : this.dummyHash); // :58
  if (!user || !matches) {
    throw invalidCredentials();                                                        // :59-61  401 ข้อความเดียวกันทุกกรณี
  }
  return this.issue(user);                                                             // :63
}
```
- **`compare`** เทียบรหัสผ่านที่พิมพ์กับ bcrypt hash ใน DB
- **ไม่พบอีเมลก็ยัง `compare` กับ `dummyHash`** (`:26`) เพื่อให้เวลาตอบใกล้เคียงกัน คนร้ายวัดเวลาเดาไม่ได้ว่าอีเมลไหนมีบัญชี (กัน timing attack) และข้อความ error เหมือนกันทั้งสองกรณี
- SQL (`users.store.ts:37-39`, `:56`):
```sql
SELECT id, email, password_hash, display_name, role, UNIX_TIMESTAMP(created_at) AS created_epoch
  FROM users WHERE email = ? LIMIT 1
```

### ขั้น 15: เก็บบัตร (`authStorage.ts`)
- เก็บใน **`localStorage['fixstep.auth']`** = `{ token, user:{id, displayName, role} }` ให้ยังล็อกอินอยู่หลังรีเฟรช
- มีสำเนาในหน่วยความจำ (`:27`) และห่อ `try/catch` เผื่อ localStorage ใช้ไม่ได้ (โหมดส่วนตัวบางตัว) ถ้าเขียนไม่ได้จะจำไว้ในแท็บนั้นแทน แทนที่จะให้ล็อกอินล้ม
- `applySession` สั่ง `queryClient.clear()` ล้างข้อมูลที่แคชของผู้ใช้คนก่อนทิ้ง

### ขั้น 17–18: แนบบัตรทุกคำขอ (`http.ts`)
อ่าน token จาก `getStoredToken()` ทุกครั้งที่ยิง (`:63`) แล้วใส่หัว (`:69`):
```
Authorization: Bearer eyJhbGciOi...(บัตร)
```
อ่านจาก storage ตรงๆ ไม่ผ่าน React state จึงไม่มีช่วงที่คำขอยังใช้บัตรเก่าหลังล็อกอิน/ออกจากระบบ

### ขั้น 19–21: backend ตรวจบัตร (`auth.middleware.ts`)
```ts
// readUser :20-42  (ย่อ)
const header = request.headers.authorization;
if (header === undefined) return undefined;                       // :22-24  ไม่มี header
const parts = header.split(' ');
if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) throw unauthenticated();  // :26-29
try { payload = tokens.verify(parts[1]); } catch { throw unauthenticated(); }           // :31-36
if (typeof payload.sub !== 'string' || payload.sub === '' || !isRole(payload.role)) throw unauthenticated(); // :38-40
return { sub: payload.sub, role: payload.role };                  // :41
```
ลายเซ็นถูก ไม่ได้แปลว่าข้อมูลในบัตรถูกรูปแบบ จึงตรวจ `sub`/`role` ซ้ำ (`verify` คืนชนิด `unknown`) ข้อความ 401 เหมือนกันทุกสาเหตุ ไม่บอกว่าผิดเพราะอะไร

### middleware 3 ตัวเทียบกัน
| middleware | ไฟล์:บรรทัด | ใช้เมื่อ | ไม่มีบัตร | บัตรเสีย | ไม่ใช่ admin |
|---|---|---|---|---|---|
| `optionalAuth` | `:49-57` | ล็อกอินหรือ guest ก็ได้ | ผ่านเป็น guest | **401** (ไม่แอบลดเป็น guest เพื่อไม่ให้ประวัติหายเงียบๆ) | – |
| `requireAuth` | `:59-68` | ต้องล็อกอิน | 401 | 401 | – |
| `requireAdmin` | `:70-80` | ต้องเป็น admin (วางหลัง `requireAuth`) | 401 | – | **403** `FORBIDDEN` |

ตัวอย่างที่ติด: `/auth/me` ใช้ `requireAuth` (`auth.routes.ts:21`) · `/traversal/sessions*`, `/history*` ใช้ `optionalAuth` · `/admin/*` ใช้ `requireAuth` → `requireAdmin` ทีละ route (ไม่ครอบทั้ง path เพื่อให้ path ที่ไม่มีจริงยังได้ 404)

## สายพานที่คำขอล็อกอินผ่าน (สั้นๆ)
```
คำขอ → [cors app.ts:66] → [express.json app.ts:67] → [router /auth app.ts:71]
     → [route handler auth.routes.ts:16, ห่อด้วย asyncRoute error-handler.ts:111-115]
     → [parseLoginBody] → AuthService.login → UsersStore.findByEmail → DB
 error → [errorHandler app.ts:79 → error-handler.ts:74-100] → JSON {statusCode, code, message}
```
คำขอล็อกอิน **ไม่ผ่าน auth middleware** (ยังไม่มีบัตร) ส่วนคำขอหลังจากนั้นที่แนบบัตรจะผ่าน `optionalAuth`/`requireAuth` ที่ route ติดไว้

## ถ้ามีอะไรผิดพลาด
| กรณี | เกิดอะไร |
|---|---|
| อีเมล/รหัสผ่านไม่ผ่านที่หน้าจอ | แสดงใต้ช่อง ไม่ยิง API |
| ข้อมูลไม่ครบ/รูปแบบผิดที่ backend | 400 `INVALID_AUTH_REQUEST` |
| **อีเมลหรือรหัสผ่านไม่ถูก** | 401 `INVALID_CREDENTIALS` ข้อความเดียวทุกกรณี → กล่อง error ที่หน้า (ไม่เด้งไปหน้าล็อกอินซ้ำ เพราะ `anonymous:true` ไม่เข้าเงื่อนไข `http.ts:91`) |
| บัตรหมดอายุ/เสียระหว่างใช้งาน | 401 `UNAUTHENTICATED` → `unauthorizedHandler` → ล้างล็อกอิน → `/login?reason=expired&next=...` |
| เป็น user ธรรมดาเรียก `/admin/*` | `requireAdmin` → 403 `FORBIDDEN` |
| เซิร์ฟเวอร์ไม่ตอบ | `NETWORK_ERROR` (`http.ts:80`) ตอนเปิดเว็บ `/auth/me` ล้ม ใช้ค่าที่จำไว้ต่อ (`AuthProvider.tsx:72-75`) |

## ข้อสังเกต
- **ไม่มี logout ฝั่งเซิร์ฟเวอร์:** token ใช้ได้จนหมดอายุ (7 วัน) แม้กดออกจากระบบ (ข้อจำกัดที่ยอมรับ)
- token ใน `localStorage` ถ้าเว็บมีช่องโหว่ XSS สคริปต์อ่านได้ (หัวไฟล์ `authStorage.ts:4-7` ระบุไว้เอง)
- `role` ใน token เชื่อตามที่ออก ไม่ query DB ทุกคำขอ เปลี่ยน role แล้วต้องรอ token เก่าหมดอายุ (`/auth/me` อ่าน DB เฉพาะตอนเปิดเว็บ)
- `AdminRoute` ฝั่งหน้าจอเป็น UX เท่านั้น (`AdminRoute.tsx:16-17`) ตัวบังคับจริงคือ `requireAdmin`
- ไม่มี rate limit กันเดารหัสผ่าน

## ถาม-ตอบ

**1. สมชายแก้ `role` ใน localStorage เป็น `admin` แล้วเปิด `/admin/analytics` จะเห็นอะไร?**
หน้าจอ (`AdminRoute`) อ่าน role ที่จำไว้ อาจแสดงหน้าได้ชั่วขณะ แต่ (ก) ตอนเปิดเว็บ `GET /auth/me` อัปเดต role จากเซิร์ฟเวอร์ทับ (`AuthProvider.tsx:64-70`) จึงกลับเป็น `user` และเห็นหน้า "ไม่มีสิทธิ์" (ข) ต่อให้ข้ามได้ ทุกคำขอ `/admin/*` ใช้ token จริงที่ `role` ถูกเซ็นไว้ใน JWT แก้ไม่ได้ → `requireAdmin` ตอบ **403** หน้าจอไม่ได้ข้อมูลเลย

**2. กดออกจากระบบแล้ว token เดิมยังใช้ได้ไหม?**
ใช้ได้จนหมดอายุ (7 วัน) ถ้ามีใครได้ token ไปก่อน เพราะ backend ไม่มีรายการเพิกถอน (ไม่มี logout endpoint และไม่เก็บ token ใน DB) ปุ่มออกจากระบบแค่ลบ token ออกจากเบราว์เซอร์

**3. ล็อกอินผิดได้ 401 ทำไมหน้าจอไม่เด้งไปหน้าล็อกอินซ้ำ?**
`login` ตั้ง `anonymous:true` จึงไม่แนบ token ที่ `http.ts:91` เงื่อนไขคือ `status === 401 && token !== undefined` token เป็น `undefined` จึงไม่เรียก `unauthorizedHandler` หน้าจอแสดงแค่กล่อง error "อีเมลหรือรหัสผ่านไม่ถูกต้อง" (401 ของการล็อกอินคือรหัสผิด ไม่ใช่ token เสีย)

**4. ทำไมไม่พบอีเมลก็ยังเรียก `compare` กับ `dummyHash`?**
กันการวัดเวลาตอบ: ถ้าข้าม `compare` เมื่อไม่พบอีเมล จะตอบเร็วกว่ากรณีพบ คนร้ายเดาได้ว่าอีเมลไหนมีบัญชี (user enumeration) `dummyHash` ทำให้เวลาใกล้เคียงกัน และข้อความ error เหมือนกันทั้งสองกรณี

**5. ส่ง `Authorization: Bearer` (ไม่มี token ตามหลัง) ไปที่ `/auth/me` และ `/history` จะได้อะไร?**
**401 ทั้งสองที่** มี header แล้วแต่รูปแบบผิด (`readUser` `auth.middleware.ts:26-29`) `optionalAuth` ก็ไม่ปล่อยเป็น guest เพราะ "มี header แต่ใช้ไม่ได้ = 401"

**6. ถ้าลำดับเป็น `[requireAdmin, requireAuth]` จะเกิดอะไร?**
`requireAdmin` รันก่อนจึงยังไม่มี `request.user` ทุกคนได้ 401 รวมถึง admin จริง (`requireAdmin` ต้องวางหลัง `requireAuth` เสมอ)

## ไฟล์ที่ช่วงนี้แตะ เรียงตามลำดับการเรียก
- **Frontend:** `AppShell.tsx` → `App.tsx` → `LoginPage.tsx` → `lib/authForm.ts` → `AuthProvider.tsx` → `api/auth.ts` → `api/http.ts` → `lib/authStorage.ts` (+ `AdminRoute.tsx` กรณีหน้า admin)
- **Backend:** `app.ts` → `auth/auth.routes.ts` → `auth/auth.dto.ts` → `auth/auth.service.ts` → `auth/users.store.ts` → `auth/token.ts` · ตอนใช้บัตร: `auth/auth.middleware.ts` · เมื่อเกิด error: `common/error-handler.ts`
- **DB:** `migrations/001_users.sql`
