-- 005_session_feedback: คะแนน/ความเห็นของผู้ใช้ (session_feedback)
-- ต้องรันหลัง 004_sessions (FK ไปที่ sessions)
-- ทุกตาราง: InnoDB, utf8mb4, utf8mb4_unicode_ci (ต้องตรงกันทั้งหมด ไม่งั้น FOREIGN KEY สร้างไม่ได้)
-- รายละเอียดว่าแต่ละตารางเก็บอะไร ดู docs/reference/DATABASE.md

-- session_feedback: ผู้ใช้ให้คะแนนผลการตรวจย้อนหลัง 👍/👎 + ข้อความ (ไม่บังคับ)
--   1 session มีได้ 1 แถว (PRIMARY KEY = session_id) · ส่งซ้ำ = แก้ค่าเดิม (ON DUPLICATE KEY UPDATE ที่ backend)
--   comment ว่าง = NULL · ความยาว ≤ 500 ตรวจที่ backend (history.dto.ts) ไม่ได้บังคับด้วยชนิดคอลัมน์
--   ลบ session → ลบแถวนี้ตามด้วย
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
