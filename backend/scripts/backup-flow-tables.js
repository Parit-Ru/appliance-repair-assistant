// backup-flow-tables.js — สำรองตารางผังเป็นไฟล์ .sql (INSERT ล้วน) ก่อนทดสอบ publish ครั้งแรก
//
// สำรอง: manuals, flows, states, state_transitions (+ flow_drafts ถ้ามี) — ตารางที่ publish แตะ
// อ่านอย่างเดียว (SET SESSION TRANSACTION READ ONLY) ไม่แก้ฐานข้อมูล · ไม่พิมพ์ค่าการเชื่อมต่อ
// ไม่ต้องมี mysqldump · ใช้ค่าเชื่อมต่อจาก backend/.env เหมือน run-migrations.js
//
// รัน: node scripts/backup-flow-tables.js          → backups/flow-tables-<เวลา>.sql
//
// กู้คืน (ถ้าจำเป็น): ไฟล์เป็น INSERT ล้วน ไม่ลบอะไร · ถ้าจะกู้ทั้งตารางต้องลบข้อมูลที่ต้องการแทนที่ก่อนเอง
// (ผังที่ publish เพิ่มเข้าไปมี manual_id/flow_id ใหม่ ลบออกด้วย SQL ใน docs/authoring/authoring-b1-testing.md ได้โดยไม่ต้องกู้)

require('dotenv/config');

const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

/** ลำดับตาม FK: manuals → flows → states → state_transitions (กู้คืนต้องเรียงแบบนี้) */
const TABLES = ['manuals', 'flows', 'states', 'state_transitions', 'flow_drafts'];

function connectionConfig() {
  const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_NAME'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`ไม่พบค่าใน .env: ${missing.join(', ')}`);
  }
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
    dateStrings: true,
    ssl: process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : undefined,
  };
}

/** ค่า → ข้อความ SQL (JSON ที่ mysql2 แปลงเป็น object แล้วต้องแปลงกลับเป็นข้อความก่อน escape) */
function sqlValue(conn, value) {
  if (value !== null && typeof value === 'object' && !Buffer.isBuffer(value) && !(value instanceof Date)) {
    return conn.escape(JSON.stringify(value));
  }
  return conn.escape(value);
}

async function main() {
  const conn = await mysql.createConnection(connectionConfig());
  try {
    await conn.query('SET SESSION TRANSACTION READ ONLY');

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = path.resolve(__dirname, '../backups');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `flow-tables-${stamp}.sql`);

    const lines = [`-- สำรองเมื่อ ${new Date().toISOString()} · ตาราง: ${TABLES.join(', ')}`, 'SET NAMES utf8mb4;', 'SET FOREIGN_KEY_CHECKS = 0;', ''];
    const counts = {};

    for (const table of TABLES) {
      const [exists] = await conn.query('SHOW TABLES LIKE ?', [table]);
      if (exists.length === 0) {
        console.log(`ข้าม ${table} (ยังไม่มีตารางนี้)`);
        continue;
      }
      const [rows] = await conn.query(`SELECT * FROM \`${table}\``);
      counts[table] = rows.length;
      lines.push(`-- ${table}: ${rows.length} แถว`);
      for (let i = 0; i < rows.length; i += 200) {
        const batch = rows.slice(i, i + 200);
        const columns = Object.keys(batch[0]);
        const values = batch.map((row) => `(${columns.map((c) => sqlValue(conn, row[c])).join(', ')})`);
        lines.push(`INSERT INTO \`${table}\` (${columns.map((c) => `\`${c}\``).join(', ')}) VALUES\n${values.join(',\n')};`);
      }
      lines.push('');
    }

    lines.push('SET FOREIGN_KEY_CHECKS = 1;');
    fs.writeFileSync(file, lines.join('\n'), 'utf8');

    console.log('สำรองสำเร็จ:', file);
    for (const [table, n] of Object.entries(counts)) console.log(`  ${table.padEnd(17)} ${String(n).padStart(6)} แถว`);
    console.log(`ขนาดไฟล์ ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('\nสำรองล้มเหลว:', err.message);
  process.exit(1);
});
