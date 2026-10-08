-- manuals 1 แถวต่อคู่มือ 1 เล่ม
CREATE TABLE IF NOT EXISTS manuals (
  manual_id        VARCHAR(80)  NOT NULL,
  device_category  VARCHAR(40)  NOT NULL,
  brand            VARCHAR(40)  NOT NULL,
  model_pattern    VARCHAR(60)  NOT NULL,
  source_manual    VARCHAR(200) NOT NULL COMMENT 'ชื่อไฟล์คู่มือต้นฉบับ ใช้สร้างการอ้างอิง',
  graph_count      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (manual_id),
  INDEX idx_manuals_category (device_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- graphs 1 แถวต่ออาการ 1 อาการ
CREATE TABLE IF NOT EXISTS graphs (
  graph_id           VARCHAR(120) NOT NULL,
  manual_id          VARCHAR(80)  NOT NULL,
  entry_symptom      TEXT NOT NULL COMMENT 'อาการตามคู่มือ (อังกฤษ)',
  entry_symptom_th   TEXT NULL     COMMENT 'อาการภาษาไทย ใช้แสดงผลและค้นหา',
  entry_symptom_aliases JSON NULL  COMMENT 'คำพ้องที่ผู้ใช้อาจพิมพ์ เก็บเป็น array',
  source             VARCHAR(200) NOT NULL,
  page_start         SMALLINT UNSIGNED NOT NULL,
  page_end           SMALLINT UNSIGNED NOT NULL,
  source_chunk_id    VARCHAR(200) NOT NULL,
  severity           ENUM('low','medium','high','critical') NULL,
  difficulty         ENUM('easy','medium','hard') NULL,
  config             JSON NULL,
  entry_node         VARCHAR(60) NOT NULL,
  schema_version     TINYINT UNSIGNED NOT NULL DEFAULT 2,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (graph_id),

  -- ลบคู่มือ = ลบกราฟของคู่มือนั้นทั้งหมด
  CONSTRAINT fk_graphs_manual
    FOREIGN KEY (manual_id) REFERENCES manuals (manual_id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  INDEX idx_graphs_manual (manual_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS nodes (
  graph_id        VARCHAR(120) NOT NULL,
  node_id         VARCHAR(60)  NOT NULL,
  node_type       ENUM('checkpoint','instruction','input','resolution','escalation') NOT NULL,
  text_content    TEXT NOT NULL COMMENT 'question / content / prompt แล้วแต่ node_type',
  on_yes          VARCHAR(60) NULL COMMENT 'checkpoint เท่านั้น',
  on_no           VARCHAR(60) NULL COMMENT 'checkpoint เท่านั้น',
  next_node       VARCHAR(60) NULL COMMENT 'instruction และ input',
  on_invalid      VARCHAR(60) NULL COMMENT 'input เท่านั้น ถ้า NULL = วนกลับโหนดเดิม',
  input_type      ENUM('error_code','model_number','number','text') NULL,
  input_pattern   VARCHAR(255) NULL COMMENT 'regex ที่คำตอบต้องผ่าน',
  store_as        VARCHAR(60)  NULL COMMENT 'key ที่เก็บค่าลง session.variables',
  outcome_kind    ENUM('user_fixed','normal_behavior','handoff_informed','handoff_unknown') NULL,
  safety_critical BOOLEAN NOT NULL DEFAULT FALSE,
  safety_warning  TEXT NULL,
  has_image       BOOLEAN NOT NULL DEFAULT FALSE,
  image_url       VARCHAR(255) NULL,
  author_note     TEXT NULL COMMENT 'ระบุข้อความที่ผู้พัฒนาเพิ่มเอง ไม่ได้มาจากคู่มือ',
  external_reference JSON NULL,
  display_order   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (graph_id, node_id),

  CONSTRAINT fk_nodes_graph
    FOREIGN KEY (graph_id) REFERENCES graphs (graph_id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  INDEX idx_nodes_type (node_type),
  INDEX idx_nodes_safety (safety_critical)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;