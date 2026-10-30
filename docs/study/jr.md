# บันทึกการเรียน: เดินตาม User Journey ทีละช่วง (ช่วง 1–4)

> เก็บคำอธิบายและถาม-ตอบจากการเดินตาม `docs/USER_JOURNEY_WALKTHROUGH.md` เพื่อให้กลับมาอ่านและจดเองได้ · เลขบรรทัดตามไฟล์บนดิสก์ ณ 24 ต.ค. 2569
> **วิธีใช้:** แต่ละช่วงมี "ตารางเส้นทาง" (ขั้น → ไฟล์:บรรทัด → function) พร้อมคอลัมน์ **โน้ตของฉัน** เว้นว่างไว้ให้จดเอง
> **สถานะ:** ช่วง 1–4 เดินแล้ว · ช่วง 5–9 (เดินผัง, บันทึก, ประวัติ, ให้คะแนน, แดชบอร์ด) ยังไม่ได้เดิน จะเพิ่มต่อท้ายเมื่อเดินแล้ว
> **ข้อควรรู้:** ไฟล์ `frontend/src/api/queries.ts` ถูกลบคอมเมนต์แล้ว เลขบรรทัดในข้อความช่วง 3 ที่เคยพูดไว้ (เช่น `queries.ts:70-72`) คลาดเคลื่อน ในเอกสารนี้ใช้เลขปัจจุบัน (`useGraphs :41`, `useManuals :49`, `useSymptomSearch :97`, `useCacheSession :103`, `useStartSession :118`) · ทุกข้อความมาจากการอ่านโค้ด ไม่ได้รันทดสอบจริง

## สารบัญ
0. แผนที่ + ลำดับ middleware ของ request
1. ช่วงที่ 1: สมัครสมาชิก
2. ช่วงที่ 2: เข้าสู่ระบบ + JWT + auth middleware
3. เสริม: เรื่อง "identity" ใน frontend (3 ชั้น)
4. ช่วงที่ 3: เลือกเครื่อง → เลือกรุ่น
5. ช่วงที่ 4: พิมพ์อาการ → ค้นหา → เริ่มตรวจ (+ ขยายความเรื่องค้นหา)

---

# 0. แผนที่ + ลำดับ middleware

## แผนที่ 9 ช่วง
```
1 สมัคร ─► 2 ล็อกอิน ─► 3 เลือกเครื่อง/รุ่น ─► 4 พิมพ์อาการ+ค้นหา+เริ่มตรวจ
                                                        │
        9 แดชบอร์ด(admin) ◄─ 8 ให้คะแนน ◄─ 7 ดูประวัติ ◄─ 6 บันทึก ◄─ 5 เดินผังทีละขั้น
```
- ระบบ **ไม่ให้ AI ตอบเอง** ค้นอาการที่ใกล้เคียงแล้ว **เดินผังขั้นตอนที่เขียนไว้ตามคู่มือ**
- ไม่ล็อกอินก็ใช้ได้ (guest) ล็อกอินเพื่อเก็บประวัติไว้กับบัญชี

## คำขอหนึ่งตัวผ่านอะไรบ้าง (สายพาน)
```
ผู้ใช้ ─► [1 cors] ─► [2 express.json] ─► [3 express.urlencoded] ─► [4 router ตาม path]
                                                                        │
                                          ┌─────────────────────────────┘
                                          ▼
                       [4a auth middleware] ─► [4b asyncRoute] ─► [4c parse* ตรวจ input]
                                                                        │
                                                                        ▼
                                                    service ─► store ─► MySQL
 ไม่ตรง router ไหน ─► [5 notFoundHandler → 404]      error จากทุกด่าน ─► [6 errorHandler]
```
| ด่าน | ไฟล์:บรรทัด | พูดง่ายๆ |
|---|---|---|
| 1 `cors` | `app.ts:66` | อนุญาตหน้าเว็บคนละโดเมนเรียก backend ได้ |
| 2 `express.json()` | `app.ts:67` | แปลง JSON ที่ส่งมาเป็น `request.body` |
| 3 `express.urlencoded` | `app.ts:68` | อ่าน body แบบฟอร์ม (journey นี้ส่ง JSON) |
| 4 router | `app.ts:70-76` | ดูชื่อ path แล้วส่งไปไฟล์ `*.routes.ts` |
| 4a auth middleware | `auth/auth.middleware.ts:49-80` | ตรวจบัตรผ่าน เฉพาะ route ที่ติดไว้ |
| 4b `asyncRoute` | `common/error-handler.ts:111-115` | ห่อ handler async ให้ error ไม่ค้าง |
| 4c `parse*` | `*.dto.ts` | ตรวจรูปร่างข้อมูล (handler เรียกเอง ไม่ใช่ middleware) |
| 5 `notFoundHandler` | `app.ts:78` → `error-handler.ts:103-105` | ไม่ตรง route → 404 |
| 6 `errorHandler` | `app.ts:79` → `error-handler.ts:74-100` | ปลายทางของ error ทุกตัว → `{statusCode, code, message}` |

ไม่พบ: logging middleware, helmet, compression, rate limit, ไลบรารี schema validation

## ถาม-ตอบ (ส่วนที่ 0)
**1. ถ้าย้าย `cors(...)` ไปไว้หลังการ mount router จะเกิดอะไร?**
คำขอที่ตรง route ถูก router ตอบไปก่อนถึง `cors` คำตอบไม่มีหัว CORS เบราว์เซอร์จะไม่ให้หน้าเว็บ (คนละโดเมน) อ่านคำตอบ (ผลจากกฎลำดับของ Express ไม่ได้ลองรัน)

**2. ทำไม auth middleware ติดทีละ route ไม่ใช้ `app.use('/admin', requireAuth)`?**
ถ้าครอบทั้งกลุ่ม path ที่ไม่มีจริงใต้ `/admin` จะได้ 401 แทน 404 และเลือกแบบ "ล็อกอินหรือ guest ก็ได้" (`optionalAuth`) ต่อ route ไม่ได้

**3. `parseLoginBody` โยน 400 error เดินทางผ่านอะไรจนเป็นคำตอบที่หน้าจอได้รับ?**
โยน `ApiError` ใน handler → `asyncRoute` จับด้วย `.catch(next)` → Express ข้ามไป `errorHandler` → `toBody` เจอ `ApiError` → ตอบ `{statusCode:400, code:'INVALID_AUTH_REQUEST', message}` → `api/http.ts:95-99` แปลงเป็น `ApiError` ฝั่งหน้าจอ → `ErrorNotice` แสดงข้อความตาม `code`

---

# 1. ช่วงที่ 1: สมัครสมาชิก

**เรื่อง:** สมชายกดปุ่ม "สมัครสมาชิก" ตั้งแต่นิ้วแตะจนมีแถวใหม่ในตาราง `users`

## ตารางเส้นทาง
| ขั้น | เกิดอะไร | ไฟล์:บรรทัด | function / โค้ด | โน้ตของฉัน |
|---|---|---|---|---|
| 1 | กดลิงก์ "สมัครสมาชิก" ในเมนู | `components/layout/AppShell.tsx:74-76` · `App.tsx:49` | `NavLink to="/register"` · `<Route path="/register">` | |
| 2 | พิมพ์ข้อมูล | `pages/RegisterPage.tsx:24-27` | `useState` 3 ตัว (ชื่อ/อีเมล/รหัสผ่าน) | |
| 3 | กดปุ่ม ตรวจฝั่งหน้าจอ | `RegisterPage.tsx:38-44` · `lib/authForm.ts:44-62` | `handleSubmit` → `validateRegister` (ผิด → แสดงใต้ช่อง ไม่ส่ง) | |
| 4 | สั่งส่ง | `RegisterPage.tsx:29-32` | `useMutation` → `submit.mutate()` | |
| 5 | เรียกผ่าน provider | `components/auth/AuthProvider.tsx:75-80` | `register` | |
| 6 | api client | `api/auth.ts:22-29` | `register()` → `request('/auth/register', {anonymous:true})` | |
| 7 | ยิง fetch | `api/http.ts:59-107` | `request()` (ไม่แนบ token เพราะ `anonymous`) | |
| 8 | **backend** ผ่าน cors + json | `backend/src/app.ts:66-67` | `cors`, `express.json` | |
| 9 | เข้า router | `app.ts:71` · `auth/auth.routes.ts:11-14` | `router.post('/register')` (ไม่มี auth middleware) | |
| 10 | ตรวจ input ซ้ำ | `auth/auth.dto.ts:89` (`:53` `:65` `:80`) | `parseRegisterBody` (หยิบแค่ 3 ฟิลด์ เมินฟิลด์อื่นเช่น `role`) | |
| 11 | ตรรกะสมัคร | `auth/auth.service.ts:33-53` | `AuthService.register`: `hash` `:34` → `create` `:38-44` (`role: Role.User`) → `issue` `:52` | |
| 12 | บันทึกลง DB | `auth/users.store.ts:65-84` (SQL `:68-70`) | `UsersStore.create` → `INSERT INTO users ...` แล้ว `findById` | |
| 13 | ตาราง | `backend/migrations/001_users.sql:12-23` | `users` (`email` UNIQUE) | |
| 14 | ออกบัตรผ่าน | `auth/auth.service.ts:74-77` · `auth/token.ts:32-34` | `issue` → `tokens.sign({sub, role})` | |
| 15 | ตอบ 201 → หน้าจอแปลง | `api/auth.ts:9-11` | `toStoredAuth` เก็บแค่ `{token, user:{id,displayName,role}}` (ไม่เก็บอีเมล) | |
| 16 | เก็บล็อกอิน | `AuthProvider.tsx:58-66` · `lib/authStorage.ts:46-53` | `applySession` → `storeAuth` → `localStorage['fixstep.auth']` + `queryClient.clear()` | |
| 17 | ไปหน้าถัดไป | `RegisterPage.tsx:31` | `navigate(next ?? '/history')` | |

## ข้อควรจำ
- รหัสผ่านถูก hash ด้วย bcrypt ก่อนเก็บ (ไม่เก็บรหัสจริง) · `role` ตายตัวเป็น `user` สมัครเป็น admin ไม่ได้
- ตรวจ 2 ที่: หน้าจอ (UX บอกทันที) และ backend (ตัวตัดสินจริง) กฎหน้าจอคัดลอกมือ ต้องแก้ 2 ที่เมื่อเปลี่ยนกฎ
- ไม่มี rate limit ไม่มียืนยันอีเมล · token อยู่ใน `localStorage`

## ถ้าผิดพลาด
| กรณี | เกิดอะไร |
|---|---|
| ข้อมูลไม่ผ่านที่หน้าจอ | แสดงใต้ช่อง ไม่ยิง API |
| ไม่ผ่านที่ backend | 400 `INVALID_AUTH_REQUEST` |
| อีเมลซ้ำ | DB `ER_DUP_ENTRY` → `users.store.ts:73-75` → `auth.service.ts:46-47` → 409 `EMAIL_TAKEN` → กล่อง error + ลิงก์ไปล็อกอิน (`RegisterPage.tsx:87-93`) |
| เซิร์ฟเวอร์ไม่ตอบ | `NETWORK_ERROR` (`http.ts:80`) |

## ถาม-ตอบ
**1. รหัสผ่านพิมพ์ 5 ตัวแล้วกดสมัคร มีคำขอไป backend ไหม?**
ไม่มี `validateRegister` พบข้อผิดพลาดแล้ว `return` ก่อน `submit.mutate()` (`RegisterPage.tsx:40-42`) แต่ถ้ายิง API ตรง backend ก็ตอบ 400 เพราะตรวจซ้ำที่ `parsePassword`

**2. สมัครด้วยอีเมลที่มีอยู่แล้ว ไล่เส้นทางจาก DB ถึงหน้าจอ**
`INSERT` ชน UNIQUE `uq_users_email` → `ER_DUP_ENTRY` → `DuplicateEmailError` (`users.store.ts:73-75`) → `ApiError 409 EMAIL_TAKEN` (`auth.service.ts:46-47`) → `errorHandler` → `http.ts:95-99` → `ErrorNotice` + ลิงก์ล็อกอิน (error ถูกแปลงทีละชั้น: DB → store → service → HTTP)

**3. ทำไมหน้าจอเก็บแค่ id / ชื่อ / role ไม่เก็บอีเมล?**
เก็บเท่าที่ต้องใช้แสดงผล (`toAuthUser` `api/auth.ts:5-7`) ลดข้อมูลส่วนตัวที่ค้างใน `localStorage`

---

# 2. ช่วงที่ 2: เข้าสู่ระบบ + JWT + auth middleware

**เรื่อง:** สมชายมีบัญชีแล้ว วันถัดมากด "เข้าสู่ระบบ"

## JWT คืออะไร
บัตรผ่านที่เซิร์ฟเวอร์ออกให้หลังล็อกอิน ผู้ใช้แนบมาทุกคำขอ
- ข้างในบัตร (`token.ts:32-34`): `sub` (id ผู้ใช้), `role`, `iat` (ออกเมื่อ), `exp` (หมดเมื่อ ค่าเริ่มต้น 7 วัน)
- **ใครก็อ่านข้อมูลในบัตรได้** แต่ **ปลอมไม่ได้** เพราะมีลายเซ็นจาก `JWT_SECRET` (HS256) · ห้ามใส่ความลับในบัตร

## ตารางเส้นทาง
| ขั้น | เกิดอะไร | ไฟล์:บรรทัด | function / โค้ด | โน้ตของฉัน |
|---|---|---|---|---|
| 1 | กดล็อกอิน | `pages/LoginPage.tsx:90-92`, `:42-48` · `lib/authForm.ts:36-42` | `handleSubmit` → `validateLogin` (อีเมลถูกรูป + รหัสผ่านไม่ว่าง) | |
| 2 | ส่ง | `LoginPage.tsx:32-35` · `AuthProvider.tsx:68-73` · `api/auth.ts:13-20` | `useMutation` → `login` → `POST /auth/login` (`anonymous:true`) | |
| 3 | router | `auth/auth.routes.ts:16-19` | `router.post('/login')` | |
| 4 | ตรวจ input | `auth/auth.dto.ts:99` | `parseLoginBody` | |
| 5 | หาผู้ใช้ | `auth/auth.service.ts:56` · `auth/users.store.ts:37-39`, `:56` | `findByEmail` → `SELECT ... FROM users WHERE email = ? LIMIT 1` | |
| 6 | เทียบรหัสผ่าน | `auth.service.ts:58` | `compare(password, user ? hash : this.dummyHash)` (`dummyHash` `:26` กัน timing) | |
| 7 | ผิด → 401 | `auth.service.ts:59-61` | `invalidCredentials()` ข้อความเดียวทุกกรณี | |
| 8 | ออกบัตร | `auth.service.ts:63` · `auth/token.ts:32-34` | `issue` → `tokens.sign` | |
| 9 | เก็บบัตร | `AuthProvider.tsx:58-66` · `lib/authStorage.ts:3, 46-53` | `applySession` → `localStorage['fixstep.auth']` (+สำเนาในหน่วยความจำ `:10`) | |
| 10 | แนบบัตรทุกคำขอ | `api/http.ts:63`, `:69` | `getStoredToken()` → `Authorization: Bearer <token>` (ยกเว้น `anonymous`) | |
| 11 | backend อ่านบัตร | `auth/auth.middleware.ts:20-42` | `readUser` (ไม่มี header → `undefined`; รูปแบบผิด/verify ล้ม/ข้อมูลผิด → 401) | |
| 12 | ตรวจลายเซ็น | `auth/token.ts:37-40` | `verify` บังคับ `algorithms: ['HS256']` | |
| 13 | middleware 3 ตัว | `auth.middleware.ts:49-57`, `:59-68`, `:70-80` | `optionalAuth`, `requireAuth`, `requireAdmin` (403 ถ้าไม่ใช่ admin) | |
| 14 | ตอนเปิดเว็บ ยืนยันตัวตน | `AuthProvider.tsx:39-56` → `api/auth.ts:31-33` → `auth.routes.ts:21-24` → `auth.service.ts:66-72` → `users.store.ts:60-63` | `getMe` → `GET /auth/me` (`requireAuth`) → `me` → `findById` แล้วหน้าจอเอา role/ชื่อจากเซิร์ฟเวอร์ทับ (`:64-70`) | |
| 15 | บัตรเสีย/หมดอายุ | `api/http.ts:91-93` → `AuthProvider.tsx:25-36` | `unauthorizedHandler` ล้างล็อกอิน+แคช → `/login?reason=expired&next=...` | |
| 16 | ออกจากระบบ | `AppShell.tsx:84-86` → `AuthProvider.tsx:90-93` | `logout` (ล้างฝั่งเบราว์เซอร์อย่างเดียว) | |

## middleware 3 ตัวเทียบกัน
| middleware | ใช้เมื่อ | ไม่มีบัตร | บัตรเสีย | ไม่ใช่ admin |
|---|---|---|---|---|
| `optionalAuth` | ล็อกอินหรือ guest ก็ได้ | ผ่านเป็น guest | **401** | – |
| `requireAuth` | ต้องล็อกอิน | 401 | 401 | – |
| `requireAdmin` (วางหลัง `requireAuth`) | ต้องเป็น admin | 401 | – | **403** |

ผ่านแล้วผลถูกวางที่ `request.user` อ่านด้วย `currentUser(request)` (`auth.middleware.ts:13-15`) ข้อความ 401 เหมือนกันทุกสาเหตุ ไม่บอกว่าผิดเพราะอะไร

## ข้อควรจำ
- ไม่มี logout ฝั่งเซิร์ฟเวอร์ token ใช้ได้จนหมดอายุ (7 วัน) · token ใน `localStorage` (เสี่ยง XSS)
- `role` ใน token เชื่อตามที่ออก ไม่ query DB ทุกคำขอ (`/auth/me` อ่าน DB เฉพาะตอนเปิดเว็บ)
- `AdminRoute` หน้าจอเป็น UX เท่านั้น ตัวบังคับจริงคือ `requireAdmin`

## ถาม-ตอบ
**1. แก้ `role` ใน localStorage เป็น `admin` แล้วเปิด `/admin/analytics` จะเห็นอะไร?**
หน้าจออ่าน role ที่จำไว้ อาจแสดงหน้าชั่วขณะ แต่ (ก) `GET /auth/me` ตอนเปิดเว็บอัปเดต role จากเซิร์ฟเวอร์ทับ (`AuthProvider.tsx:64-70`) กลับเป็น `user` เห็นหน้า "ไม่มีสิทธิ์" (ข) ต่อให้ข้ามได้ ทุกคำขอ `/admin/*` ใช้ token จริงที่ `role` ถูกเซ็นใน JWT แก้ไม่ได้ → `requireAdmin` ตอบ 403

**2. กดออกจากระบบแล้ว token เดิมยังใช้ได้ไหม?**
ใช้ได้จนหมดอายุ (7 วัน) ถ้ามีใครได้ token ไป เพราะ backend ไม่มีรายการเพิกถอน ปุ่มแค่ลบ token ออกจากเบราว์เซอร์ (ข้อจำกัดที่ยอมรับ)

**3. ล็อกอินผิดได้ 401 ทำไมหน้าจอไม่เด้งไปหน้าล็อกอินซ้ำ?**
`login` ตั้ง `anonymous:true` จึงไม่แนบ token `http.ts:91` เงื่อนไข `status === 401 && token !== undefined` ไม่เข้า จึงไม่เรียก `unauthorizedHandler` แสดงแค่กล่อง error

---

# 3. เสริม: "identity" ใน frontend (3 ชั้น)

```
ชั้น 1  AuthContext        "ฉันเป็นใคร"           → status + user          (สถานะล็อกอิน)
ชั้น 2  useIdentity()      "แคชนี้ของใคร"          → user.id หรือ 'guest'   (ป้ายแยกแคช)
ชั้น 3  ownerHeaders()     "บอก backend ว่าฉันคือ" → Bearer token หรือ X-Client-Id
```

| ชั้น | ไฟล์:บรรทัด | สาระ |
|---|---|---|
| 1 สถานะล็อกอิน | `lib/authContext.ts:13-25`; คำนวณที่ `components/auth/AuthProvider.tsx:114-117` | `guest` / `verifying` (มี token กำลังถาม `/auth/me`) / `user` · เป็น UX เท่านั้น |
| 2 ป้ายแยกแคช | `lib/authContext.ts:46-48` `useIdentity()` | คืน `user.id` หรือ `'guest'` ใช้เป็นส่วนของ key ใน `api/queries.ts` (ค้นคำว่า `identity`) |
| 3 บอก backend | `lib/clientHeaders.ts:12-14` `ownerHeaders()` · `lib/clientId.ts:34-53` | ล็อกอิน → ไม่ส่ง `X-Client-Id` (token พูดแทน) · guest → ส่ง UUID จาก `localStorage['fixstep.clientId']` |

key ที่มี identity: `['session', identity, id]`, `['history', identity, 'list'|'detail', ...]`, `['admin', identity, ...]` · key ที่ไม่มี (ข้อมูลสาธารณะ): `['manuals']`, `['graphs', manualId?]`, `['health']`

**สองชั้นป้องกันข้อมูลปนกันระหว่างผู้ใช้:** (1) `queryClient.clear()` ตอน login/register/logout/token หมดอายุ (`AuthProvider.tsx:87, 110, 51`) (2) identity ใน key

| เหตุการณ์ | `useIdentity()` | key แคชประวัติ | หัวที่ส่ง backend |
|---|---|---|---|
| เปิดเว็บ (guest) | `'guest'` | `['history','guest','list',1]` | `X-Client-Id: <uuid>` |
| ล็อกอิน | ล้างแคช → `<id สมชาย>` | `['history','<id>','list',1]` | `Authorization: Bearer ...` |
| ออกจากระบบ | ล้างแคช → `'guest'` | `['history','guest','list',1]` | `X-Client-Id` กลับมา |

`identity` เป็นแค่ป้ายแยกแคช **ไม่ใช่การยืนยันตัวตน** (`'guest'` เป็นข้อความธรรมดา และ `X-Client-Id` ก็ไม่ใช่การยืนยัน)

## ถาม-ตอบ
**1. ทำไมใส่ identity ใน key ทั้งที่ล้างแคชตอน login/logout อยู่แล้ว?**
ชั้นป้องกันที่สอง เผื่อคำขอเก่าที่ตอบช้ามาเขียนแคชหลังสลับผู้ใช้ หรือคอมโพเนนต์ที่ยัง mount key ต่างกันจึงไม่ปนแม้ชั้นแรกพลาด

**2. ทำไม `['manuals']` ไม่มี identity?**
ข้อมูลสาธารณะเหมือนกันทุกคน (แต่ `queryClient.clear()` ล้างทุก key รวมอันนี้ ผู้ใช้โหลดใหม่หนึ่งครั้งหลังสลับ)

**3. ล็อกอินแล้วทำไมไม่ส่ง `X-Client-Id`?**
backend ให้ token ชนะเสมอและไม่ดู `X-Client-Id` ถ้าล็อกอิน (`clientHeaders.ts:7-8`) ส่งซ้ำไม่มีประโยชน์ และกันตัวระบุที่ปลอมง่ายมาปนกับบัญชีจริง

---

# 4. ช่วงที่ 3: เลือกเครื่อง → เลือกรุ่น

**เรื่อง:** สมชายล็อกอินแล้ว กด "เลือกเครื่องที่มีปัญหา" · ช่วงนี้ **ไม่ยิง SQL ตอนใช้งาน** ข้อมูลอยู่ในหน่วยความจำตั้งแต่ตอนบูต

## ตารางเส้นทาง
| ขั้น | เกิดอะไร | ไฟล์:บรรทัด | function / โค้ด | โน้ตของฉัน |
|---|---|---|---|---|
| 1 | กดปุ่มจากหน้าแรก | `pages/HomePage.tsx:17` | `navigate('/devices')` | |
| 2 | เปิดหน้า โหลดรายการรุ่น | `pages/DevicesPage.tsx:29` · `api/queries.ts:49` (`useManuals`, `staleTime: Infinity`) · `api/traversal.ts:24-26` | `GET /traversal/manuals` | |
| 3 | backend router | `traversal/traversal.routes.ts:32-34` | `router.get('/manuals')` (ไม่มี auth middleware) | |
| 4 | service | `traversal/traversal.service.ts:48-50` | `listManuals` | |
| 5 | อ่านจากหน่วยความจำ | `traversal/graph.repository.ts:99-118` | `listManuals` (รวมผังเป็นรุ่น นับ `graphCount`) | |
| 6 | (ตอนบูต) โหลดข้อมูลเข้าหน่วยความจำ | `app.ts:58` → `graph.repository.ts:120-172` (SQL `:121-139`) | `graphs.load()` → `loadAll` (สร้าง Map ใหม่ก่อน ค่อยสลับ) | |
| 7 | ขั้น 1 เลือกประเภท | `DevicesPage.tsx:71-93` (กด `:81`) | `CategoryStep` → `setParams({category})` | |
| 8 | ขั้น 2 เลือกรุ่น | `DevicesPage.tsx:95-157` | `ModelStep` | |
| 9 | กรองด้วยเลขรุ่น (ฝั่งหน้าจอ) | `DevicesPage.tsx:119` · `lib/models.ts:22-24` | `manualMatches` (pattern + alias, `*` แทนอักษรใดก็ได้) | |
| 10 | "ฉันไม่ทราบรุ่น" | `DevicesPage.tsx:151-153`, `:123-127` | สลับ `isUnknown` (ระบบไม่เลือกให้) | |
| 11 | เลือกรุ่น → ไปหน้าเลือกอาการ | `DevicesPage.tsx:104-106` · `lib/modelSelection.ts:17-21` | `pick` → `symptomsPath(manualId, 'selected'\|'unknown')` → `/symptoms?manual=...[&unknown=1]` | |
| 12 | อ่านรุ่นที่เลือกกลับ | `lib/modelSelection.ts:9-14` | `useChosenModel()` (เก็บใน URL ไม่มี store) | |
| ทางเลือก | อาการทั้งหมด | `pages/AllSymptomsPage.tsx` · `api/queries.ts:41` (`useGraphs`) · `api/traversal.ts:19-22` · `traversal.routes.ts:27-29` · `traversal.service.ts:42-45` · `graph.repository.ts:87-97` | `GET /traversal/graphs?manualId=` → `listGraphs` → `listAll` | |

SQL ตอนบูต (`graph.repository.ts`):
```sql
-- :121-129
SELECT g.graph_id, g.manual_id, g.entry_symptom, g.entry_symptom_th, g.entry_symptom_aliases,
       g.source, g.page_start, g.page_end, g.source_chunk_id, g.entry_node,
       m.device_category, m.brand, m.model_pattern, m.display_name, m.model_aliases
  FROM graphs g JOIN manuals m ON m.manual_id = g.manual_id ORDER BY g.graph_id
-- :133-138
SELECT graph_id, node_id, node_type, text_content, on_yes, on_no, next_node, on_invalid,
       input_type, input_pattern, store_as, outcome_kind, safety_critical, safety_warning
  FROM nodes ORDER BY graph_id, display_order
```
อุปกรณ์โหลดแบบเดียวกัน: `app.ts:59` → `traversal/equipment.repository.ts:30-37`

## ข้อควรจำ
- ไม่มีช่องกรอก device/brand/model อิสระ: ประเภทเครื่องเป็นรายการคงที่ ยี่ห้ออยู่ในข้อมูลคู่มือ มีแค่ช่อง "เลขรุ่น" ที่กรองรายการเดิม
- เก็บในหน่วยความจำ: เร็ว แต่ผังที่ seed ด้วยสคริปต์ต้องรีสตาร์ต ส่วนผังที่ admin เผยแพร่ระบบโหลดซ้ำให้ (`drafts.service.ts:199`)
- `/traversal/manuals` และ `/graphs` ไม่ตรวจ token จึงไม่พังเพราะ token เสีย (`traversal.routes.ts:8`)

## ถาม-ตอบ
**1. ตอนสมชายเปิด `/devices` มีการยิง SQL ไหม?**
ไม่มี `listManuals` อ่านจาก `Map` ในหน่วยความจำ SQL ยิงครั้งเดียวตอนบูต (`graph.repository.ts:121-139`)

**2. กด "ฉันไม่ทราบรุ่น" แล้วเลือกรุ่นหนึ่ง ระบบเก็บอะไร ใช้ทำอะไร?**
URL ได้ `unknown=1` พอเริ่มตรวจหน้าจอส่ง `modelSelection:'unknown'` → เก็บใน `sessions.model_selection` (`session.store.ts:42-51`) ใช้แยกเคสตอนวัดผลเท่านั้น ไม่เปลี่ยนขั้นตอน หน้าตรวจแสดงกล่องเตือน (`SessionPage.tsx:155-157`)

**3. admin เผยแพร่คู่มือใหม่ ผู้ใช้ที่เปิด `/devices` ค้างไว้เห็นรุ่นใหม่ไหม?**
backend ตอบรุ่นใหม่ทันที (`reload()` `drafts.service.ts:199`) แคชของ admin ถูกล้าง (`['manuals']`) แต่ผู้ใช้อื่นที่เปิดค้าง `staleTime: Infinity` จึงเห็นเมื่อรีเฟรชหน้า (อ่านจากโค้ด ไม่ได้ทดสอบ)

---

# 5. ช่วงที่ 4: พิมพ์อาการ → ค้นหา → เริ่มตรวจ

**เรื่อง:** สมชายเลือกรุ่นไมโครเวฟแล้ว พิมพ์ "ไมโครเวฟไม่ร้อน" · **ไม่มีการเรียก LLM** ตอนค้นหาและเริ่ม session ระบบแค่ค้นอาการที่ใกล้เคียง ให้ผู้ใช้เลือกเอง แล้วเดินผังที่เขียนไว้

## ตารางเส้นทาง: ค้นหา
| ขั้น | เกิดอะไร | ไฟล์:บรรทัด | function / โค้ด | โน้ตของฉัน |
|---|---|---|---|---|
| 1 | ไม่มีรุ่นใน URL → เด้งกลับ | `pages/SymptomsPage.tsx:52` | `<Navigate to="/devices">` | |
| 2 | ช่องพิมพ์ + ปุ่มค้นหา | `components/SymptomSearchForm.tsx:24-32` · `lib/textInput.ts:10-15` | `checkText` (ว่าง/เกิน 200 → กดไม่ได้) | |
| 3 | กดค้นหา | `SymptomsPage.tsx:28-31` | `handleSearch` → `search.mutate({query, manualId})` | |
| 4 | hook | `api/queries.ts:97` | `useSymptomSearch` (`useMutation` ไม่แคช) | |
| 5 | api client | `api/traversal.ts:47-52` | `POST /symptom-search` body `{query, manualId}` | |
| 6 | backend router | `symptom-search/symptom-search.routes.ts:9-13` | `router.post('/')` (ไม่มี auth middleware) | |
| 7 | ตรวจ input | `symptom-search/symptom-search.dto.ts:14` | `parseSearchBody` (≤ 200, `manualId` ≤ 80) | |
| 8 | service | `symptom-search/symptom-search.service.ts:160-192` | `search` | |
| 8.1 | ระบบพร้อมไหม | `:161-162` | `loading` → 503 `SEARCH_NOT_READY` · ไม่พร้อม → 503 `SEARCH_UNAVAILABLE` | |
| 8.2 | แปลงคำพิมพ์เป็นเวกเตอร์ | `:164` → `embedding/embedding.service.ts:46-55` | `embed` (384 ตัว, normalize) | |
| 8.3 | กรองตามรุ่น (ในหน่วยความจำ) | `:165-168` | `.filter(... manualId ...)` | |
| 8.4 | cosine + จัดอันดับ | `symptom-search/symptom-matcher.ts:64-88` (cosine `:20-41`) | `rankGraphs` | |
| 8.5 | ตัดผล | `service :172` → `matcher:90-96` | `selectMatches(ranked, 0.55, 3)` | |
| 8.6 | ประกอบคำตอบ | `service :186-191` | `{query, threshold, bestScore, matches}` | |
| 9 | แสดงผล | `components/SymptomSearchResults.tsx:13-32` · `components/SymptomRow.tsx:23-33` | ไม่มีผล → "ไม่พบ…" · มีผล → แถว + คะแนน + `matchedText` | |
| 10 | error บางชนิดเป็นกล่องฟ้า | `SymptomsPage.tsx:31`, `:102-111` | `SEARCH_INFO_CODES` | |

## ตารางเส้นทาง: เตรียมดัชนีตอนบูต
| ขั้น | เกิดอะไร | ไฟล์:บรรทัด | function / โค้ด | โน้ตของฉัน |
|---|---|---|---|---|
| 1 | เริ่มโดยไม่รอ | `app.ts:60` → `symptom-search.service.ts:45-54` | `start()` (ต้อง `SYMPTOM_SEARCH_ENABLED=true`) | |
| 2 | โหลดโมเดล | `service :62` → `embedding.service.ts:23-34` | `embedding.load()` (จาก `backend/model`, `allowRemoteModels=false`) | |
| 3 | ดึงข้อความของทุกผัง | `symptom-matcher.ts:43-62` | `buildSymptomTexts` (ไทย + อังกฤษ + alias) | |
| 4 | แปลงเป็นเวกเตอร์ | `service :78-88` | `embed` ทีละข้อความ (ข้อความซ้ำใช้ร่วมกัน) | |
| 5 | เก็บในดัชนี | `service :56-102` | `prepareIndex` → `this.index` · สถานะ `loading → ready/failed` | |
| 6 | ผังใหม่หลัง admin เผยแพร่ | `drafts/drafts.service.ts:199, 205` → `service :112-158` | `reload()` แล้ว `addGraphs` | |

## ตารางเส้นทาง: เลือกผล → เริ่มตรวจ
| ขั้น | เกิดอะไร | ไฟล์:บรรทัด | function / โค้ด | โน้ตของฉัน |
|---|---|---|---|---|
| 1 | กดแถว | `components/SymptomRow.tsx:23` → `SymptomsPage.tsx:83` | `onSelect(graphId)` | |
| 2 | เริ่ม | `lib/useStartSymptom.ts:27-33` | `start(graphId, {query, manualId, modelSelection})` | |
| 3 | hook | `api/queries.ts:118` | `useStartSession` | |
| 4 | api client | `api/traversal.ts:37-44` · `lib/clientHeaders.ts:12-14` | `POST /traversal/sessions` + `ownerHeaders()` | |
| 5 | router + ด่านบัตร | `traversal/traversal.routes.ts:40-48` | `optionalAuth` | |
| 6 | ตรวจ input | `traversal/traversal.dto.ts:92-117` | `parseStartSessionBody` | |
| 7 | หาเจ้าของ | `auth/session-owner.ts:14-23` | `resolveOptionalOwner` | |
| 8 | service | `traversal/traversal.service.ts:56-73` | `startSession` | |
| 8.1 | ตรวจผัง/รุ่น | `:63-66` | `requireGraph`, `GRAPH_MANUAL_MISMATCH` | |
| 8.2 | คิดคะแนนความคล้าย | `:186-193` → `symptom-search.service.ts:193-199` | `computeConfidence` → `scoreGraph` (แปลงคำค้นเป็นเวกเตอร์ซ้ำ) | |
| 8.3 | เริ่มเครื่องสถานะ | `traversal-engine/traversal-engine.ts:4-24` | `startSession` (สร้าง `sessionId` ตั้งโหนดแรก) | |
| 8.4 | บันทึก | `traversal/session.store.ts:38-57` | `create` → `INSERT INTO sessions ...` (หมดอายุ 24 ชม.) | |
| 9 | ประกอบ response | `traversal.service.ts:156-172` | `toResponse` (อุปกรณ์จากหน่วยความจำ + `displayText` ผ่าน rephrase) | |
| 10 | หน้าจอเก็บผล + ไปหน้าตรวจ | `api/queries.ts:103` · `useStartSymptom.ts:31` | `useCacheSession` → `navigate('/session/:id')` | |

```sql
-- session.store.ts:41-43
INSERT INTO sessions
  (session_id, graph_id, current_node_id, status, variables, confidence, model_selection, client_id, user_id, expires_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW() + INTERVAL ? HOUR)
```

## ขยายความ: เซิร์ฟเวอร์ค้นหาทำอะไรทีละขั้น
เปรียบ: **ดัชนี = สมุดรายชื่ออาการทุกอาการที่แปลงเป็นพิกัดไว้ล่วงหน้า** พอผู้ใช้พิมพ์ ระบบแปลงคำพิมพ์เป็นพิกัดเหมือนกัน แล้ววัดว่าจุดของคำพิมพ์อยู่ใกล้อาการไหนมากที่สุด

**ข้อมูลที่เตรียมไว้ (`this.index`)** — แต่ละรายการ `{ graphId, text, vector[384] }` และ **ผังหนึ่งมีหลายข้อความได้** (ชื่อไทย + ชื่ออังกฤษ + alias) เพราะคนเรียกอาการเดียวกันหลายแบบ

| ขั้น | โค้ด | ทำอะไร |
|---|---|---|
| 0 รับคำขอ | `routes :9-13` | ตรวจ input ด้วย `parseSearchBody` แล้วเรียก `search` · ไม่มี auth middleware (ค้นหาไม่เก็บข้อมูลรายบุคคล) |
| 1 ระบบพร้อมไหม | `service :161-162` | `loading` → 503 `SEARCH_NOT_READY` · ไม่ `ready` → 503 `SEARCH_UNAVAILABLE` |
| 2 แปลงเป็นเวกเตอร์ | `service :164`, `embedding.service.ts:46-55` | โมเดล AI แปลงข้อความเป็นตัวเลข 384 ตัว ที่ข้อความ **ความหมายใกล้กัน** ได้ตัวเลขใกล้กัน แม้ใช้คำต่างกัน · `normalize:true` ทำให้เวกเตอร์ยาว 1 |
| 3 เลือกว่าจะเทียบกับอะไร | `service :165-168` | มี `manualId` → `.filter` เหลือเฉพาะผังของรุ่นนั้น (กรองในหน่วยความจำ ไม่ใช่ SQL) · ไม่มี → เทียบทุกผัง |
| 4 วัดความใกล้ (cosine) | `matcher :20-41` | วัดว่าเวกเตอร์สองตัวชี้ไปทางเดียวกันแค่ไหน: ทางเดียวกัน ≈ 1 · ไม่เกี่ยวกัน ≈ 0 · สวนทาง ติดลบ |
| 5 จัดอันดับต่อผัง | `matcher :64-88` | เทียบคำพิมพ์กับ **ทุกข้อความของผัง** เก็บ **คะแนนสูงสุดต่อผัง** พร้อมข้อความที่ชนะ (`matchedText`) เพื่อให้ผู้ใช้เห็นผังละแถวเดียว · เรียงมาก→น้อย เท่ากันเรียงตาม `graphId` (ผลนิ่ง) |
| 6 ตัดผล | `matcher :90-96`, `service :11-12, :172` | เอาเฉพาะคะแนน **≥ 0.55** และไม่เกิน **3** ผัง · เทียบด้วยค่าเต็มก่อนปัดเศษ (`round3` `:180`) กันกรณี 0.5496 ถูกปัดเป็น 0.550 แล้วผ่านเกณฑ์ |
| 7 ประกอบคำตอบ | `service :186-191` | `bestScore` = คะแนนสูงสุดของทุกผัง (แม้ไม่ถึงเกณฑ์) เป็น `null` เมื่อไม่มีอะไรให้เทียบเลย (ต่างจาก 0) |

ตัวอย่างจำลอง (ตัวเลขสมมติ 2 มิติ เพื่อให้เห็นภาพ ของจริง 384 มิติ) คำพิมพ์ = (1, 0):
| ข้อความ | เวกเตอร์ | cosine |
|---|---|---:|
| อุ่นอาหารไม่ขึ้น (ผัง A) | (0.9, 0.4) | ≈ 0.91 |
| จานหมุนไม่หมุน (ผัง B) | (0.3, 0.9) | ≈ 0.32 |
| ตู้เย็นไม่เย็น (ผัง C) | (0, 1) | 0 |
→ ผ่านเกณฑ์ 0.55 เฉพาะผัง A

## ข้อควรจำ
- "confidence" คือ **คะแนนความคล้ายของข้อความ ไม่ใช่ความน่าจะเป็นที่ถูก** หน้าจอบอกชัดและไม่แปลงเป็น % (`textInput.ts:22-24`)
- ไม่มี LLM ตอนค้นหา/เริ่ม session · ไม่เก็บเวกเตอร์ใน MySQL (สร้างในหน่วยความจำตอนบูต) · ไม่ใช่ SQL filter
- `scoreGraph` แปลงคำค้นเป็นเวกเตอร์ซ้ำตอนเริ่ม session (ซ้ำซ้อนเล็กน้อย)
- ข้อความ "ติดต่อศูนย์บริการ Samsung" ตายตัวในหน้าจอ (`SymptomSearchResults.tsx:16`)
- เกณฑ์ 0.55 และ top 3: **ไม่ทราบเหตุผลที่เลือก**

## ถาม-ตอบ
**1. ทำไมตอนเริ่ม session ต้องส่ง `query` ไปด้วย?**
เพื่อให้ backend คำนวณคะแนนความคล้ายของผังที่เลือก เก็บใน `sessions.confidence` ไว้แสดงและวัดผล ไม่มีผลต่อขั้นตอน ถ้าเริ่มจาก "อาการทั้งหมด" ไม่ส่ง `query` ค่าเป็น `NULL` (`useStartSymptom.ts:23-26`, `traversal.service.ts:186-187`)

**2. เลือกรุ่นไมโครเวฟ แต่พิมพ์ "ตู้เย็นไม่เย็น" จะเกิดอะไร?**
ตามตรรกะโค้ด กรองเฉพาะผังของรุ่นที่เลือก (`service :165-168`) เทียบแต่อาการของไมโครเวฟ คะแนนน่าจะต่ำกว่า 0.55 → `matches: []` → "ไม่พบอาการที่ใกล้เคียง" พร้อมทางไป "อาการทั้งหมด" (ไม่ได้ทดสอบ)

**3. backend เพิ่งบูต สมชายกดค้นหาทันที จะเห็นอะไร?**
โมเดลยังโหลด (`state='loading'`) → 503 `SEARCH_NOT_READY` (`service :161`) หน้าจอแสดงกล่องสีฟ้า ไม่ใช่ error แดง (`SymptomsPage.tsx:31`, `:102-111`) ชวนใช้ "อาการทั้งหมด" ระบบไม่ล่ม เพราะ `start()` ไม่รอโมเดล

**4. ค่า 0.55 และ top 3 เลือกเพราะอะไร?**
ไม่ทราบ ในโค้ดไม่ได้ระบุเหตุผล (เอกสารบันทึกว่าเกณฑ์ยังไม่ได้ประเมินด้วยชุดทดสอบที่มนุษย์ตรวจ) ตอบกรรมการตรงๆ ว่าเป็นเกณฑ์เสนอรายการให้เลือก ไม่ใช่ตัวตัดสินความถูกต้อง

**5. ผัง A มี 3 ข้อความ ได้ 0.40, 0.88, 0.61 ผังนี้ได้คะแนนเท่าไร `matchedText` คือข้อความไหน?**
ได้ 0.88 และ `matchedText` คือข้อความที่ได้ 0.88 (เก็บคะแนนสูงสุดต่อผัง ไม่ใช่ค่าเฉลี่ย `matcher :70-79`)

**6. ผังสองผังได้ 0.70 เท่ากัน ลำดับขึ้นกับอะไร?**
เรียงตาม `graphId` ตามตัวอักษร (`matcher :82-87`) ให้ผลนิ่งทุกครั้ง

**7. พิมพ์คำที่ไม่เกี่ยวกับเครื่อง เช่น "วันนี้อากาศดี" `matches` กับ `bestScore` เป็นอย่างไร?**
ปกติทุกผังต่ำกว่า 0.55 → `matches: []` แต่ `bestScore` ยังเป็นตัวเลข (คะแนนสูงสุดที่เจอ) ไม่ใช่ `null` เพราะ `null` ใช้เมื่อไม่มีข้อความให้เทียบเลย (ตามตรรกะโค้ด ไม่ได้ทดสอบ)

**8. ทำไมเทียบกับ 0.55 ด้วยค่าเต็ม ไม่ใช่ค่าที่ปัดแล้ว?**
กันผลคลาดเคลื่อนจากการปัดเศษ (0.5496 ปัดเป็น 0.550 แล้วผ่านเกณฑ์ทั้งที่จริงไม่ถึง) คอมเมนต์ที่ `service :171` ระบุไว้

---

## ที่ยังไม่ได้เดิน (จะเพิ่มต่อท้ายไฟล์นี้)
- ช่วงที่ 5: เดินผังทีละขั้น (ใช่/ไม่ใช่, ด่านความปลอดภัย, ที่มาของแต่ละขั้น)
- ช่วงที่ 6: บันทึก session / ผลลัพธ์
- ช่วงที่ 7: ประวัติ (list + detail)
- ช่วงที่ 8: ให้คะแนน (feedback)
- ช่วงที่ 9: แดชบอร์ดผู้ดูแล

(ข้อมูลเต็มของช่วง 5–9 อยู่ใน `docs/USER_JOURNEY_WALKTHROUGH.md` แล้ว แต่ยังไม่ได้เดินอธิบายทีละขั้น)
