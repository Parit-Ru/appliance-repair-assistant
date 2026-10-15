-- 008: ผูก session กับเบราว์เซอร์ของผู้ใช้ เพื่อทำหน้า "ประวัติการซ่อม" (docs/history-page.md ข้อ D1)
--
-- client_id = UUID ที่หน้าเว็บสุ่มสร้างเองแล้วเก็บไว้ใน localStorage ของเบราว์เซอร์
--   ส่งมากับคำขอผ่านหัวข้อ X-Client-Id ตอนเริ่ม session และทุก endpoint ของ /history
--   NULL = session ที่สร้างก่อนฟีเจอร์นี้ หรือเริ่มจาก API ตรงๆ โดยไม่ส่งหัวข้อ → ไม่ปรากฏในประวัติของใคร
--
-- ไม่ใช่การยืนยันตัวตน: ใครรู้ UUID ก็ดูประวัติของ UUID นั้นได้ (ระบบนี้ไม่มีล็อกอิน)
-- และ client_id ไม่ได้ใช้ตัดสินขั้นตอนของ engine ในทางใดทั้งสิ้น
--
-- idx_sessions_client รองรับคำสั่งดึงรายการ:
--   WHERE client_id = ? AND status = 'completed' AND expires_at > NOW()
--
-- เพิ่มอย่างเดียว ไม่แตะแถวเดิม (ทุกแถวเดิมได้ NULL) และเป็นคำสั่ง DDL เดียว
-- ฐานข้อมูลนี้ใช้ร่วมกับโปรเจกต์เก่า: คอลัมน์ NULL ได้ + ไม่ใส่ AFTER จึงไม่กระทบ INSERT/SELECT เดิมที่ระบุชื่อคอลัมน์เอง
--
-- ลำดับที่ปลอดภัย: รัน migration นี้ (และ 009) ก่อน แล้วค่อย deploy backend ที่เขียน client_id
-- ถ้า deploy โค้ดก่อน INSERT ตอนเริ่ม session จะล้ม (Unknown column) และผู้ใช้เริ่มตรวจไม่ได้
--
-- ย้อนกลับ (ไม่ได้รันอัตโนมัติ ต้องรันเอง):
--   ALTER TABLE sessions DROP INDEX idx_sessions_client, DROP COLUMN client_id
--   DELETE FROM schema_migrations WHERE filename = '008_add_session_client_id.sql'
ALTER TABLE sessions
  ADD COLUMN client_id CHAR(36) NULL
  COMMENT 'UUID ของเบราว์เซอร์เจ้าของ (หน้าประวัติการซ่อม) · NULL = ไม่ทราบเจ้าของ',
  ADD INDEX idx_sessions_client (client_id, status, expires_at);
