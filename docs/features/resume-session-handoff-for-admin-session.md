# ส่งต่อให้ session ที่ทำงาน admin: งาน "กลับมาทำต่อ (resume session)" ปนอยู่ใน working tree เดียวกัน

เขียนเมื่อ 3 พ.ย. 2569 จาก session ที่ทำฟีเจอร์ resume session
อ่านไฟล์นี้ก่อนแก้โค้ดหรือ commit ใน repo นี้ เพื่อไม่ให้งานสองเรื่องปนกัน

## 1. สถานการณ์

- โฟลเดอร์ `appliance-repair-assistant` อยู่บน branch `admin-flow-management` (จาก `main` 725080b) **ไม่มี commit ใหม่ของใครเลย**
- ใน working tree ตอนนี้มีการแก้ที่ **ยังไม่ commit สองเรื่องปนกัน**:
  - **งาน admin (ของ session นี้ ห้ามให้ปนกับ resume):** `backend/.env.example`, `backend/scripts/seed-admin.js`, `docs/exam-prep/{10,14,18,19}*`, `docs/design/` (untracked)
  - **งาน resume (ของอีก session):** ไฟล์ตามข้อ 2
- ผู้ใช้ commit เอง ห้าม commit/push ให้ (ข้อตกลงในโปรเจกต์) และ `main` ต้องคงไว้เดโมวันสอบ 7 พ.ย.

## 2. ไฟล์ที่งาน resume แก้ (อย่าแก้ทับ ถ้าต้องแตะให้ดู diff ก่อน)

Backend
- `backend/src/execution/session.store.ts` · แก้ 3 เรื่องในไฟล์เดียว: `isOwnedBy` (แทน `findUserId`), `SESSION_TTL_HOURS = 7 * 24`, `findModelSelection`
- `backend/src/execution/execution.service.ts` · `authorize(sessionId, owner)`, `buildTrail`, `getSession` คืน `trail`/`modelSelection`
- `backend/src/execution/execution.routes.ts` · 3 route ใช้ `resolveRequiredOwner`
- `backend/src/execution/execution.dto.ts` · เพิ่ม `SessionTrailStepDto`, `trail?`, `modelSelection?`
- `backend/src/history/{history.store,history.service,history.dto}.ts` · `listCompleted` → `listSessions` (รวม in_progress), `deleteCompleted` → `deleteSession`, เพิ่ม `status`

Frontend
- `frontend/src/api/{execution,types}.ts`, `pages/{SessionPage,HistoryPage}.tsx`, `components/history/HistoryRow.tsx`, `lib/historyView.ts`

เอกสาร: `docs/features/resume-session.md` (รายละเอียดเต็ม) และไฟล์นี้

## 3. สิ่งที่กระทบงาน admin

1. **อายุ session ที่ยังไม่จบ 24 ชม. → 7 วัน** (`SESSION_TTL_HOURS`) หน้า admin analytics (`admin.store.ts`) นับ `expired_unfinished` = in_progress ที่ `expires_at <= NOW()` ตัวเลขจะเปลี่ยนความหมาย: ค้างได้นานขึ้นก่อนถูกนับเป็น expired · ไม่ต้องแก้ SQL ของ admin
2. **endpoint `/execution/sessions/:id` (GET), `/actions`, `/outcome` ต้องมีตัวระบุเจ้าของ** (ล็อกอิน หรือหัวข้อ `X-Client-Id`) ไม่งั้นได้ 400 ถ้า admin ใช้ endpoint เหล่านี้ในเครื่องมือหรือสคริปต์ (curl ทดสอบ, ตัวอย่าง API) ต้องส่ง header เพิ่ม
3. **session ที่ไม่มีเจ้าของ (ไม่มี `user_id` และ `client_id`) เปิดผ่าน endpoint ผู้ใช้ไม่ได้อีก** ข้อมูลที่ seed เอง/สคริปต์ทดสอบที่สร้าง session แบบไม่มีเจ้าของจะเดินผังผ่านหน้าเว็บไม่ได้
4. ไม่มี migration ใหม่ ไม่เปลี่ยนตาราง ไม่เปลี่ยน engine (`state-machine.ts` ไม่ถูกแตะ)
5. **ไม่มีงาน resume เกี่ยวกับ DB ทดสอบ `fixbot_admin_test` หรือ Aiven**: ไม่ได้รันอะไรกับ DB ใดเลย

## 4. ข้อควรระวังตอน commit

- ห้าม `git add .` / `git add -A`
- `session.store.ts` และ `execution.service.ts` มีหลายเรื่องในไฟล์เดียว ใช้ `git add -p` ถ้าจะ commit แยก
- แนะนำลำดับ: commit งาน admin ของคุณก่อน (เลือกไฟล์ตามข้อ 1) แล้วค่อย commit งาน resume หรือให้ผู้ใช้ตัดสินว่าจะแยก branch
- ถ้าสร้าง/สลับ branch ระวัง: การแก้ที่ยังไม่ commit ติดไปกับทุกการสลับ branch และจะปนไปด้วย (เคยเกิดแล้ว ตอนสลับไป `main` ชั่วคราว)
- โฟลเดอร์ `C:\Users\SPS\Desktop\499\resume-session` เป็น git worktree ของ branch `resume-session` ที่ใช้ชั่วคราว มีโค้ด resume ชุดเดียวกัน (ไม่ใช่ที่ทำงานหลักแล้ว) ห้ามแก้ที่นั่น

## 5. สถานะการตรวจ

- tsc (backend + frontend) ผ่าน, eslint ของไฟล์ frontend ที่แก้ไม่มีคำเตือน
- **ยังไม่ได้ลองกับ DB จริง และยังไม่ได้ดูหน้าจอ** ไม่มีเทสต์อัตโนมัติสำหรับงาน resume (ผู้ใช้ลบทิ้ง)
- รายการลองมือ 6 ข้อ อยู่ท้าย `docs/features/resume-session.md`
- ต้อง deploy backend + frontend พร้อมกัน
