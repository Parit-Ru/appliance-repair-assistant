-- 008_flow_revisions: บันทึกว่า admin คนไหนแก้/ลบ/กู้คืนผังเมื่อไร พร้อมเนื้อหาก่อนแก้
-- ต้องรันหลัง 001_users, 002_flows และ 007_flow_management
-- ไม่มีส่วนใดของการเดินผังอ่านตารางนี้ ใช้ตรวจย้อนหลังและกู้ด้วยมือเท่านั้น
-- ออกแบบ: docs/design/admin-flow-management.md ส่วน 3.1
CREATE TABLE IF NOT EXISTS flow_revisions (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  flow_id     VARCHAR(120) NOT NULL,
  action      ENUM('edit','delete','restore') NOT NULL,
  revision    INT UNSIGNED NOT NULL COMMENT 'ค่า flows.revision ก่อนทำรายการนี้',
  snapshot    JSON NULL COMMENT 'เนื้อหาก่อนแก้ รูปเดียวกับ GET /admin/flows/:id · มีเฉพาะ action = edit',
  acted_by    CHAR(36) NULL COMMENT 'users.id ของ admin ที่ทำรายการ',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_revisions_flow (flow_id, created_at),

  CONSTRAINT fk_revisions_flow FOREIGN KEY (flow_id) REFERENCES flows (flow_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_revisions_acted_by FOREIGN KEY (acted_by) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
