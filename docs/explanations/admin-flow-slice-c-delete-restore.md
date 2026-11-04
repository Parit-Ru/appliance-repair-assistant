# ชิ้น C — admin ลบและกู้คืนแผนผังขั้นตอน (soft delete)

อ้างอิงแบบ: `docs/design/admin-flow-management.md` (ข้อ A2, N1 และ 3.4–3.6)

## ชิ้นนี้ทำอะไรได้

ในหน้ารายละเอียดของผัง

- **ลบแผนผังนี้** → กล่องยืนยันบอกผลก่อน (ผู้ใช้ไม่เห็น/ค้นไม่เจอ/เริ่มใหม่ไม่ได้ · ประวัติ ความเห็น สถิติยังอยู่ · กู้คืนได้)
- ผังที่ลบแล้วเปิดดูได้ (ตัวกรอง "ลบแล้ว" ในรายการ) พร้อมชื่อผู้ลบและเวลา และมีปุ่ม **กู้คืนแผนผังนี้**
- แก้ข้อความของผังที่ลบแล้วไม่ได้จนกว่าจะกู้คืน

## ทำไมเป็น soft delete

`sessions.flow_id` เป็น `ON DELETE RESTRICT` ผังที่เคยถูกใช้จึงลบจริงไม่ได้ และถ้าลบ session ตามไป ประวัติการซ่อม ความเห็น และสถิติจะหาย จึงใส่ `flows.deleted_at` / `deleted_by` แทน ไม่แตะ `states`, `state_transitions`, `sessions`, `session_history`, `session_feedback`

## พฤติกรรมของระบบหลังลบ

| ใคร/อะไร | ผล |
|---|---|
| รายการ "อาการทั้งหมด" และ "เลือกรุ่น" | ไม่มีผังที่ลบ · จำนวนผังต่อคู่มือ (`flowCount`, `manuals.flow_count`) นับเฉพาะที่ยังใช้ |
| เริ่มตรวจผังที่ลบ | 404 `FLOW_NOT_FOUND` |
| session ที่กำลังตรวจอยู่ (รวมที่เปิดต่อจากหน้าประวัติตามงาน resume) | เปิดและเดินต่อจนจบได้ เพราะผังยังอยู่ในหน่วยความจำ (`findById` ยังคืนผังที่ลบ) |
| หน้าประวัติของผู้ใช้ | เปิดได้ เห็นขั้นตอนและส่งความเห็นได้ · ซ่อนปุ่ม "ตรวจอาการนี้อีกครั้ง" (`flow.active = false`) |
| dashboard ของ admin | ตัวเลขเท่าเดิม ชื่ออาการและผลลัพธ์ไม่เป็น `unknown` |
| ค้นหาอาการ | เอาออกจากดัชนี (`removeFlows`) · ผังที่ไม่ active เข้าดัชนีไม่ได้ · กู้คืนแล้วเพิ่มกลับ (`addFlows`) |
| อัปโหลดร่างด้วย `manual_id` เดิม | ถูกปฏิเสธ แม้ผังทั้งหมดของคู่มือนั้นถูกลบ (ด่านตรวจใช้ `listManuals(true)`) |
| รีสตาร์ต backend | สถานะลบอยู่ใน DB จึงคงเดิม |
| บันทึกผู้ทำ | `flows.deleted_by` + แถว `delete` / `restore` ใน `flow_revisions` (แถวเดิมไม่หายแม้กู้คืนแล้ว) |
| ลบพร้อมกัน 2 คน | `FOR UPDATE` ทำให้ได้ 204 หนึ่งและ 409 `FLOW_ALREADY_DELETED` หนึ่ง |

## ไฟล์ที่เพิ่ม/แก้

- backend: `flow-admin/*` (DELETE, restore), `execution/flow.repository.ts` (`deletedIds`, `isActive`, `listManuals(includeDeleted)`), `execution/execution.service.ts` (`startSession`), `symptom-search/symptom-search.service.ts` (`removeFlows`, ข้ามผังที่ลบ, แก้การเขียนทับ `flowInfo`), `history/history.service.ts` + `history.dto.ts` (`flow.active`), `authoring/drafts.service.ts` (ด่าน `manual_id` ซ้ำ)
- frontend: `components/admin/flows/FlowDeleteConfirm.tsx`, ปุ่มใน `AdminFlowDetailPage.tsx`, `api/flows.ts`, `queries.ts`, `types.ts`, `lib/errors.ts`, `pages/HistoryDetailPage.tsx` (ซ่อนปุ่มตรวจซ้ำ)
- **ไฟล์ที่ใช้ร่วมกับงาน resume** (`execution.service.ts`, `history.service.ts`, `history.dto.ts`, `HistoryDetailPage.tsx`): งาน resume ถูก commit แล้วก่อนเริ่มชิ้นนี้ `git diff` จึงมีเฉพาะส่วนของชิ้น C ในไฟล์เหล่านั้น

## ผลตรวจ

สคริปต์ครั้งเดียวบน `fixbot_admin_test` ผ่าน 47 ข้อ (ใช้ผังทดสอบ `demo_adminflow*` ที่ลบทิ้งเรียบร้อยหลังตรวจ) ครอบคลุมทุกแถวในตารางด้านบน รวม: session ที่เริ่มก่อนลบเดินต่อจนจบ · ประวัติ/ความเห็นของผังที่ลบ · ดัชนีค้นหา (ใช้ embedding ปลอม เพราะไม่ได้เปิดโมเดลจริง) · ข้อมูลจริง 722 ผังไม่ถูกแตะ · ชิ้น A และ B ยังผ่านซ้ำหลังเพิ่มชิ้น C

**ยังไม่ได้ดูในเบราว์เซอร์:** checklist ข้อ 17, 19–25, 28, 34

## ข้อจำกัดที่ยอมรับ

- ถ้าลบผังขณะระบบค้นหากำลังโหลดดัชนีครั้งแรก (state `loading`) ผังนั้นอาจติดเข้าดัชนีจนรีสตาร์ต (ช่วงสั้นมาก และผู้ใช้เริ่มตรวจไม่ได้อยู่ดีเพราะ `startSession` ตรวจ `isActive`)
- การลบเป็นระดับผังเท่านั้น (ข้อ N1) ไม่มีลบทั้งคู่มือ
- ตั้งแต่ชิ้นนี้ backend อ่านคอลัมน์ `deleted_at` ตอนบูต **ทุก DB ที่รันโค้ดนี้ต้อง migrate 007 ก่อน** (รวม `fixbot_eval` และ Aiven ซึ่งยังไม่ได้ทำ)

## เสนอ commit

```
feat(admin): soft delete and restore for published flows

- DELETE /admin/flows/:id and POST /admin/flows/:id/restore with audit rows
- deleted flows hidden from users/search, still readable for sessions, history and dashboard
- history flow info carries `active`; draft upload still rejects existing manual ids
- admin UI: delete confirmation and restore button
```
