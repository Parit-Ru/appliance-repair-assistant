// backend/scripts/run-migrations.js
//
// รันไฟล์ .sql ในโฟลเดอร์ migrations/ ตามลำดับชื่อไฟล์
// และจำไว้ว่าไฟล์ไหนรันไปแล้ว เพื่อไม่ให้รันซ้ำ
//
//   npm run migrate           รัน migration ที่ยังไม่เคยรัน
//   node scripts/run-migrations.js --status   ดูสถานะเฉยๆ ไม่รันอะไร
//   ⚠️ ห้ามใช้ npm run migrate -- --status บน PowerShell 5.1: มันตัด "--" ทิ้ง
//      แล้วรัน migration จริงโดยไม่ตั้งใจ (เคยเกิดกับ migration 005)
//
// เขียนเป็น JavaScript ธรรมดา (ไม่ใช่ TypeScript) เพราะเป็นเครื่องมือของนักพัฒนา
// ไม่ใช่ส่วนหนึ่งของแอป จึงไม่ต้องผ่านขั้นตอน compile

require('dotenv/config');

const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

// ------------------------------------------------------------
// การเชื่อมต่อ
// ------------------------------------------------------------

function connectionConfig() {
  const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_NAME'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `ไม่พบค่าใน .env: ${missing.join(', ')}\n` +
        `คัดลอก backend/.env.example เป็น backend/.env แล้วกรอกค่าก่อน`,
    );
  }

  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME,

    // ต้องตั้ง utf8mb4 ไม่งั้นภาษาไทยที่เขียนลงไปจะกลายเป็น ????
    charset: 'utf8mb4',

    // จำเป็นสำหรับ migration เพราะ 1 ไฟล์มีหลายคำสั่ง
    // ตัวแอปจริงจะไม่เปิดตัวเลือกนี้ เพราะเพิ่มความเสี่ยง SQL injection
    multipleStatements: true,

    // Aiven และผู้ให้บริการ cloud ส่วนใหญ่บังคับ TLS
    ssl: process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : undefined,
  };
}

// ------------------------------------------------------------
// ตารางที่ใช้จำว่ารัน migration ไหนไปแล้ว
// ------------------------------------------------------------

async function ensureMigrationsTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   VARCHAR(200) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (filename)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

async function appliedFilenames(conn) {
  const [rows] = await conn.query('SELECT filename FROM schema_migrations');
  return new Set(rows.map((r) => r.filename));
}

function migrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`ไม่พบโฟลเดอร์ ${MIGRATIONS_DIR}`);
  }

  // เรียงตามชื่อไฟล์ จึงต้องตั้งชื่อขึ้นต้นด้วยเลข 001_ 002_ ...
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

// ------------------------------------------------------------
// การทำงานหลัก
// ------------------------------------------------------------

async function main() {
  const statusOnly = process.argv.includes('--status');
  const conn = await mysql.createConnection(connectionConfig());

  try {
    await ensureMigrationsTable(conn);

    const applied = await appliedFilenames(conn);
    const files = migrationFiles();
    const pending = files.filter((f) => !applied.has(f));

    console.log(`ฐานข้อมูล: ${process.env.DB_NAME} ที่ ${process.env.DB_HOST}:${process.env.DB_PORT}`);
    console.log(`migration ทั้งหมด ${files.length} ไฟล์ · รันแล้ว ${applied.size} · รอรัน ${pending.length}\n`);

    if (statusOnly) {
      for (const f of files) {
        console.log(`  ${applied.has(f) ? '✅' : '⬜'}  ${f}`);
      }
      return;
    }

    if (pending.length === 0) {
      console.log('ไม่มี migration ที่ต้องรัน');
      return;
    }

    for (const filename of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');

      process.stdout.write(`  กำลังรัน ${filename} ... `);

      // ไม่ครอบด้วย transaction เพราะ MySQL ทำ DDL (CREATE TABLE) แบบ
      // implicit commit อยู่แล้ว ครอบไปก็ rollback ไม่ได้จริง
      // ถ้าไฟล์ไหนพังกลางคัน ต้องแก้ด้วยมือ — จึงควรเขียน migration ให้เล็ก
      await conn.query(sql);
      await conn.query('INSERT INTO schema_migrations (filename) VALUES (?)', [filename]);

      console.log('เสร็จ');
    }

    console.log(`\nรัน migration สำเร็จ ${pending.length} ไฟล์`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('\nmigration ล้มเหลว:', err.message);
  process.exit(1);
});