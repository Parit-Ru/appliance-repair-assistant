# Auth + Roles — Step 1 (backend)

สถานะ: เขียนครบ · คอมไพล์ผ่านด้วย type จำลอง · ยังไม่ได้ติดตั้งแพ็กเกจ/รัน migration/ทดสอบกับเซิร์ฟเวอร์จริง
ยังไม่แตะ endpoint เดิม (traversal, history ยังใช้ `X-Client-Id`) การผูกประวัติกับ user อยู่ Step 2

## What

| ไฟล์ (backend/) | หน้าที่ |
|---|---|
| `migrations/010_create_users.sql` | ตาราง `users` (id UUID, email UNIQUE, password_hash, display_name, role ENUM) |
| `src/auth/role.enum.ts` | `Role` enum แหล่งความจริงเดียว + `isRole()` |
| `src/auth/auth.dto.ts` | `parseRegisterBody` / `parseLoginBody` (ฟังก์ชันตรวจ ตามแบบ history.dto) |
| `src/auth/users.store.ts` | SQL ของ users (พารามิเตอร์ `?` ทั้งหมด) |
| `src/auth/auth.service.ts` | register / login / me + ออก JWT (bcryptjs) |
| `src/auth/jwt-auth.guard.ts` | ตรวจ Bearer token → `request.user = { sub, role }` (401) |
| `src/auth/roles.decorator.ts`, `roles.guard.ts` | `@Roles(...)` + ตรวจบทบาท (403) |
| `src/auth/auth.controller.ts` | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| ~~`src/auth/auth.exception.filter.ts`~~ | (ถูกลบตอนรวม filter) error เป็น `ApiError(status, code, message)` แล้วให้ `src/common/all-exceptions.filter.ts` แปลงเป็น `{statusCode, code, message}` |
| `src/auth/auth.module.ts` | รวมโมดูล + อ่าน/ตรวจ `JWT_SECRET`, `JWT_EXPIRES_IN` ตอนบูต |
| `src/auth/roles.guard.spec.ts` | เทสต์ RolesGuard (401/403/ผ่าน) |
| `scripts/seed-admin.js` | สร้าง/ยกเป็น admin จาก `.env` (รันซ้ำได้) |
| `src/app.module.ts`, `package.json`, `.env.example` | ลงทะเบียน AuthModule · script `seed:admin` · env ใหม่ |

## Why (ข้อควรรู้)

- **สมัครเองได้เป็น user เท่านั้น** `parseRegisterBody` ไม่อ่าน `role` เลย (ส่งมาก็ถูกเมิน) admin สร้างได้ทางเดียวคือ `seed-admin.js`
- **ข้อความ login ผิดเหมือนกันทุกกรณี** (`INVALID_CREDENTIALS`) และเมื่อไม่พบอีเมลก็ยัง compare กับ hash หลอก กันเดาอีเมลจากเวลาตอบ
- **รหัสผ่านจำกัด 72 ไบต์ด้วย** (นอกจาก 8-72 ตัวอักษร) เพราะ bcrypt ตัดที่ 72 ไบต์ อักษรไทย 1 ตัว = 3 ไบต์
- **role ใน token เชื่อตามที่ตกลง** เปลี่ยน role ใครแล้วต้องให้ล็อกอินใหม่/รอ token หมดอายุ
- **Guard โยน `UnauthorizedException`/`ForbiddenException` ของ Nest** filter เฉพาะโมดูลแปลงมันเป็น 500 (สมัยที่ยังมี filter ต่อโมดูล) — ปัจจุบันมี filter กลางตัวเดียว (`AllExceptionsFilter` ใน `common/`) แปลง 401/403 ให้ทุก controller จึงไม่ต้องติด `@UseFilters` ที่ไหนอีก
- **บูตไม่ขึ้นถ้า `JWT_SECRET` ไม่มี/สั้นกว่า 32 ตัว** หรือ `JWT_EXPIRES_IN` รูปแบบผิด
- ยังไม่มี rate limit กัน brute force ที่ `/auth/login` (นอกขอบเขต Step 1 · พอสำหรับ demo localhost)

## Code ที่ใช้

| status | code | เมื่อ |
|---|---|---|
| 400 | `INVALID_AUTH_REQUEST` | body ผิดรูปแบบ |
| 401 | `INVALID_CREDENTIALS` | อีเมล/รหัสผ่านไม่ถูกต้อง |
| 401 | `UNAUTHENTICATED` | ไม่มี/ใช้ token ไม่ได้ |
| 403 | `FORBIDDEN` | ล็อกอินแล้วแต่บทบาทไม่พอ |
| 409 | `EMAIL_TAKEN` | อีเมลซ้ำ |

## ติดตั้งและตั้งค่า (PowerShell)

```powershell
cd C:\Users\SPS\Desktop\499\appliance-repair-assistant\backend
npm install @nestjs/jwt@^10.2.0 bcryptjs@^3.0.3
```

เพิ่มใน `backend\.env` (ค่าจริง ห้าม commit):

```
JWT_SECRET=<สุ่ม: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
JWT_EXPIRES_IN=7d
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<รหัสผ่านที่ตั้งเอง 8-72 ตัวอักษร>
ADMIN_DISPLAY_NAME=Admin
```

```powershell
npm run migrate      # รัน 010
npm run build
npm run start:prod   # หรือ npm run start:dev
```

## How to test

```powershell
$api = 'http://localhost:3000'
function Show($r) { $r | ConvertTo-Json -Depth 5 }

# 1) สมัคร (ส่ง role มาก็ถูกเมิน → ต้องได้ role = user)
$reg = Invoke-RestMethod "$api/auth/register" -Method Post -ContentType 'application/json' `
  -Body (@{ email='demo@example.com'; password='demo-pass-123'; displayName='Demo'; role='admin' } | ConvertTo-Json)
Show $reg                      # user.role = "user"

# 2) สมัครซ้ำ → 409 EMAIL_TAKEN
try { Invoke-RestMethod "$api/auth/register" -Method Post -ContentType 'application/json' `
  -Body (@{ email='DEMO@example.com'; password='demo-pass-123'; displayName='Demo' } | ConvertTo-Json) }
catch { $_.ErrorDetails.Message }

# 3) login ถูก → ได้ accessToken + role
$login = Invoke-RestMethod "$api/auth/login" -Method Post -ContentType 'application/json' `
  -Body (@{ email='demo@example.com'; password='demo-pass-123' } | ConvertTo-Json)
$h = @{ Authorization = "Bearer $($login.accessToken)" }

# 4) /auth/me ด้วย token → 200 มี role
Show (Invoke-RestMethod "$api/auth/me" -Headers $h)

# 5) 401: ไม่มี token / token มั่ว / รหัสผ่านผิด / อีเมลไม่มีอยู่ (สองอันหลังต้องได้ข้อความเดียวกัน)
try { Invoke-RestMethod "$api/auth/me" } catch { $_.ErrorDetails.Message }
try { Invoke-RestMethod "$api/auth/me" -Headers @{ Authorization='Bearer abc.def.ghi' } } catch { $_.ErrorDetails.Message }
try { Invoke-RestMethod "$api/auth/login" -Method Post -ContentType 'application/json' -Body (@{ email='demo@example.com'; password='wrong-pass-1' } | ConvertTo-Json) } catch { $_.ErrorDetails.Message }
try { Invoke-RestMethod "$api/auth/login" -Method Post -ContentType 'application/json' -Body (@{ email='nobody@example.com'; password='wrong-pass-1' } | ConvertTo-Json) } catch { $_.ErrorDetails.Message }

# 6) seed admin (รันสองรอบ: รอบแรกสร้าง รอบสองต้องบอกว่าเป็น admin อยู่แล้ว)
npm run seed:admin
npm run seed:admin

# 7) login เป็น admin → role = "admin"
$adm = Invoke-RestMethod "$api/auth/login" -Method Post -ContentType 'application/json' `
  -Body (@{ email=$env:ADMIN_EMAIL; password=$env:ADMIN_PASSWORD } | ConvertTo-Json)   # ตั้ง $env:ADMIN_* ในเซสชันนี้ก่อน
$adm.user.role
```

**403**: Step 1 ยังไม่มี endpoint ที่ใช้ `@Roles` ทดสอบผ่าน HTTP ไม่ได้ ทดสอบด้วยเทสต์แทน:
`npx jest src/auth` (5 เคส: ไม่มี @Roles ผ่าน · admin ผ่าน · user ได้ 403 · ไม่มี user ได้ 401 · หลายบทบาท)
เมื่อ Step 3 ใส่ `@Roles(Role.Admin)` ที่ admin endpoint จะลอง `Invoke-RestMethod ... -Headers $h` ด้วย token ของ user ได้ 403 จริง

## ยังไม่ได้ตรวจ

- ยังไม่ได้ติดตั้ง `@nestjs/jwt`/`bcryptjs` จึงยังไม่เคยรันเซิร์ฟเวอร์พร้อม AuthModule (คอมไพล์ผ่านด้วย type จำลองที่ผมเขียนเองจากความรู้เรื่อง API — ถ้าไลบรารีจริงต่างจากนั้นจะฟ้องตอน `npm run build` หลังติดตั้ง)
- ยังไม่ได้รัน migration 010 และ seed กับฐานข้อมูลจริง
