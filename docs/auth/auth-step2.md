# ระบบบัญชีผู้ใช้ ขั้นที่ 2: ผูกประวัติการซ่อมกับผู้ใช้

สถานะ: เขียนครบ · `npm run build` ผ่าน · `npx jest` ผ่าน 74 เคส (ใช้ฐานข้อมูลจำลองในหน่วยความจำ)
ยังไม่ได้รัน migration 011 และยังไม่ได้ทดสอบกับเซิร์ฟเวอร์/ฐานข้อมูลจริง (ดูหัวข้อ 6 และ 7)

---

## 1. ภาพรวม

### ปัญหา
ก่อนหน้านี้ระบบ **ไม่มีเจ้าของจริง** ประวัติการซ่อมผูกกับ `client_id` ซึ่งเป็น UUID ที่เบราว์เซอร์สุ่มสร้างเองและเก็บใน localStorage
- ใครรู้ `client_id` ก็เปิดดูหรือลบประวัติของ id นั้นได้ (ไม่ใช่การยืนยันตัวตน)
- ล้างข้อมูลเบราว์เซอร์ หรือเปลี่ยนเครื่อง = ประวัติหาย
- endpoint เดินขั้นตอน (`GET`/`actions`/`outcome`) ไม่ตรวจเจ้าของเลย รู้ session id ก็ใช้ได้

### แนวคิดที่แก้
เพิ่มคอลัมน์ `user_id` ใน `sessions` (migration 011) แล้วให้ "เจ้าของ" ของ session มีได้ 2 แบบ:

| แบบ | รู้ได้อย่างไร | เก็บอะไรลง `sessions` |
|---|---|---|
| **user** (ล็อกอิน) | ส่ง `Authorization: Bearer <token>` ที่ถูกต้อง | `user_id` = id ผู้ใช้, `client_id` = NULL |
| **guest** (ไม่ล็อกอิน) | ส่ง `X-Client-Id` เหมือนเดิม | `client_id` = UUID ของเบราว์เซอร์, `user_id` = NULL |

ผู้ใช้ที่ล็อกอินไม่ต้องส่ง `X-Client-Id` และ guest ใช้งานได้เหมือนเดิมทุกอย่าง (ระบบเดิมและ demo ไม่พัง)

---

## 2. ตารางเปรียบเทียบ: แต่ละ endpoint ตรวจเจ้าของอย่างไร

| Endpoint | ก่อน (Step 1) | หลัง (Step 2) |
|---|---|---|
| `POST /traversal/sessions` (เริ่มตรวจ) | `X-Client-Id` ไม่บังคับ → บันทึก `client_id` | ล็อกอิน → บันทึก `user_id` · guest → บันทึก `client_id` เหมือนเดิม · token เสีย → 401 |
| `GET /traversal/sessions/:id` | ไม่ตรวจ | session ของ user: ต้องมี token ของเจ้าของ ไม่ใช่ → **404** · session ของ guest/เก่า: ใช้ id เป็นกุญแจเหมือนเดิม |
| `POST …/actions` | ไม่ตรวจ | เหมือนข้างบน |
| `POST …/outcome` | ไม่ตรวจ | เหมือนข้างบน |
| `DELETE /traversal/sessions/:id` | `client_id` ตรง | user: `user_id` ตรง · guest: `client_id` ตรง **และ** `user_id IS NULL` · ไม่ใช่ → 404 |
| `GET /history` | `client_id` ตรง | user: `user_id` ตรง · guest: `client_id` ตรงและ `user_id IS NULL` |
| `GET /history/:id` | `client_id` ตรง | เหมือนข้างบน (ไม่ใช่เจ้าของ → 404) |
| `DELETE /history/:id` | `client_id` ตรง | เหมือนข้างบน |
| `POST /history/:id/feedback` | ตรวจเจ้าของ session ก่อน | เหมือนข้างบน (`session_feedback` ไม่มี `user_id` ถึงผู้ใช้ผ่าน session) |
| `GET /traversal/graphs`, `/manuals`, `/symptom-search`, `/health` | สาธารณะ | สาธารณะเหมือนเดิม (ไม่ติด guard จึงไม่พังเพราะ token เสีย) |

ทุกกรณีที่ "ไม่ใช่ของคุณ" ตอบ **404** เหมือนไม่มี session นั้น ไม่ใช้ 403 เพื่อไม่บอกว่า id นั้นมีอยู่จริง

---

## 3. กฎ "เจ้าของแบบเดียว" และเหตุผล

**กฎ:** session หนึ่งมีเจ้าของได้แบบเดียว ล็อกอิน → เก็บ `user_id` และ `client_id` เป็น NULL · guest → เก็บ `client_id` และ `user_id` เป็น NULL
และคำสั่งของ guest ทุกตัวต้องมี `AND user_id IS NULL`

**เหตุผล:** frontend แนบ `X-Client-Id` ทุกคำขอ ถ้าไม่มีกฎนี้ จะเกิดช่องโหว่ในกรณีเครื่องใช้ร่วมกัน:
1. ผู้ใช้ A ล็อกอินที่เครื่องนี้ ทำการตรวจเสร็จ (session เก็บ `client_id` ของเบราว์เซอร์นี้ไว้ด้วย)
2. A ล็อกเอาต์ คนอื่นเปิดเครื่องเดียวกันแบบ guest → ส่ง `client_id` ตัวเดียวกัน
3. ถ้า guest query เป็นแค่ `client_id = ?` คนนั้นจะเห็น/ลบประวัติของ A ได้

กฎเจ้าของแบบเดียวทำให้ session ของ A ไม่มี `client_id` ให้เทียบเลย และ `AND user_id IS NULL` เป็นอีกชั้นกันแถวที่บังเอิญมีทั้งสองค่า (ครอบคลุมด้วยเทสต์ `LEGACY`)
นอกจากนี้ผู้ใช้ที่ล็อกอินแล้ว **ไม่ดู** `X-Client-Id` เลย จึงสลับเป็น guest ด้วยหัวข้อนี้ไม่ได้

เงื่อนไข SQL และค่าที่เขียนตอนสร้าง session อยู่ที่ไฟล์เดียว (`auth/session-owner.ts`) store ทุกตัวเรียกจากที่นั่น จึงไม่มีใครเขียนเงื่อนไขเองแล้วพลาด

---

## 4. การตัดสินใจ (a)–(g)

| ข้อ | คำถาม | ตัดสินใจ | เหตุผล / ข้อแลกเปลี่ยน |
|---|---|---|---|
| (a) | Guest ใช้ได้ไหม | ได้ ใช้ `client_id` เหมือนเดิม | ไม่ทำให้ flow เดิมและ demo พัง · แลกกับที่ guest ยังไม่มีเจ้าของจริง (ข้อจำกัดเดิม) |
| (b) | โครงสร้างตาราง | `user_id CHAR(36) NULL` + index + FK **`ON DELETE SET NULL`** · ไม่ทำ "claim" · ใช้กฎเจ้าของแบบเดียว | SET NULL เก็บข้อมูลวัดผล (confidence, model_selection) ไว้แม้ลบบัญชี แต่ความเป็นส่วนตัวน้อยกว่า CASCADE (ตอนนี้ยังไม่มี endpoint ลบบัญชี) · ไม่ claim เพราะเครื่องที่ใช้ร่วมกันจะดึง session ของ guest อื่นมาเป็นของตัวเอง |
| (c) | `session_feedback` | ไม่เพิ่ม `user_id` | ถึงผู้ใช้ผ่าน session ได้อยู่แล้ว (1 session = 1 แถว, FK CASCADE) · เจ้าของ 2 ที่อาจไม่ตรงกัน |
| (d) | วิธีรู้ว่าใครเรียก | `OptionalJwtAuthGuard`: ไม่มี token = guest · token เสีย/หมดอายุ = **401** | ไม่แอบลดเป็น guest เพื่อไม่ให้ผู้ใช้งงว่าประวัติหาย · ข้อแลก: token หมดอายุค้างในเครื่องทำให้เริ่มตรวจไม่ได้ จนกว่า Step 4 จัดการ 401 (ลบ token แล้วพาไปล็อกอิน) |
| (e) | การตรวจสิทธิ์ | e1: session ของ user ต้องมี token ของเจ้าของ (ไม่ใช่ → 404) · session ของ guest ใช้ id เป็นกุญแจ | ทำให้ "user A ไม่มีวันเห็น session ของ user B" เป็นจริงทั้งระบบ โดยไม่เปลี่ยนพฤติกรรมของ guest · แลกกับการ query เพิ่ม 1 ครั้งต่อคำขอ (`findUserId`) |
| (f) | Admin เห็นทุก session | ทำใน Step 3 | แยกขอบเขตงาน |
| (g) | อายุประวัติ | คง 90 วันเหมือนเดิม | ไม่ต้องแก้ cleanup/เงื่อนไข `expires_at` · แลกกับที่ประวัติของ user หายหลัง 90 วัน |

---

## 5. ไฟล์ที่เพิ่ม/แก้ (ทั้งหมดใต้ appliance-repair-assistant/)

### เพิ่ม
| ไฟล์ | หน้าที่ |
|---|---|
| `backend/migrations/011_add_session_user_id.sql` | เพิ่ม `sessions.user_id` + index + FK SET NULL |
| `backend/src/auth/optional-jwt-auth.guard.ts` | guard แบบ guest ได้ แต่ token เสีย = 401 |
| `backend/src/auth/session-owner.ts` | ชนิด `SessionOwner`, หา owner จาก request, สร้างเงื่อนไข SQL และค่าที่เขียนตอนสร้าง (ที่เดียว) |
| `backend/src/auth/testing/fake-sessions-pool.ts` | ฐานข้อมูลจำลองสำหรับเทสต์ (ไม่ถูก build เข้า dist) |
| `backend/src/auth/session-owner.spec.ts` | เทสต์การหา owner และเงื่อนไข SQL |
| `backend/src/auth/optional-jwt-auth.guard.spec.ts` | เทสต์ guard (guest / token ถูก / token เสีย / รูปแบบผิด) |
| `backend/src/history/history-ownership.spec.ts` | เทสต์กฎเจ้าของของหน้าประวัติ ครอบคลุม 4 กรณี |
| `backend/src/traversal/traversal-ownership.spec.ts` | เทสต์การสร้าง/ลบ session และด่านเจ้าของของ GET/actions/outcome |
| `docs/auth/auth-step2.md` | เอกสารนี้ |

### แก้
| ไฟล์ | สิ่งที่เปลี่ยน |
|---|---|
| `backend/src/auth/jwt-auth.guard.ts` | แยก `verifyBearer()` ออกมาใช้ร่วมกัน (พฤติกรรมของ `JwtAuthGuard` เดิม) |
| `backend/src/auth/auth.module.ts` | ลงทะเบียน/ส่งออก `OptionalJwtAuthGuard` |
| `backend/src/traversal/session.store.ts` | `create`/`delete` รับ `SessionOwner` · เพิ่ม `findUserId()` |
| `backend/src/traversal/traversal.service.ts` | รับ owner · เพิ่ม `authorize()` (e1) |
| `backend/src/traversal/traversal.controller.ts` | ติด `OptionalJwtAuthGuard` กับ 5 endpoint ของ session |
| `backend/src/traversal/traversal.module.ts` | import `AuthModule` |
| ~~`backend/src/traversal/traversal.exception.filter.ts`~~ | (ถูกลบตอนรวม filter) การแปลง 401/403 ย้ายไป `backend/src/common/all-exceptions.filter.ts` |
| `backend/src/history/history.store.ts`, `history.service.ts`, `history.controller.ts`, `history.module.ts` | เปลี่ยน `clientId` เป็น `owner` ทุกจุด · ติด guard · import `AuthModule` |
| `backend/tsconfig.build.json` | ไม่ build โฟลเดอร์ `testing/` เข้า dist |

**ไม่แตะ:** frontend ทั้งหมด (ยังเป็น guest 100% จนถึง Step 4), troubleshoot-assistantv2

---

## 6. ขั้นตอนทดสอบ (PowerShell)

### เตรียมการ
```powershell
cd C:\Users\SPS\Desktop\499\appliance-repair-assistant\backend
npm run migrate        # รัน 011 (ต้องเห็น "รอรัน 1")
npm run build
npm run start:prod     # เปิดค้างไว้อีกหน้าต่าง · ต้องหยุดเซิร์ฟเวอร์เก่าก่อน
```

เตรียมตัวแปร (ชื่อกราฟต้องมีอยู่จริง — ดึงจาก API):
```powershell
$api = 'http://localhost:3000'
$graph = (Invoke-RestMethod "$api/traversal/graphs")[0].graphId
$json = 'application/json'
function Reg($mail) { Invoke-RestMethod "$api/auth/register" -Method Post -ContentType $json -Body (@{ email=$mail; password='demo-pass-123'; displayName=$mail } | ConvertTo-Json) }
function Err($code) { try { & $code; 'ไม่มี error (ผิดคาด)' } catch { $_.ErrorDetails.Message } }

$a = Reg "a$(Get-Random)@example.com";  $ha = @{ Authorization = "Bearer $($a.accessToken)" }
$b = Reg "b$(Get-Random)@example.com";  $hb = @{ Authorization = "Bearer $($b.accessToken)" }
$client = [guid]::NewGuid().ToString(); $hg = @{ 'X-Client-Id' = $client }

# เริ่มตรวจ 1 session ต่อคน: A (ล็อกอิน), B (ล็อกอิน), guest
$body = @{ graphId = $graph } | ConvertTo-Json
$sessA = Invoke-RestMethod "$api/traversal/sessions" -Method Post -ContentType $json -Headers $ha -Body $body
$sessB = Invoke-RestMethod "$api/traversal/sessions" -Method Post -ContentType $json -Headers $hb -Body $body
$sessG = Invoke-RestMethod "$api/traversal/sessions" -Method Post -ContentType $json -Headers $hg -Body $body
```

> หมายเหตุ: หน้าประวัติแสดงเฉพาะ session ที่ **จบแล้ว** ถ้าจะดูรายการต้องเดินขั้นตอนให้จบก่อน
> (ส่ง action ไปที่ `POST /traversal/sessions/:id/actions` ตามโหนดของผัง) ส่วนการทดสอบ GET/DELETE ของ session ด้านล่างใช้ session ที่ยังเดินอยู่ได้เลย

### กรณีที่ (1): user A อ่าน/ลบ session ของ user B ไม่ได้
```powershell
# A อ่าน session ของ B → ต้องได้ 404 SESSION_NOT_FOUND
Err { Invoke-RestMethod "$api/traversal/sessions/$($sessB.sessionId)" -Headers $ha }
# A เดินขั้นตอนใน session ของ B → 404
Err { Invoke-RestMethod "$api/traversal/sessions/$($sessB.sessionId)/actions" -Method Post -ContentType $json -Headers $ha -Body '{"type":"continue"}' }
# A ลบ session ของ B → 404
Err { Invoke-RestMethod "$api/traversal/sessions/$($sessB.sessionId)" -Method Delete -Headers $ha }
# ไม่มี token เลย อ่าน session ของ B → 404
Err { Invoke-RestMethod "$api/traversal/sessions/$($sessB.sessionId)" }
# B ยังอ่าน session ของตัวเองได้ → ต้องได้ข้อมูล session
Invoke-RestMethod "$api/traversal/sessions/$($sessB.sessionId)" -Headers $hb | Select-Object sessionId, status
```
ผลที่ควรเห็น: 4 คำสั่งแรกได้ `{"statusCode":404,"code":"SESSION_NOT_FOUND",...}` และคำสั่งสุดท้ายได้ข้อมูลของ B

ฝั่งประวัติ (หลังเดิน session ของ B ให้จบแล้ว):
```powershell
Err { Invoke-RestMethod "$api/history/$($sessB.sessionId)" -Headers $ha }                  # 404 HISTORY_NOT_FOUND
Err { Invoke-RestMethod "$api/history/$($sessB.sessionId)" -Method Delete -Headers $ha }   # 404 HISTORY_NOT_FOUND
(Invoke-RestMethod "$api/history" -Headers $ha).items.sessionId                          # ไม่มี id ของ B
```

### กรณีที่ (2): guest เห็นประวัติของ user ไม่ได้ แม้ใช้ client_id เดียวกัน
```powershell
# ล็อกอินเป็น A แต่ส่ง X-Client-Id ของ guest มาด้วย → ต้องถือเป็น A (ไม่ดู X-Client-Id)
Invoke-RestMethod "$api/traversal/sessions" -Method Post -ContentType $json -Headers ($ha + $hg) -Body $body | Select-Object sessionId
# session นี้ต้องไม่ปรากฏของ guest: ตอนเป็น guest (ส่งแค่ X-Client-Id) อ่านประวัติ/ลบ session ของ A ไม่ได้
Err { Invoke-RestMethod "$api/traversal/sessions/$($sessA.sessionId)" -Method Delete -Headers $hg }   # 404
Err { Invoke-RestMethod "$api/history/$($sessA.sessionId)" -Headers $hg }                            # 404 (เมื่อ session จบแล้ว)
(Invoke-RestMethod "$api/history" -Headers $hg).items.sessionId                                    # ไม่มี id ของ A
```
ผลที่ควรเห็น: ได้ 404 ทั้งหมด และรายการของ guest ไม่มี session ของ A
(กรณี "แถวมีทั้ง `user_id` และ `client_id` ตรงกัน" ครอบคลุมด้วยเทสต์ `LEGACY` เพราะระบบใหม่ไม่เขียนแถวแบบนั้นแล้ว)

### กรณีที่ (3): guest flow เดิมยังทำงาน
```powershell
# guest อ่าน session ของตัวเองด้วย id (ไม่ต้องมี token) → ได้ข้อมูล
Invoke-RestMethod "$api/traversal/sessions/$($sessG.sessionId)" | Select-Object sessionId, status
# guest ไม่ส่ง X-Client-Id ตอนเริ่มตรวจ ก็เริ่มได้ (ไม่ปรากฏในประวัติของใคร)
Invoke-RestMethod "$api/traversal/sessions" -Method Post -ContentType $json -Body $body | Select-Object sessionId
# guest ลบ session ของตัวเอง → 204 (ไม่มี body)
Invoke-RestMethod "$api/traversal/sessions/$($sessG.sessionId)" -Method Delete -Headers $hg
# ไม่ส่ง X-Client-Id และไม่ส่ง token ที่ endpoint ประวัติ → 400 INVALID_CLIENT_ID (เหมือนเดิม)
Err { Invoke-RestMethod "$api/history" }
# token เสีย → 401 UNAUTHENTICATED
Err { Invoke-RestMethod "$api/history" -Headers @{ Authorization = 'Bearer abc.def.ghi' } }
```
ผลที่ควรเห็น: ได้ข้อมูล / ได้ sessionId / ลบสำเร็จไม่มี error / ได้ `400 INVALID_CLIENT_ID` / ได้ `401 UNAUTHENTICATED`

### กรณีที่ (4): แถวเก่าที่ `user_id = NULL` ยังโหลดได้
แถวเก่า = session ที่สร้างก่อน migration 011 (`user_id` เป็น NULL ทั้งหมดหลัง migrate)
1. ก่อนรัน migration 011 ให้จด `client_id` ที่เคยใช้ในเบราว์เซอร์ demo เดิม (DevTools → Application → Local Storage → `fixstep.clientId`)
2. หลังรัน migration และเปิด backend ใหม่ ลองเรียกด้วย id เดิม:
```powershell
$old = '<ใส่ client_id เดิม>'
(Invoke-RestMethod "$api/history" -Headers @{ 'X-Client-Id' = $old }).total     # ต้องเท่าเดิมก่อน migrate
```
ผลที่ควรเห็น: รายการและรายละเอียดของประวัติเดิมยังเปิดได้ (ไม่หาย ไม่เปลี่ยน)
ฝั่งเทสต์อัตโนมัติ: `OLD` ในไฟล์ `history-ownership.spec.ts` ครอบคลุมเรื่องนี้ (รายการ/รายละเอียด/ลบ/ไม่แสดงถ้าหมดอายุ)

### เทสต์อัตโนมัติ
```powershell
cd C:\Users\SPS\Desktop\499\appliance-repair-assistant\backend
npx jest
```
ต้องผ่าน 74 เคส (6 ชุด)

---

## 7. ข้อจำกัดที่รู้

- **ไม่มี rate limit** ที่ `/auth/login` และ `/auth/register` (พอสำหรับ demo บน localhost)
- **ไม่มี claim** session ของ guest ไม่ย้ายมาเป็นของ user เมื่อล็อกอิน ประวัติที่ทำก่อนล็อกอินจะอยู่กับ `client_id` เดิม ไม่ปรากฏในบัญชี
- **role อยู่ใน token** เชื่อ role ตามที่ออกไปตอนล็อกอิน (ไม่ query DB ทุกคำขอ) เปลี่ยน role แล้วต้องล็อกอินใหม่หรือรอ token หมดอายุ (`JWT_EXPIRES_IN`, ค่าเริ่มต้น 7 วัน)
- **TTL 90 วัน** session ที่จบแล้วหายจากประวัติหลัง 90 วัน ทั้งของ user และ guest
- **frontend ยังไม่ส่ง token จนถึง Step 4** ทุกคนที่ใช้หน้าเว็บตอนนี้จึงเป็น guest 100% ฟีเจอร์ของ user ทดสอบได้ผ่าน PowerShell เท่านั้น
- **ลบบัญชีแล้ว session กลายเป็นไม่มีเจ้าของ** (SET NULL) ยังอยู่ในฐานข้อมูลจนหมดอายุ ไม่ปรากฏในประวัติของใคร (ยังไม่มี endpoint ลบบัญชี)
- **guest ยังไม่ใช่การยืนยันตัวตน** ใครรู้ `client_id` ก็เห็นประวัติ guest ของ id นั้นได้ (ข้อจำกัดเดิม) และ session ของ guest ที่รู้ session id ก็เปิดผ่าน `GET /traversal/sessions/:id` ได้ (เจตนา: ไม่เปลี่ยนพฤติกรรม guest)
- **ยังไม่ได้ทดสอบกับฐานข้อมูลจริง** เทสต์ใช้ฐานข้อมูลจำลองที่ทำตามเงื่อนไขในข้อความ SQL ที่ store ส่งไป จึงพิสูจน์ได้ว่า "store ใส่เงื่อนไขเจ้าของครบ" (ลองถอน `AND user_id IS NULL` แล้วเทสต์ล้ม 5 เคส) แต่ไม่ได้พิสูจน์ว่า MySQL ตีความ SQL และ FK ใน migration 011 ตามที่คาด ต้องรัน migration และสคริปต์ด้านบนกับ MySQL จริงอีกครั้ง
- ถ้า 011 ยังไม่ถูกรัน backend ตัวใหม่จะเริ่มตรวจไม่ได้ (INSERT ล้มเพราะไม่มีคอลัมน์ `user_id`) ต้องรัน migration ก่อนเปิดเซิร์ฟเวอร์เสมอ
