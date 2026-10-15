require('dotenv/config');

const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

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
    charset: 'utf8mb4',
    multipleStatements: true,

    ssl: process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : undefined,
  };
}

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

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

async function main() {
  // PowerShell 5.1 ตัด "--" ใน `npm run migrate -- --status` แล้ว npm ส่ง --status มาเป็นตัวแปร npm_config_status แทน
  // ถ้าตรวจแค่ argv จะกลายเป็นรัน migration จริง
  const statusOnly =
    process.argv.includes('--status') || process.env.npm_config_status === 'true';
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