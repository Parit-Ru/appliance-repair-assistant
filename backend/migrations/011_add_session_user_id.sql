-- 011: ผูก session กับบัญชีผู้ใช้ที่ล็อกอิน (Step 2 ของระบบบัญชี · ต่อจาก users ใน migration 010)
--
-- user_id = users.id ของเจ้าของ session · NULL = ไม่ใช่ session ของผู้ใช้ที่ล็อกอิน
--   (session ของ guest ที่ผูกกับ client_id ตาม migration 008, หรือ session เก่าก่อนมีบัญชี)
--
-- กฎ "เจ้าของแบบเดียว" (บังคับที่ backend: auth/session-owner.ts ไม่ได้บังคับด้วย constraint):
--   ล็อกอินอยู่ → เก็บ user_id และ client_id = NULL
--   guest       → เก็บ client_id และ user_id = NULL
--   คำสั่งของ guest ใส่ AND user_id IS NULL เสมอ → guest ที่ใช้เบราว์เซอร์/client_id เดียวกันกับ user
--   ก็มองไม่เห็นและลบ session ของ user ไม่ได้
--
-- แถวเดิมทั้งหมดได้ NULL (ยังเป็นของ guest ตาม client_id เดิม โหลดได้เหมือนเดิม) ไม่ผูกย้อนหลัง (ไม่มี "claim")
-- ไม่ใส่ AFTER และเป็น NULL ได้ เพราะฐานข้อมูลนี้ใช้ร่วมกับโปรเจกต์เก่า INSERT เดิมที่ระบุชื่อคอลัมน์เองจึงไม่กระทบ
--
-- ON DELETE SET NULL (ไม่ใช่ CASCADE): ลบบัญชีแล้วแถว session ยังอยู่ (เก็บ confidence/model_selection ไว้วัดผล)
--   แต่ไม่มีเจ้าของ → ไม่ปรากฏในประวัติของใคร (ตอนนี้ยังไม่มี endpoint ลบบัญชี)
--
-- idx_sessions_user รองรับ: WHERE user_id = ? AND status = 'completed' AND expires_at > NOW()
-- session_feedback ไม่เพิ่ม user_id: ถึงตัวผู้ใช้ผ่าน session_id ได้อยู่แล้ว (migration 009)
--
-- ลำดับที่ปลอดภัย: รัน migration นี้ก่อน แล้วค่อยเปิด backend ที่เขียน user_id
--
-- ย้อนกลับ (ไม่ได้รันอัตโนมัติ ต้องรันเอง):
--   ALTER TABLE sessions DROP FOREIGN KEY fk_sessions_user, DROP INDEX idx_sessions_user, DROP COLUMN user_id
--   DELETE FROM schema_migrations WHERE filename = '011_add_session_user_id.sql'
ALTER TABLE sessions
  ADD COLUMN user_id CHAR(36) NULL
  COMMENT 'users.id ของเจ้าของที่ล็อกอิน · NULL = guest (ดู client_id) หรือ session เก่า',
  ADD INDEX idx_sessions_user (user_id, status, expires_at),
  ADD CONSTRAINT fk_sessions_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE;
