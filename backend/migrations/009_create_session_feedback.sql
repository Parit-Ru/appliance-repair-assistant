-- 009: ผู้ใช้ให้คะแนนผลการตรวจย้อนหลัง 👍/👎 + ข้อความ (ไม่บังคับ) จากหน้า "ประวัติการซ่อม"
-- (docs/history-page.md ข้อ D4)
--
-- 1 session มีได้ 1 แถว (PRIMARY KEY = session_id) · ส่งซ้ำ = แก้ค่าเดิม (ON DUPLICATE KEY UPDATE ที่ฝั่ง backend)
-- helpful = 1 → 👍 · 0 → 👎
-- comment = ข้อความของผู้ใช้ ไม่บังคับ · ว่าง = NULL (backend ตัดช่องว่างหน้าหลังแล้วแปลงข้อความว่างเป็น NULL)
--           ความยาวไม่เกิน 500 ตัวอักษร: ตรวจที่ backend (history.dto.ts) ไม่ได้บังคับด้วยชนิดคอลัมน์
--           ใช้ TEXT ตามที่ตกลง (4 ไบต์/ตัวอักษร × 500 = 2,000 ไบต์ อยู่ในขีดจำกัดของ TEXT สบาย)
--
-- ลบ session (จากหน้าประวัติ หรือหมดอายุแล้วถูกลบ) → ลบแถวนี้ตามด้วย (ON DELETE CASCADE)
--
-- ตารางใหม่ ไม่แตะตารางเดิม และเป็นคำสั่ง DDL เดียว (IF NOT EXISTS: รันซ้ำไม่พัง)
-- ตั้งชื่อ session_feedback โดยตรวจแล้วว่าโปรเจกต์เก่า (troubleshoot-assistantv2) ไม่มีตารางชื่อนี้
-- charset/collation ต้องตรงกับ sessions (utf8mb4_unicode_ci) ไม่งั้น FOREIGN KEY สร้างไม่ได้
--
-- ต้องรันหลัง 008 และก่อน deploy backend เช่นกัน
--
-- ย้อนกลับ (ไม่ได้รันอัตโนมัติ ต้องรันเอง):
--   DROP TABLE session_feedback
--   DELETE FROM schema_migrations WHERE filename = '009_create_session_feedback.sql'
CREATE TABLE IF NOT EXISTS session_feedback (
  session_id  CHAR(36) NOT NULL,
  helpful     TINYINT(1) NOT NULL COMMENT '1 = 👍 · 0 = 👎',
  `comment`   TEXT NULL COMMENT 'ข้อความของผู้ใช้ ไม่บังคับ ไม่เกิน 500 ตัวอักษร (ว่าง = NULL)',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (session_id),

  CONSTRAINT fk_feedback_session
    FOREIGN KEY (session_id) REFERENCES sessions (session_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
