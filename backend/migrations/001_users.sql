-- 001_users: บัญชีผู้ใช้ (users)
-- ไม่พึ่งตารางอื่น — ต้องสร้างก่อน เพราะ sessions และ graph_drafts อ้างถึง
-- ทุกตาราง: InnoDB, utf8mb4, utf8mb4_unicode_ci (ต้องตรงกันทั้งหมด ไม่งั้น FOREIGN KEY สร้างไม่ได้)
-- รายละเอียดว่าแต่ละตารางเก็บอะไร ดู docs/reference/DATABASE.md

-- users: บัญชีอีเมล + รหัสผ่าน
--   id            = UUID v4 ที่ backend สร้างเอง
--   email         = ตัวพิมพ์เล็กเสมอ (backend แปลงก่อนเก็บ/ค้น) UNIQUE
--   password_hash = bcrypt (ห้ามเก็บรหัสผ่านจริง) เผื่อ 255 เผื่อเปลี่ยนอัลกอริทึมภายหลัง
--   role          = 'user' เป็นค่าเริ่มต้น · สมัครผ่าน API สาธารณะได้เป็น user เท่านั้น
--                   admin สร้างได้ทางเดียวคือ scripts/seed-admin.js
CREATE TABLE IF NOT EXISTS users (
  id             CHAR(36) NOT NULL,
  email          VARCHAR(255) NOT NULL COMMENT 'ตัวพิมพ์เล็กเสมอ',
  password_hash  VARCHAR(255) NOT NULL COMMENT 'bcrypt hash ไม่ใช่รหัสผ่านจริง',
  display_name   VARCHAR(100) NOT NULL,
  role           ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
