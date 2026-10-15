# ร่างระยะ 3 (frontend): เลือกเครื่อง → รุ่น → อาการ

คำอธิบายเต็ม (เพิ่มอะไร ตรงไหน ทำไม) อยู่ที่ `docs/DRAFT-PHASE3-FRONTEND.md`

| ไฟล์ | คืออะไร |
|---|---|
| `phase3.patch` | การแก้ไฟล์เดิม 12 ไฟล์ + ไฟล์ใหม่ 3 ไฟล์ ใช้ด้วย `git apply draft/frontend-phase3/phase3.patch` (ตรวจแล้วด้วย `git apply --check`) |
| `new-files/` | ไฟล์ใหม่ 3 ไฟล์ (สำเนาจาก patch ไว้เปิดอ่าน/คัดลอกทีละไฟล์) |
| `tests/` | ไฟล์ทดสอบที่แนะนำ (17 ข้อ ใช้ vitest) วางที่ `frontend/src/lib/` และ `frontend/src/pages/` |

ร่างนี้ยังไม่ได้ใช้กับโปรเจกต์จริง
