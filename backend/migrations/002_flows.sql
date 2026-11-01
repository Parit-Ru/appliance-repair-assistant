-- 002_flows: ผังขั้นตอนการวินิจฉัย (manuals → flows → states → state_transitions)
-- ไม่พึ่งตารางอื่น · sessions จะอ้างถึง flows
-- ทุกตาราง: InnoDB, utf8mb4, utf8mb4_unicode_ci (ต้องตรงกันทั้งหมด ไม่งั้น FOREIGN KEY สร้างไม่ได้)
-- รายละเอียดว่าแต่ละตารางเก็บอะไร ดู docs/reference/DATABASE.md
--
-- ผังหนึ่งผัง (flows) คือออโตมาตา M = (Q, Σ, δ, q0, F):
--   Q  = ตาราง states                    (1 แถว = 1 สถานะ, PK = flow_id + state_id)
--   Σ  = state_transitions.input_symbol  yes / no   = ตอบ "ใช่/ไม่ใช่" ที่สถานะ checkpoint
--                                        next      = continue / confirm_safety / input ที่ผ่าน pattern
--                                        invalid   = input ที่ไม่ผ่าน pattern (ไม่มีแถว invalid = วนอยู่สถานะเดิม)
--   δ  = ตาราง state_transitions         (flow_id, from_state_id, input_symbol) → to_state_id
--   q0 = flows.initial_state             (สถานะเริ่มต้นของผัง)
--   F  = states ที่ state_type เป็น resolution / escalation (ไม่มี transition ออก)
-- ผู้ใช้เดินผัง = ป้อนสัญลักษณ์ใน Σ ทีละตัวจนถึงสถานะใน F (sessions.current_state_id คือสถานะปัจจุบัน)

-- manuals: 1 แถวต่อคู่มือ 1 เล่ม (ใช้ทำรายการ "เลือกเครื่อง/รุ่น")
--   display_name  = ชื่อรุ่นที่ผู้ใช้รู้จัก เติมโดยผู้พัฒนาจากคู่มือ NULL = หน้าเว็บแสดง model_pattern แทน
--   model_aliases = เลขรุ่น/ชื่อขายอื่นที่ใช้คู่มือเล่มเดียวกัน (JSON array ของข้อความ)
CREATE TABLE IF NOT EXISTS manuals (
  manual_id        VARCHAR(80)  NOT NULL,
  device_category  ENUM('Microwave','Refrigerator','Television','Washing Machine') NOT NULL,
  brand            VARCHAR(40)  NOT NULL,
  model_pattern    VARCHAR(60)  NOT NULL,
  source_manual    VARCHAR(200) NOT NULL COMMENT 'ชื่อไฟล์คู่มือต้นฉบับ ใช้สร้างการอ้างอิง',
  flow_count       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  display_name     VARCHAR(120) NULL COMMENT 'ชื่อรุ่นที่ผู้ใช้รู้จัก เติมโดยผู้พัฒนาจากคู่มือ NULL = แสดง model_pattern แทน',
  model_aliases    JSON NULL COMMENT 'เลขรุ่น/ชื่อขายอื่นที่ใช้คู่มือเล่มนี้ (อาร์เรย์ของข้อความ) NULL = ไม่มี',
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (manual_id),
  INDEX idx_manuals_category (device_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- flows: 1 แถวต่ออาการ 1 อาการ = ผังขั้นตอน 1 ชุด (หัวผัง; สถานะอยู่ในตาราง states)
CREATE TABLE IF NOT EXISTS flows (
  flow_id            VARCHAR(120) NOT NULL,
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
  initial_state      VARCHAR(60) NOT NULL COMMENT 'q0: state_id ของสถานะเริ่มต้น',
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (flow_id),

  -- ลบคู่มือ = ลบผังของคู่มือนั้นทั้งหมด
  CONSTRAINT fk_flows_manual
    FOREIGN KEY (manual_id) REFERENCES manuals (manual_id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  INDEX idx_flows_manual (manual_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- states (Q): สถานะของผัง (1 แถวต่อสถานะ) ชนิด checkpoint / instruction / input / resolution / escalation
--   เส้นเชื่อมไปสถานะถัดไปอยู่ในตาราง state_transitions (ไม่เก็บเป็นคอลัมน์ในตารางนี้)
CREATE TABLE IF NOT EXISTS states (
  flow_id         VARCHAR(120) NOT NULL,
  state_id        VARCHAR(60)  NOT NULL,
  state_type      ENUM('checkpoint','instruction','input','resolution','escalation') NOT NULL,
  text_content    TEXT NOT NULL COMMENT 'question / content / prompt แล้วแต่ state_type',
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

  PRIMARY KEY (flow_id, state_id),

  CONSTRAINT fk_states_flow
    FOREIGN KEY (flow_id) REFERENCES flows (flow_id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  INDEX idx_states_type (state_type),
  INDEX idx_states_safety (safety_critical)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- state_transitions (δ): 1 แถว = 1 เส้นเชื่อม — ที่สถานะ from_state_id เมื่อได้รับสัญลักษณ์ input_symbol ให้ไป to_state_id
--   PK (flow_id, from_state_id, input_symbol) = deterministic (สถานะหนึ่งมีทางไปได้ทางเดียวต่อสัญลักษณ์)
--   ทั้งสองปลายอ้าง states ในผังเดียวกัน (flow_id ร่วม) → เส้นเชื่อมข้ามผังหรือชี้ไปสถานะที่ไม่มีจริงสร้างไม่ได้
--   ตัว backend อ่านตารางนี้ตอนบูตแล้วพับกลับเป็น on_yes / on_no / next / on_invalid ของแต่ละสถานะ (flow.repository.ts)
CREATE TABLE IF NOT EXISTS state_transitions (
  flow_id        VARCHAR(120) NOT NULL,
  from_state_id  VARCHAR(60)  NOT NULL,
  input_symbol   ENUM('yes','no','next','invalid') NOT NULL,
  to_state_id    VARCHAR(60)  NOT NULL,

  PRIMARY KEY (flow_id, from_state_id, input_symbol),

  CONSTRAINT fk_transitions_from
    FOREIGN KEY (flow_id, from_state_id) REFERENCES states (flow_id, state_id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_transitions_to
    FOREIGN KEY (flow_id, to_state_id) REFERENCES states (flow_id, state_id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  INDEX idx_transitions_to (flow_id, to_state_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
