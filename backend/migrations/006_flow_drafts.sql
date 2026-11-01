-- 006_flow_drafts: ร่างผังขั้นตอนจาก PDF (flow_drafts)
-- ต้องรันหลัง 001_users (FK ไปที่ users)
-- ทุกตาราง: InnoDB, utf8mb4, utf8mb4_unicode_ci (ต้องตรงกันทั้งหมด ไม่งั้น FOREIGN KEY สร้างไม่ได้)
-- รายละเอียดว่าแต่ละตารางเก็บอะไร ดู docs/reference/DATABASE.md

-- flow_drafts: ร่างผังที่ LLM ช่วยร่างจาก PDF — เก็บ "แยกจาก" manuals/flows/states/state_transitions โดยตั้งใจ
--   ไม่มีจุดอ่านผังของผู้ใช้แตะตารางนี้ ร่างจึงมองไม่เห็นจนกว่า admin จะ publish
--   (publish = INSERT ลง manuals/flows/states/state_transitions ใน transaction เดียวหลัง validator ผ่าน ไม่ทับของเดิม)
--   status: drafting (LLM กำลังร่าง) · ready (รอตรวจ/แก้) · failed · rejected · published
--   meta       = ข้อมูลคู่มือที่ admin กรอกตอนอัปโหลด (เซิร์ฟเวอร์ใช้ค่านี้ ไม่เชื่อค่าจาก LLM)
--   pages      = ข้อความของ "ช่วงหน้าที่เลือก" เท่านั้น [{page, text}] (ไม่เก็บไฟล์ PDF)
--   flows      = ร่างผัง (null จนกว่า LLM จะตอบ) · validation = รายงานของ validator ครั้งล่าสุด
--   created_by / reviewed_by = users.id (ON DELETE SET NULL) · ไม่เก็บอีเมล
CREATE TABLE IF NOT EXISTS flow_drafts (
  id              CHAR(36) NOT NULL,
  status          ENUM('drafting','ready','failed','rejected','published') NOT NULL DEFAULT 'drafting',
  manual_id       VARCHAR(80) NOT NULL,
  meta            JSON NOT NULL,
  pages           JSON NOT NULL,
  flows           JSON NULL,
  validation      JSON NULL,

  progress_done   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  progress_total  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  error_code      VARCHAR(60) NULL,
  error_message   VARCHAR(500) NULL,

  llm_model       VARCHAR(120) NULL,
  prompt_version  VARCHAR(20) NULL,

  created_by      CHAR(36) NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  reviewed_by     CHAR(36) NULL,
  reviewed_at     TIMESTAMP NULL,
  published_at    TIMESTAMP NULL,

  PRIMARY KEY (id),
  INDEX idx_drafts_status (status, created_at),
  INDEX idx_drafts_manual (manual_id),

  CONSTRAINT fk_drafts_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_drafts_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
