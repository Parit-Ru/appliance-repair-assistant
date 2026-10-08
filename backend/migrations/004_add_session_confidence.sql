ALTER TABLE sessions
  ADD COLUMN confidence DECIMAL(4,3) NULL
  COMMENT 'คะแนนความคล้าย (cosine) ของผังที่เลือก NULL = ไม่มีการจับคู่ให้วัด'
  AFTER variables;
