-- 010: บัญชีผู้ใช้จริง (อีเมล + รหัสผ่าน) และบทบาท user / admin
--
-- ก่อนหน้านี้ระบบไม่มีล็อกอิน ประวัติการซ่อมผูกกับ client_id ของเบราว์เซอร์ (migration 008)
-- ตารางนี้เป็นฐานของ /auth/register, /auth/login, /auth/me และ @Roles(...) ฝั่ง backend
--
-- id            = UUID v4 ที่ backend สร้างเอง (CHAR(36) เหมือน sessions.session_id)
-- email         = เก็บเป็นตัวพิมพ์เล็กเสมอ (backend แปลงก่อนเก็บ/ก่อนค้น) UNIQUE
--                 collation _ci ทำให้ไม่แยกตัวพิมพ์เล็ก/ใหญ่ซ้ำอีกชั้นหนึ่ง
--                 VARCHAR(255) × 4 ไบต์ = 1,020 ไบต์ อยู่ในขีดจำกัดดัชนี InnoDB (3,072 ไบต์)
-- password_hash = ผลลัพธ์ของ bcrypt (60 ตัวอักษร) ห้ามเก็บรหัสผ่านจริง · เผื่อ 255 เผื่อเปลี่ยนอัลกอริทึมภายหลัง
-- display_name  = ชื่อที่แสดง 1-100 ตัวอักษร (ตรวจที่ backend: auth.dto.ts)
-- role          = 'user' เป็นค่าเริ่มต้น · สมัครผ่าน API สาธารณะได้เป็น user เท่านั้น
--                 admin สร้างได้ทางเดียวคือ scripts/seed-admin.js (อ่าน ADMIN_EMAIL / ADMIN_PASSWORD จาก .env)
--
-- ตารางใหม่ ไม่แตะตารางเดิม และเป็นคำสั่ง DDL เดียว (IF NOT EXISTS: รันซ้ำไม่พัง)
-- charset/collation ตรงกับตารางอื่น (utf8mb4_unicode_ci) เพื่อให้ Step 2 ทำ FOREIGN KEY มาที่ users ได้
--
-- ย้อนกลับ (ไม่ได้รันอัตโนมัติ ต้องรันเอง):
--   DROP TABLE users
--   DELETE FROM schema_migrations WHERE filename = '010_create_users.sql'
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
