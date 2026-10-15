-- 006: ชื่อรุ่นที่ผู้ใช้รู้จัก สำหรับหน้า "เลือกรุ่นก่อนค้นอาการ" (แผน docs/PLAN-MODEL-SELECTION.md ระยะ 1)
--
-- display_name  = ชื่อหรือเลขรุ่นที่ผู้ใช้เห็นบนสติกเกอร์/หน้าปก เติมโดยผู้พัฒนาจากคู่มือ
--                 NULL = ยังไม่ได้เติม หน้าเว็บแสดง model_pattern แทน (ไม่เดาชื่อ)
-- model_aliases = เลขรุ่น/ชื่อขายอื่นที่ใช้คู่มือเล่มเดียวกัน (อาร์เรย์ JSON ของข้อความ) NULL = ไม่มี
--
-- เพิ่มอย่างเดียว ไม่แตะแถวเดิม: ทุกแถวเดิมได้ NULL และโค้ดเก่าที่ระบุชื่อคอลัมน์เองทำงานต่อได้
-- เป็น statement เดียว: ทั้งสองคอลัมน์สำเร็จหรือล้มพร้อมกัน (ตัวรัน migration ไม่มี transaction)
-- ไม่ใช้ ADD COLUMN IF NOT EXISTS เพราะ MySQL ไม่รองรับ (เป็นของ MariaDB)
--
-- ย้อนกลับ (ไม่ได้รันอัตโนมัติ ต้องรันเอง):
--   ALTER TABLE manuals DROP COLUMN display_name, DROP COLUMN model_aliases
--   DELETE FROM schema_migrations WHERE filename = '006_add_manual_display_name.sql'
ALTER TABLE manuals
  ADD COLUMN display_name VARCHAR(120) NULL
  COMMENT 'ชื่อรุ่นที่ผู้ใช้รู้จัก เติมโดยผู้พัฒนาจากคู่มือ NULL = แสดง model_pattern แทน',
  ADD COLUMN model_aliases JSON NULL
  COMMENT 'เลขรุ่น/ชื่อขายอื่นที่ใช้คู่มือเล่มนี้ (อาร์เรย์ของข้อความ) NULL = ไม่มี';
