-- 003_equipment: อุปกรณ์ที่ต้องใช้ตามประเภทเครื่อง (equipment, equipment_usage)
-- ไม่พึ่งตารางอื่น
-- ทุกตาราง: InnoDB, utf8mb4, utf8mb4_unicode_ci (ต้องตรงกันทั้งหมด ไม่งั้น FOREIGN KEY สร้างไม่ได้)
-- รายละเอียดว่าแต่ละตารางเก็บอะไร ดู docs/reference/DATABASE.md

-- equipment: รายการอุปกรณ์ (ไม่ผูกกับเครื่องใด)
CREATE TABLE IF NOT EXISTS equipment (
  equipment_id  VARCHAR(60)  NOT NULL,
  name_th       VARCHAR(100) NOT NULL,
  name_en       VARCHAR(100) NOT NULL COMMENT 'เผื่อ UI สองภาษา',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (equipment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- equipment_usage: เครื่องประเภทนี้ใช้อุปกรณ์ชิ้นนี้ทำอะไร
--   ต้องมีที่มา: source_page (หน้าคู่มือ) หรือ author_note (ผู้พัฒนาเพิ่มเอง) อย่างน้อยหนึ่งอย่าง
CREATE TABLE IF NOT EXISTS equipment_usage (
  device_category ENUM('Microwave','Refrigerator','Television','Washing Machine') NOT NULL,
  equipment_id    VARCHAR(60) NOT NULL,
  purpose_th      TEXT NOT NULL COMMENT 'ใช้ทำอะไรกับเครื่องประเภทนี้',
  source_page     SMALLINT UNSIGNED NULL COMMENT 'เลขหน้าคู่มือ ถ้าอ้างอิงได้',
  author_note     TEXT NULL COMMENT 'กำกับเมื่อผู้พัฒนาเขียนเอง',
  display_order   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (device_category, equipment_id),

  CONSTRAINT fk_usage_equipment
    FOREIGN KEY (equipment_id) REFERENCES equipment (equipment_id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT chk_usage_provenance
    CHECK (source_page IS NOT NULL OR author_note IS NOT NULL),

  INDEX idx_usage_category (device_category, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
