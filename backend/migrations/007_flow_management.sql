-- 007_flow_management: ดู/แก้/ลบผังโดยผู้ดูแล
-- ต้องรันหลัง 001_users และ 002_flows
-- คำสั่งเดียวต่อไฟล์ เพราะ DDL commit ทันที และ runner บันทึกชื่อไฟล์เมื่อจบทั้งไฟล์
-- คอลัมน์ใหม่ทั้งหมดมีค่าเริ่มต้นหรือเป็น NULL ได้ INSERT เดิมของ seed และ publish จึงใช้ต่อได้
-- ออกแบบ: docs/design/admin-flow-management.md ส่วน 3.1
ALTER TABLE flows
  ADD COLUMN revision    INT UNSIGNED NOT NULL DEFAULT 0
    COMMENT 'เพิ่มทีละ 1 ทุกครั้งที่แก้ ใช้กันการแก้ชนกัน · 0 = ไม่เคยแก้',
  ADD COLUMN edited_at   TIMESTAMP NULL DEFAULT NULL
    COMMENT 'เวลาที่ admin แก้เนื้อหาล่าสุด ไม่เปลี่ยนเมื่อลบหรือกู้คืน',
  ADD COLUMN edited_by   CHAR(36) NULL COMMENT 'users.id ของ admin ที่แก้ล่าสุด',
  ADD COLUMN deleted_at  TIMESTAMP NULL DEFAULT NULL
    COMMENT 'NULL = ใช้งานอยู่ · มีค่า = ซ่อนจากผู้ใช้ แต่ session ประวัติ และสถิติยังอ้างถึงได้',
  ADD COLUMN deleted_by  CHAR(36) NULL COMMENT 'users.id ของ admin ที่ลบ',
  ADD CONSTRAINT fk_flows_edited_by FOREIGN KEY (edited_by) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT fk_flows_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE;
