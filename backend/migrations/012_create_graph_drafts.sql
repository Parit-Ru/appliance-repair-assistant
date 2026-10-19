-- 012: ร่างผังขั้นตอนที่ LLM ช่วยร่างจาก PDF (Step 5 · docs/authoring/PLAN-STEP5-AUTHORING.md)
--
-- หลักการ: ร่างเก็บ "แยกจาก" manuals / graphs / nodes โดยสิ้นเชิง
--   - ไม่มีจุดอ่านผังของผู้ใช้ (traversal, ค้นอาการ, ประวัติ, รายการเครื่อง) แตะตารางนี้ ร่างจึงเข้าถึงไม่ได้จนกว่าจะ publish
--   - โปรเจกต์เก่า (troubleshoot-assistantv2) ใช้ฐานข้อมูลเดียวกันและอ่าน graphs ตรงๆ ถ้าใส่ status ใน graphs จะเห็นร่างด้วย
--   - publish = INSERT ลง manuals/graphs/nodes ใน transaction เดียวหลัง validator ผ่าน (ไม่ทับของเดิม)
--
-- status: drafting (LLM กำลังร่าง) · ready (ร่างเสร็จ รอตรวจ/แก้) · failed (LLM/parse ล้ม ลองใหม่ได้)
--         rejected (ผู้ดูแลปฏิเสธ) · published (เผยแพร่แล้ว)
-- meta      = ข้อมูลคู่มือที่ผู้ดูแลกรอกตอนอัปโหลด (device_category, brand, model_pattern, source_manual, display_name, page_from, page_to)
--             เซิร์ฟเวอร์ใช้ค่านี้ประกอบผัง ไม่เชื่อค่าจาก LLM
-- pages     = ข้อความที่แยกได้ของ "ช่วงหน้าที่เลือก" เท่านั้น [{page, text}] (ไม่เก็บไฟล์ PDF · ดิสก์ของ Render ไม่ถาวร)
-- graphs    = ร่างผัง (รูปแบบเดียวกับผังใน data/manuals + source_page รายโหนด) null จนกว่า LLM จะตอบ
-- validation= รายงานของ validator ครั้งล่าสุด {errors, warnings, stats, validatedAt}
-- audit     = created_by/created_at, reviewed_by/reviewed_at (ปฏิเสธ/เผยแพร่), published_at — เก็บ user id ไม่เก็บอีเมล
--             ผังที่ publish มี graphs.source_chunk_id = 'draft:<id>:<graph_id>' ย้อนกลับมาที่ร่างได้
--
-- ย้อนกลับ (ไม่ได้รันอัตโนมัติ ต้องรันเอง):
--   DROP TABLE graph_drafts
--   DELETE FROM schema_migrations WHERE filename = '012_create_graph_drafts.sql'
CREATE TABLE IF NOT EXISTS graph_drafts (
  id              CHAR(36) NOT NULL,
  status          ENUM('drafting','ready','failed','rejected','published') NOT NULL DEFAULT 'drafting',
  manual_id       VARCHAR(80) NOT NULL,
  meta            JSON NOT NULL,
  pages           JSON NOT NULL,
  graphs          JSON NULL,
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
