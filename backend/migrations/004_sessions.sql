-- 004_sessions: การเดินผัง (sessions, session_history)
-- ต้องรันหลัง 001_users และ 002_flows (FK ไปที่ users และ flows)
-- ทุกตาราง: InnoDB, utf8mb4, utf8mb4_unicode_ci (ต้องตรงกันทั้งหมด ไม่งั้น FOREIGN KEY สร้างไม่ได้)
-- รายละเอียดว่าแต่ละตารางเก็บอะไร ดู docs/reference/DATABASE.md

-- sessions: การตรวจ 1 ครั้ง = การเดินผัง 1 ผัง
--   variables       = ค่าที่ผู้ใช้กรอกที่สถานะ input (ไว้แทน {{ตัวแปร}} ในข้อความ) — ไม่ใส่ข้อมูลอื่นปน
--   confidence      = คะแนน cosine ของผังที่เลือก (แสดงผลอย่างเดียว) NULL = ไม่ได้ค้นด้วยข้อความ
--   outcome_text    = ข้อความผลลัพธ์ที่ผู้ใช้พิมพ์หลังจบ (บันทึกได้ครั้งเดียว) · outcome_at = เวลาที่บันทึก
--   model_selection = selected (เลือกรุ่นเอง) · unknown (ไม่ทราบรุ่น เลือกใกล้เคียง) · NULL = ไม่ผ่านหน้าเลือกรุ่น
--                     ใช้แยกเคสตอนวัดผล ไม่ได้ตัดสินขั้นตอนของ engine
--   เจ้าของมีได้แบบเดียวต่อ session (บังคับที่ backend: auth/session-owner.ts ไม่ได้บังคับด้วย constraint):
--     client_id = UUID ของเบราว์เซอร์ guest (หัวข้อ X-Client-Id) · ไม่ใช่การยืนยันตัวตน
--     user_id   = users.id ของผู้ล็อกอิน · ON DELETE SET NULL (ลบบัญชีแล้วแถว session ยังอยู่แต่ไม่มีเจ้าของ)
--     guest ใช้ AND user_id IS NULL เสมอ → มองไม่เห็น/ลบ session ของ user ไม่ได้
--   expires_at = เดินอยู่ 24 ชม. ต่ออายุทุกขั้น · จบแล้ว 90 วัน (กำหนดที่ backend)
CREATE TABLE IF NOT EXISTS sessions (
  session_id       CHAR(36) NOT NULL,
  flow_id          VARCHAR(120) NOT NULL,
  current_state_id VARCHAR(60)  NOT NULL COMMENT 'สถานะปัจจุบันของผู้ใช้ (จบแล้ว = สถานะสิ้นสุดใน F)',
  status           ENUM('in_progress','completed') NOT NULL DEFAULT 'in_progress',
  variables        JSON NOT NULL,
  confidence       DECIMAL(4,3) NULL
                   COMMENT 'คะแนนความคล้าย (cosine) ของผังที่เลือก NULL = ไม่มีการจับคู่ให้วัด',
  outcome_text     TEXT NULL
                   COMMENT 'ข้อความผลลัพธ์ที่ผู้ใช้พิมพ์หลังการตรวจจบ (บันทึกได้ครั้งเดียว)',
  outcome_at       DATETIME NULL
                   COMMENT 'เวลาที่บันทึกข้อความผลลัพธ์',
  model_selection  ENUM('selected','unknown') NULL
                   COMMENT 'selected = เลือกรุ่นเอง · unknown = ไม่ทราบรุ่นแล้วเลือกใกล้เคียง · NULL = ไม่ได้ผ่านหน้าเลือกรุ่น',
  client_id        CHAR(36) NULL
                   COMMENT 'UUID ของเบราว์เซอร์เจ้าของ (guest) · NULL = ไม่ใช่ guest หรือไม่ทราบเจ้าของ',
  user_id          CHAR(36) NULL
                   COMMENT 'users.id ของเจ้าของที่ล็อกอิน · NULL = guest (ดู client_id) หรือไม่มีเจ้าของ',
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  expires_at       TIMESTAMP NOT NULL,

  PRIMARY KEY (session_id),

  CONSTRAINT fk_sessions_flow
    FOREIGN KEY (flow_id) REFERENCES flows (flow_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,

  CONSTRAINT fk_sessions_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  INDEX idx_sessions_flow (flow_id),
  INDEX idx_sessions_expires (expires_at),
  INDEX idx_sessions_status (status),
  -- รองรับ WHERE client_id = ? AND status = 'completed' AND expires_at > NOW() (หน้าประวัติของ guest)
  INDEX idx_sessions_client (client_id, status, expires_at),
  -- รองรับ WHERE user_id = ? AND status = 'completed' AND expires_at > NOW() (หน้าประวัติของผู้ล็อกอิน)
  INDEX idx_sessions_user (user_id, status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- session_history: ทุก action ที่ผู้ใช้ส่งใน session (1 แถวต่อขั้น)
--   UNIQUE (session_id, step_order) คือตัวกันสองคำขอซ้อนกันบน session เดียว — โค้ดพึ่งตัวนี้ ห้ามตัด
CREATE TABLE IF NOT EXISTS session_history (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id   CHAR(36) NOT NULL,
  step_order   SMALLINT UNSIGNED NOT NULL,
  state_id     VARCHAR(60) NOT NULL COMMENT 'สถานะที่ผู้ใช้อยู่ตอนส่ง action นี้',
  action_type  ENUM('answer','continue','confirm_safety','input') NOT NULL,
  action_value VARCHAR(255) NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  CONSTRAINT fk_history_session
    FOREIGN KEY (session_id) REFERENCES sessions (session_id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  UNIQUE KEY uq_history_step (session_id, step_order),

  INDEX idx_history_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
