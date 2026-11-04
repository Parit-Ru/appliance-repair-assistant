# ชิ้น B — admin แก้ข้อความของขั้นตอนที่มีอยู่

อ้างอิงแบบ: `docs/design/admin-flow-management.md` (หัวข้อ "ขอบเขตก่อนสอบ" และ 3.2 "ฉบับก่อนสอบ")

## ชิ้นนี้ทำอะไรได้

จากหน้ารายละเอียดของผัง กด **"แก้ไขข้อความของขั้นตอน"** (`/admin/flows/:id/edit`) แล้ว

- แก้ข้อความของแต่ละขั้นตอน (คำถาม / ข้อความขั้นตอน / ข้อความที่ขอให้กรอก / ข้อความตอนจบ) และคำเตือนความปลอดภัย (เฉพาะขั้นตอนที่เป็นด่านความปลอดภัยอยู่แล้ว ห้ามว่าง)
- กดบันทึกคลิกเดียว ไม่มีช่องติ๊กยืนยัน ผู้ใช้เห็นข้อความใหม่ทันทีโดยไม่ต้องรีสตาร์ต
- เห็นว่าขั้นตอนไหนแก้แล้ว และมีผู้ใช้อยู่ที่ขั้นตอนนั้นกี่คน
- **แก้ไม่ได้:** ชนิดขั้นตอน เส้นทาง (ใช่/ไม่ใช่/ถัดไป) ธงความปลอดภัย กฎการกรอก ผลลัพธ์ `author_note` และข้อความระดับผัง (หน้าจอแสดงเป็นอ่านอย่างเดียว)

## กลไกที่ป้องกันความเสียหาย

| เรื่อง | ทำอย่างไร |
|---|---|
| โครงสร้างผังไม่เปลี่ยนแม้ส่งคำขอเอง | `PUT` เขียนเฉพาะคอลัมน์ `text_content` และ `safety_warning` ด้วย `UPDATE` ไม่มี `DELETE`/`INSERT` ของ `states` และ `state_transitions` ฟิลด์อื่นใน body ถูกเพิกเฉย |
| ชนิดข้อความเลือกจาก DB | เซิร์ฟเวอร์ดูชนิดของขั้นตอนจากฐานข้อมูล (`question` / `prompt` / `content`) ไม่เชื่อ `type` ที่ส่งมา |
| admin หลายคนแก้ผังเดียวกัน | transaction + `SELECT ... FOR UPDATE` + `expectedRevision` ถ้าไม่ตรงได้ 409 บอกชื่อและเวลาของคนที่บันทึกก่อน ข้อความในฟอร์มยังอยู่ |
| รู้ว่าใครแก้อะไรเมื่อไร | `flows.edited_by/edited_at/revision` และแถวใน `flow_revisions` (เก็บสำเนาผังทั้งผัง **ก่อนแก้** พร้อมผู้ทำ) |
| แก้พร้อมกันหลายผัง | `FlowRepository.reload()` เข้าคิวทีละรอบ ผลเก่าทับผลใหม่ไม่ได้ |
| `npm run seed` เขียนทับงานที่แก้ | `seed-flows.js` ปฏิเสธถ้ามีผังที่ถูกแก้/ลบ เว้นแต่ใส่ `--force` (รองรับกรณี PowerShell 5.1 ตัด `--`) · `backup-flow-tables.js` สำรอง `flow_revisions` ด้วย |

## ไฟล์ที่เพิ่ม/แก้

- `backend/migrations/008_flow_revisions.sql` · `backend/src/flow-admin/` (เพิ่ม `PUT` ใน dto/store/service/routes/errors)
- `backend/src/execution/flow.repository.ts` (คิว reload) · `backend/scripts/seed-flows.js`, `backup-flow-tables.js`
- `frontend/src/lib/flowEditor.ts`, `components/admin/flows/StateEditorCard.tsx`, `FlowConflictNotice.tsx`, `pages/AdminFlowEditPage.tsx` · แก้ `api/flows.ts`, `queries.ts`, `types.ts`, `lib/errors.ts`, `AdminFlowDetailPage.tsx`, `App.tsx`

## ผลตรวจ

สคริปต์ครั้งเดียวบน `fixbot_admin_test` ผ่าน 40 ข้อ รวม: body ผิด 12 แบบได้ 400 และไม่เขียนอะไร · แก้จริงแล้ว `revision`/`edited_by`/`flow_revisions` ถูกต้อง snapshot เป็นข้อความเดิม · ส่ง `state_type`, เส้นทาง, `author_note`, ธงความปลอดภัยมาด้วยแล้วโครงสร้างใน DB ไม่เปลี่ยน · `revision` เก่าได้ 409 พร้อมชื่อผู้บันทึกก่อน · แก้ผังเดียวกันพร้อมกัน 2 คนได้ 200 หนึ่งและ 409 หนึ่ง · แก้คนละผังพร้อมกัน 5 รอบสำเร็จทุกรอบ · ผู้ใช้เดินผังแล้วเห็นข้อความใหม่ · seed ปฏิเสธ/ยอมด้วย `--force` ตามที่ออกแบบ · ข้อมูลจริงยังเป็น 722 ผัง / 6,322 ขั้นตอน

เวลา reload ของ 722 ผัง ≈ 0.4–0.7 วินาทีในเครื่อง (ยังไม่ได้วัดบน Aiven)

**ยังไม่ได้ดูในเบราว์เซอร์:** ตรวจ checklist ข้อ 6, 7, 15, 16, 26, 29, 33 ด้วยมือ

## ข้อจำกัดที่ยอมรับ

- ไม่มี validator เต็ม (โครงสร้างไม่เปลี่ยนจึงไม่จำเป็น) ต้องเพิ่มเมื่อเปิดให้แก้เส้นทางหรือเพิ่ม/ลบขั้นตอน
- ประวัติของผู้ใช้ที่ตรวจไปแล้วจะแสดงข้อความใหม่ (ประวัติไม่ใช่ภาพถ่าย ณ วันที่ตรวจ) และยังไม่มีหมายเหตุบอกว่าถูกแก้หลังตรวจ (`flowEditedAfterSession` เลื่อนไปหลังสอบ)
- ไม่ได้อัปเดตดัชนีค้นหา เพราะดัชนีสร้างจากข้อความอาการระดับผัง ซึ่งชิ้นนี้ไม่ให้แก้

## เสนอ commit

```
feat(admin): let admins edit the text of existing flow states

- migration 008: flow_revisions (who edited, snapshot before edit)
- PUT /admin/flows/:id: text-only edit with revision check, row lock and reload queue
- seed-flows refuses to overwrite edited/deleted flows without --force
- admin UI: edit page with conflict notice
```
