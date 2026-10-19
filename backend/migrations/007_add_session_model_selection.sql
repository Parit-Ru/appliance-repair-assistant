-- 007: บันทึกว่าผู้ใช้ระบุรุ่นเองหรือไม่ทราบรุ่น (แผน docs/features/PLAN-MODEL-SELECTION.md ข้อตัดสินใจ D1)
--
-- model_selection:
--   'selected' = ผู้ใช้เลือกรุ่นของเครื่องตัวเองจากรายการ
--   'unknown'  = ผู้ใช้บอกว่าไม่ทราบรุ่น แล้วเลือกรุ่นที่ใกล้เคียงเอง (หน้าเว็บเตือนแล้วว่าขั้นตอนอาจไม่ตรง)
--   NULL       = ไม่ได้ผ่านหน้าเลือกรุ่น (session ที่สร้างก่อนฟีเจอร์นี้ หรือเริ่มจาก API ตรงๆ)
-- ใช้แยกเคสตอนวัดผลการประเมิน ไม่ได้ใช้ตัดสินขั้นตอนของ engine
--
-- ไม่ใส่ไว้ใน variables เพราะ variables ใช้แทนค่า {{ตัวแปร}} ในข้อความขั้นตอน (และส่งให้ LLM ได้)
--
-- เพิ่มอย่างเดียว ไม่แตะแถวเดิม: ทุกแถวเดิมได้ NULL และ INSERT/SELECT เดิมที่ระบุชื่อคอลัมน์เองทำงานต่อได้
-- ไม่ใส่ AFTER เพื่อให้เป็นการเพิ่มคอลัมน์ท้ายตาราง (ไม่ต้องสร้างตารางใหม่)
--
-- ลำดับที่ปลอดภัย: รัน migration นี้ก่อน แล้วค่อย deploy โค้ดที่เขียน model_selection
-- ถ้า deploy โค้ดก่อน INSERT จะล้ม (Unknown column) และผู้ใช้เริ่มตรวจไม่ได้
--
-- ย้อนกลับ (ไม่ได้รันอัตโนมัติ ต้องรันเอง):
--   ALTER TABLE sessions DROP COLUMN model_selection
--   DELETE FROM schema_migrations WHERE filename = '007_add_session_model_selection.sql'
ALTER TABLE sessions
  ADD COLUMN model_selection ENUM('selected','unknown') NULL
  COMMENT 'selected = เลือกรุ่นเอง · unknown = ไม่ทราบรุ่นแล้วเลือกใกล้เคียง · NULL = ไม่ได้ผ่านหน้าเลือกรุ่น';
