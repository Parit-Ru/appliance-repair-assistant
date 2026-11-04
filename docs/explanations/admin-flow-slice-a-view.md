# ชิ้น A — admin ดูแผนผังขั้นตอนที่เผยแพร่แล้ว

อ้างอิงแบบ: `docs/design/admin-flow-management.md` (หัวข้อ "ขอบเขตก่อนสอบ") · ทำบน branch `admin-flow-management` และ DB `fixbot_admin_test` เท่านั้น

## ชิ้นนี้ทำอะไรได้

admin เปิดแท็บใหม่ **"แผนผังที่เผยแพร่"** (`/admin/flows`) แล้ว

- เห็นรายการแผนผังขั้นตอนทั้งหมด (แบ่งหน้าละ 20) พร้อมจำนวนขั้นตอน จำนวนครั้งที่ผู้ใช้ตรวจ และจำนวนคนที่กำลังเดินอยู่
- ค้นหาด้วยอาการ รุ่น ยี่ห้อ หรือรหัสผัง · กรองตามประเภทเครื่อง · กรองสถานะ (ใช้งานอยู่ / ลบแล้ว / ทั้งหมด)
- เปิดรายละเอียด (`/admin/flows/:id`): เส้นทางทั้งผัง ข้อความทุกขั้นตอน คำเตือนความปลอดภัย หมายเหตุที่มา (`author_note`) และเส้นเชื่อมแต่ละขั้น
- ยังไม่มีปุ่มแก้ ลบ หรือกู้คืน (อยู่ในชิ้น B และ C)

## ไฟล์ที่เพิ่ม/แก้

| ไฟล์ | ทำอะไร |
|---|---|
| `backend/migrations/007_flow_management.sql` | เพิ่มคอลัมน์ `revision`, `edited_at`, `edited_by`, `deleted_at`, `deleted_by` ในตาราง `flows` (ค่าเริ่มต้นทำให้ seed และ publish เดิมใช้ต่อได้) |
| `backend/src/flow-admin/` (5 ไฟล์) | `GET /admin/flows` และ `GET /admin/flows/:id` · SQL อยู่ใน `.store.ts` ตรวจ query ใน `.dto.ts` ประกอบผลใน `.service.ts` |
| `backend/src/app.ts` | mount `/admin/flows` ใต้ด่านสิทธิ์ admin เดิม |
| `frontend/src/api/flows.ts`, `queries.ts`, `types.ts` | เรียก API และชนิดข้อมูล |
| `frontend/src/pages/AdminFlowsPage.tsx`, `AdminFlowDetailPage.tsx` | หน้ารายการและหน้ารายละเอียด |
| `frontend/src/components/admin/flows/` | แถวรายการ และส่วนแสดงเส้นทาง/ขั้นตอน |
| `frontend/src/lib/adminFlowParams.ts`, `flowView.ts` | อ่าน/เขียนตัวกรองใน URL และตัวช่วยแสดงผล |
| `App.tsx`, `AdminTabs.tsx`, `lib/errors.ts` | เส้นทางใหม่ แท็บใหม่ ข้อความ error ของ `ADMIN_FLOW_NOT_FOUND` |

## ทำไมเขียนแบบนี้

- **อ่านจาก DB ตรงในหน้า admin** เพราะ `FlowRepository` (หน่วยความจำ) ไม่เก็บ `severity`, `difficulty`, `author_note`, `revision`, `deleted_at` และผังที่ลบต้องเปิดดูได้ด้วย
- **รูปข้อมูลของแต่ละขั้นตรงกับที่ผู้ใช้เห็น** คือใช้ key ข้อความตามชนิด (`question` / `prompt` / `content`) และ `on_yes` / `on_no` / `next` / `on_invalid` เพื่อให้ชิ้น B ใช้ key เดียวกันตอนส่งการแก้กลับมา
- **ไม่แยก `DraftFlowCard` ออกมาใช้ร่วม** (step 5.2 ในแบบเดิม) เพราะกลัวกระทบหน้าร่างที่ใช้งานอยู่ จึงเขียน `FlowStructure` ใหม่และใช้ฟังก์ชัน `pathLines` เดิมร่วมกัน
- **ช่องค้นหาเป็นแบบกดค้นหา** ไม่ใช่พิมพ์แล้วค้นทันที เพื่อไม่ยิง API ทุกตัวอักษร
- `activeSessionCount` นับเฉพาะ `in_progress` ที่ `expires_at > NOW()` ให้ตรงกับหน้าประวัติของงาน resume

## วิธีตรวจ

ผมตรวจฝั่ง backend บน `fixbot_admin_test` ผ่านสคริปต์ครั้งเดียว (23 ข้อ ผ่านทั้งหมด): 401/403, รายการ 722 ผัง/37 หน้า, query ผิด 5 แบบได้ 400, ตัวกรอง, ผลรวมขั้นตอน 6,322, ทุกผังเปิดรายละเอียดได้และลูกศรทุกเส้นชี้ขั้นที่มีจริง, `author_note` 2,340 รายการ, 404 ของผังที่ไม่มี และ error body ของ endpoint เดิมไม่เปลี่ยน

ฝั่ง frontend ผ่าน `tsc` และ eslint · **ยังไม่ได้ดูด้วยตาในเบราว์เซอร์** ต้องตรวจ checklist ข้อ 2, 3, 4 (ใน `docs/design/admin-flow-management.md` ส่วน 3.7) ด้วยตัวคุณเอง

## ข้อจำกัดที่ยอมรับ

- ยังไม่มีรายงาน validator (`validation`) ในหน้ารายละเอียด เลื่อนไปหลังสอบ
- ผลรวม `sessionCount` ใช้ subquery ต่อแถว เร็วพอสำหรับ 722 ผัง ถ้าข้อมูลโตมากต้องปรับ

## เสนอ commit

```
feat(admin): add read-only published flow list and detail pages

- migration 007: revision/edited/deleted columns on flows
- GET /admin/flows and /admin/flows/:id (flow-admin module)
- admin UI: "แผนผังที่เผยแพร่" tab with list, filters and detail view
```

ไฟล์ที่เกี่ยวข้อง: ดูตารางด้านบน และ `git status` (ผมไม่ได้ `git add` ให้)
