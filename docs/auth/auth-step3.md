# ระบบบัญชีผู้ใช้ ขั้นที่ 3: endpoint สำหรับผู้ดูแลระบบ (admin) แบบอ่านอย่างเดียว

สถานะ: เขียนครบ · `npm run build` ผ่าน · SQL ของ `AdminStore` ลองรันกับ MySQL จริงแบบอ่านอย่างเดียวแล้ว
**อัปเดต 19 ต.ค. 2569:** ตัด `GET /admin/sessions` ออก (ไม่มีหน้าจอใดเรียก · งานลดความซับซ้อน `docs/SIMPLIFY_REPORT.md` ข้อ B1) เหลือ 2 endpoint · เทสต์อัตโนมัติของขั้นนี้ถูกลบไปแล้ว (หัวข้อ 5 เป็นผลตอนที่ยังมีเทสต์)
ที่ **ยังไม่ได้ทดสอบ** ดูหัวข้อ 5

---

## 1. ภาพรวม

ผู้ดูแลระบบ (role `admin`) ต้องการดูภาพรวมการใช้งานโดยไม่ต้องเปิดฐานข้อมูลเอง: ผู้ใช้ให้คะแนนว่าอย่างไร มีการตรวจกี่ครั้ง จบแบบไหน ผังไหนถูกใช้บ่อย ขั้นนี้มี 2 endpoint **อ่านอย่างเดียว** ใต้ `/admin`

หลักการ:
- **ป้องกันสามชั้นที่ระดับ controller**: `JwtAuthGuard` (ต้องล็อกอิน → 401) → `RolesGuard` + `@Roles(Role.Admin)` (ต้องเป็น admin → 403) → `AllExceptionsFilter` กลางของแอป (ให้ 401/403/400 ออกมาในรูป `{statusCode, code, message}` ไม่กลายเป็น 500)
- **สิทธิ์ตรวจก่อนอ่าน query เสมอ** ผู้ที่ไม่ใช่ admin ส่ง query ผิดก็ได้ 403 ไม่ใช่ 400
- **ไม่เปิดเผยตัวบุคคล**: ไม่มี email, password_hash, ชื่อที่แสดง, user_id, client_id ในผลลัพธ์ใดๆ มีแค่ `ownerType` = `user` / `guest` / `none`
- **flow ของ guest และ user เดิมไม่เปลี่ยน** ไม่ได้แก้โค้ดเดิม (แก้ `app.module.ts` เพื่อลงทะเบียนโมดูลเท่านั้น)

---

## 2. ตาราง endpoint

ทุก endpoint ต้องส่ง `Authorization: Bearer <token ของ admin>`

| Endpoint | หน้าที่ | พารามิเตอร์ (ไม่บังคับทั้งหมด) | หน้าจอที่ใช้ |
|---|---|---|---|
| `GET /admin/feedback` | รายการคะแนน/ความเห็นทั้งหมด ใหม่สุดก่อน | `helpful=true\|false`, `from`, `to` (YYYY-MM-DD), `page` (1–10000), `pageSize` (1–100, ค่าเริ่มต้น 20) | `/admin/feedback` |
| `GET /admin/analytics/summary` | สถิติรวม | `days` (1–90, ค่าเริ่มต้น 30) | `/admin/analytics` |

กฎร่วม: `from`/`to` เป็นวันที่ **เวลาไทย** (`to` นับรวมทั้งวัน), `from` ต้องไม่หลัง `to`, ช่วงไม่เกิน 366 วัน, ค่าว่างถือเหมือนไม่ส่ง, ส่งพารามิเตอร์ซ้ำ (`?page=1&page=2`) = ผิด
ผิดกฎ → `400` `INVALID_ADMIN_QUERY`

### ตัวอย่างผลลัพธ์

`GET /admin/feedback`
```json
{
  "items": [
    {
      "sessionId": "0f5c…",
      "helpful": true,
      "comment": "ใช้ได้ดี",
      "createdAt": "2026-10-16T05:00:00.000Z",
      "updatedAt": "2026-10-16T05:00:00.000Z",
      "graphId": "samsung-microwave-…",
      "deviceCategory": "Microwave",
      "brand": "Samsung",
      "ownerType": "user"
    }
  ],
  "total": 1, "page": 1, "pageSize": 20, "totalPages": 1
}
```

`GET /admin/analytics/summary?days=30`
```json
{
  "window": { "days": 30, "from": "2026-09-17", "to": "2026-10-16" },
  "sessions": { "total": 5, "completed": 3, "inProgress": 1, "expiredUnfinished": 1,
                "byOwner": { "user": 1, "guest": 2, "none": 2 } },
  "feedback": { "total": 4, "helpful": 3, "notHelpful": 1, "satisfactionRate": 0.75 },
  "confidence": { "average": 0.712, "sampleSize": 4 },
  "outcomes": { "user_fixed": 2, "normal_behavior": 0, "handoff_informed": 0, "handoff_unknown": 0, "unknown": 1 },
  "topGraphs": [ { "graphId": "…", "entrySymptomTh": "ไม่ร้อน", "count": 4 } ],
  "topDevices": [ { "deviceCategory": "Microwave", "count": 4 } ],
  "perDay": [ { "date": "2026-10-16", "started": 2, "completed": 1 } ]
}
```
(ตัวอย่างเหล่านี้มาจากข้อมูลทดสอบ ตัวเลขจริงจะต่างกัน)

ข้อควรรู้เกี่ยวกับความหมายของตัวเลข:
- `satisfactionRate` และ `confidence.average` เป็น `null` เมื่อยังไม่มีข้อมูล (ไม่ใช่ 0)
- `expiredUnfinished` = เดินค้างแล้วหมดอายุ **ไม่ใช่ "ยกเลิก"** เพราะการยกเลิกลบแถวทิ้ง จึงนับไม่ได้
- `outcomes` มาจาก `outcome_kind` ของโหนดสุดท้าย ณ ผังปัจจุบัน ถ้าผังถูก seed ใหม่จนหาโหนดไม่เจอจะนับเป็น `unknown`
- `perDay` เติมวันที่ไม่มีข้อมูลเป็น 0 และนับวันตามเวลาไทย
- ทุกส่วนของ summary (sessions, feedback, confidence, outcomes, top, perDay) ใช้ช่วง `days` วันล่าสุดช่วงเดียวกัน

---

## 3. การตัดสินใจและข้อแลกเปลี่ยน

| เรื่อง | ตัดสินใจ | ข้อแลกเปลี่ยน |
|---|---|---|
| (a) Endpoint | 2 ตัว ไม่ทำ `/admin/users` · เดิมมี `/admin/sessions` ด้วย แต่ตัดออก 19 ต.ค. 2569 เพราะไม่มีหน้าจอเรียก | demo มีผู้ใช้น้อย และการแสดงรายชื่อเพิ่มข้อมูลส่วนตัวที่เปิดเผย · แลกกับที่ดูไม่ได้ว่าใครสมัครบ้าง (ดูจำนวนได้ที่ `byOwner`) และดูรายการ session ทีละแถวไม่ได้ (ดูผลรวมได้ที่ summary) |
| (b) ความเป็นส่วนตัว | เห็น `comment` ได้ แต่ไม่ระบุว่าใครเขียน (`ownerType` เท่านั้น) | admin อ่านความเห็นเพื่อปรับปรุงระบบได้ แต่โยงกับตัวบุคคลไม่ได้ · แลกกับที่ตามไปคุยกับผู้ใช้คนนั้นไม่ได้ |
| (c) Store | `AdminStore` ใหม่ อ่านอย่างเดียว | store เดิมผูกกับเจ้าของ (`ownerWhere`) ไม่ต้องไปแตะ · แลกกับ SQL บางส่วนคล้ายของเดิม |
| (d) Index | ไม่เพิ่ม migration | ข้อมูลระดับ demo (หลักร้อยแถว) อ่านทั้งตารางได้เร็วพอ · ถ้าข้อมูลโตเป็นหลักหมื่น-แสนควรเพิ่ม `INDEX (created_at)` |
| (e) โปรเจกต์เก่า | **ไม่กรองด้วย graph_id** | ตรวจแล้วว่า `graphs` เป็นตารางเดียวที่สองโปรเจกต์ใช้ร่วมกัน (644 ผัง, `sessions.graph_id` มี FK, ไม่มี session ที่อ้างผังที่ไม่มี) แยกไม่ได้ ดูหัวข้อ 7 |
| (f) ช่วงเวลา | `days` ใช้กับทุกส่วนของ summary | ตัวเลขทุกตัวเทียบกันได้ · ดูยอดสะสมตลอดกาลไม่ได้ (สูงสุด 90 วัน) |

---

## 4. ไฟล์ (ทั้งหมดใต้ appliance-repair-assistant/backend/)

| ไฟล์ | หน้าที่ |
|---|---|
| `src/admin/admin.dto.ts` | ตัวตรวจ query (`parseFeedbackQuery`, `parseSummaryQuery`) เพดานทั้งหมด วันที่เวลาไทย และชนิด response (ไม่มีช่อง email/id ส่วนตัว) |
| `src/admin/admin.store.ts` | SQL อ่านอย่างเดียวทั้งหมด (พารามิเตอร์ `?` เท่านั้น) |
| `src/admin/admin.service.ts` | ประกอบข้อมูล เติมประเภทเครื่อง/outcome จากผังในหน่วยความจำ คำนวณอัตรา หยิบทีละช่อง (ไม่ spread แถวจาก DB) |
| ~~`src/admin/admin.exception.filter.ts`~~ | (ถูกลบตอนรวม filter) 400 `INVALID_ADMIN_QUERY` โยนเป็น `ApiError` จาก `admin.dto.ts` · 401/403 แปลงโดย `common/all-exceptions.filter.ts` |
| `src/admin/admin.controller.ts` | 2 endpoint พร้อม `@UseFilters` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(Role.Admin)` ระดับ class |
| `src/admin/admin.module.ts` | ประกอบโมดูล (import `AuthModule`, `GraphModule`) |
| `src/app.module.ts` | ลงทะเบียน `AdminModule` |

ไม่มี migration ของขั้นนี้ ไม่แตะ troubleshoot-assistantv2 · หน้าจอ admin อยู่ในขั้นที่ 4 (`docs/auth/auth-step4.md`)

---

## 5. สิ่งที่ทดสอบแล้วและยังไม่ได้ทดสอบ (ตรงไปตรงมา)

### เคยทดสอบตอนเขียนขั้นนี้ (เทสต์อัตโนมัติถูกลบไปแล้ว รันซ้ำไม่ได้)
- เทสต์ยิง HTTP ผ่าน guard → controller → filter ตัวจริง (ปลอมแค่ฐานข้อมูล) ผ่านทุกกรณีต่อไปนี้:
  1. ไม่มี token → 401 `UNAUTHENTICATED`
  2. token ของ user → 403 `FORBIDDEN` (ไม่ใช่ 500)
  3. token ของ admin → 200 พร้อมตรวจรูปร่างและตัวเลขของ response
  4. token หมดอายุ / เซ็นด้วยกุญแจอื่น / ข้อความมั่ว / role ที่ไม่รู้จัก / scheme ไม่ใช่ Bearer → 401 รูปแบบ `{statusCode, code, message}`
  5. `pageSize` เกินเพดาน, `page` = 0, ทศนิยม, ส่งซ้ำ, วันที่ผิด/ไม่มีจริง, `from` หลัง `to`, ช่วงเกิน 366 วัน, enum ผิด, `days` นอก 1–90 → 400 `INVALID_ADMIN_QUERY`
  6. response ไม่มี email / password_hash / id เจ้าของ / ชื่อที่แสดง และ SQL ทุกคำสั่งเป็น SELECT ไม่แตะตาราง users
- **SQL ของ AdminStore ลองกับ MySQL จริง** (อ่านอย่างเดียว) ทุกคำสั่งรันได้

### ยังไม่ได้ทดสอบ
- **ยิง endpoint จริงกับเซิร์ฟเวอร์ที่รันอยู่ด้วย token ของ admin จริง** (ทำตามหัวข้อ 6)
- **รายการ feedback กับข้อมูลจริง** ตอนเขียนขั้นนี้ตาราง `session_feedback` ยังว่าง
- **เวลาไทยกับข้อมูลจริงรายวัน**
- **ประสิทธิภาพ** กับข้อมูลมาก (ไม่มี index เพิ่ม)

---

## 6. ขั้นตอนทดสอบด้วยมือ (PowerShell)

### เตรียม
```powershell
cd C:\Users\SPS\Desktop\499\appliance-repair-assistant\backend
npm run build
# ถ้ายังไม่มีบัญชี admin: ตั้ง ADMIN_EMAIL / ADMIN_PASSWORD ใน .env แล้วรัน
npm run seed:admin
npm run start:prod        # หยุดเซิร์ฟเวอร์เก่าก่อน · เปิดค้างไว้อีกหน้าต่าง
```

อีกหน้าต่างหนึ่ง (ตั้งตัวแปรในเซสชันนี้เอง ไม่ต้องเปิดไฟล์ .env):
```powershell
$api = 'http://localhost:3000'
$json = 'application/json'
function Show($sb) { try { & $sb | ConvertTo-Json -Depth 8 } catch { "HTTP $([int]$_.Exception.Response.StatusCode): $($_.ErrorDetails.Message)" } }

# admin token (ใส่อีเมล/รหัสผ่านของ admin ที่ seed ไว้)
$adminEmail = Read-Host 'admin email'
$adminPass  = Read-Host 'admin password' -AsSecureString
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminPass))
$admin = Invoke-RestMethod "$api/auth/login" -Method Post -ContentType $json -Body (@{ email=$adminEmail; password=$plain } | ConvertTo-Json)
$ha = @{ Authorization = "Bearer $($admin.accessToken)" }
$admin.user.role      # ต้องได้ admin

# user token (สมัครบัญชีธรรมดา)
$u = Invoke-RestMethod "$api/auth/register" -Method Post -ContentType $json -Body (@{ email="u$(Get-Random)@example.com"; password='demo-pass-123'; displayName='U' } | ConvertTo-Json)
$hu = @{ Authorization = "Bearer $($u.accessToken)" }
```

### ทดสอบแต่ละกรณี
```powershell
# (1) ไม่มี token → HTTP 401 {"statusCode":401,"code":"UNAUTHENTICATED",...}
Show { Invoke-RestMethod "$api/admin/feedback" }
Show { Invoke-RestMethod "$api/admin/analytics/summary" }

# (2) token ของ user → HTTP 403 {"statusCode":403,"code":"FORBIDDEN",...}
Show { Invoke-RestMethod "$api/admin/feedback" -Headers $hu }

# (3) token ของ admin → 200
Show { Invoke-RestMethod "$api/admin/feedback?pageSize=5" -Headers $ha }
Show { Invoke-RestMethod "$api/admin/analytics/summary?days=30" -Headers $ha }

# (4) token เสีย → HTTP 401 รูปแบบเดียวกัน
Show { Invoke-RestMethod "$api/admin/feedback" -Headers @{ Authorization = 'Bearer abc.def.ghi' } }

# (5) เพดานและ input ผิด → HTTP 400 {"code":"INVALID_ADMIN_QUERY",...}
Show { Invoke-RestMethod "$api/admin/feedback?pageSize=101" -Headers $ha }
Show { Invoke-RestMethod "$api/admin/feedback?from=2026-13-40" -Headers $ha }
Show { Invoke-RestMethod "$api/admin/analytics/summary?days=91" -Headers $ha }
Show { Invoke-RestMethod "$api/admin/feedback?helpful=maybe" -Headers $ha }

# (6) ไม่มี email / password_hash ในผลลัพธ์ → ต้องได้ False ทั้งหมด
foreach ($p in 'feedback?pageSize=100', 'analytics/summary') {
  $text = Invoke-RestMethod "$api/admin/$p" -Headers $ha | ConvertTo-Json -Depth 10
  "$p : มี '@' = $($text -match '@') · มี password = $($text -match 'password')"
}

# (7) endpoint ที่ตัดไปแล้ว → HTTP 404 (Nest ไม่มี route นี้แล้ว)
Show { Invoke-RestMethod "$api/admin/sessions" -Headers $ha }

# กรองด้วยตัวกรอง
Show { Invoke-RestMethod "$api/admin/feedback?helpful=false&from=2026-10-01" -Headers $ha }
```

---

## 7. ข้อจำกัดที่รู้

- **สถิติรวม session ของโปรเจกต์เก่าด้วย** ตาราง `sessions` และ `graphs` ใช้ร่วมกับ troubleshoot-assistantv2 แยกด้วย `graph_id` ไม่ได้ (ตารางผังเป็นตารางเดียวกัน) session ของโปรเจกต์เก่าที่ไม่มีเจ้าของจะปนอยู่ในกลุ่ม `none` และตัวเลขรวม จึงควรอ่านตัวเลข `none` ด้วยความระวัง
- **"ยกเลิก" นับไม่ได้** การยกเลิกลบแถวทิ้ง สถิติมีเฉพาะ `expiredUnfinished` (เดินค้างแล้วหมดอายุ)
- **ไม่มีงานลบแถวหมดอายุ** แถวที่หมดอายุยังค้างและถูกนับในสถิติ (ตามช่วง `created_at`)
- **ผลการซ่อม (`outcomes`) คำนวณจากผังปัจจุบัน** ผังถูก seed ใหม่แล้วโหนดหาย → `unknown`
- **ข้อมูลความเห็น (`comment`) อาจมีข้อมูลส่วนตัวที่ผู้ใช้พิมพ์เอง** ระบบไม่ได้กรอง admin ควรใช้เท่าที่จำเป็น
- **ไม่มี rate limit** ที่ endpoint admin และ `/auth/login` (พอสำหรับ demo)
- **role อยู่ใน token** ถ้ายกผู้ใช้เป็น admin ภายหลัง ต้องล็อกอินใหม่ และ token ของ admin ที่ถูกถอนสิทธิ์ยังใช้ได้จนหมดอายุ (`JWT_EXPIRES_IN`)
- **ไม่มี index เพิ่ม** ถ้าข้อมูลโตมาก query สถิติจะช้าลง
