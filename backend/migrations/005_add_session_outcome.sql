ALTER TABLE sessions
  ADD COLUMN outcome_text TEXT NULL
  COMMENT '...'
  AFTER confidence,
  ADD COLUMN outcome_at DATETIME NULL
  COMMENT '...'
  AFTER outcome_text;
