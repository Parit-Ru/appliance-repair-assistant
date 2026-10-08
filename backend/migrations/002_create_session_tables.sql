CREATE TABLE IF NOT EXISTS sessions (
  session_id       CHAR(36) NOT NULL,
  graph_id         VARCHAR(120) NOT NULL,
  current_node_id  VARCHAR(60)  NOT NULL,
  status           ENUM('in_progress','completed') NOT NULL DEFAULT 'in_progress',
  variables        JSON NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  expires_at       TIMESTAMP NOT NULL,

  PRIMARY KEY (session_id),

  CONSTRAINT fk_sessions_graph
    FOREIGN KEY (graph_id) REFERENCES graphs (graph_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,

  INDEX idx_sessions_expires (expires_at),
  INDEX idx_sessions_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS session_history (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id   CHAR(36) NOT NULL,
  step_order   SMALLINT UNSIGNED NOT NULL,
  node_id      VARCHAR(60) NOT NULL COMMENT 'โหนดที่ผู้ใช้อยู่ตอนส่ง action นี้',
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