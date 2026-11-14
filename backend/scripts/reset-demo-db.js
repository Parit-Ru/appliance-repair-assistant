// รีเซ็ตฐานข้อมูลสำหรับ live demo: ลบฐานทิ้ง -> สร้างใหม่ -> migrate -> seed admin
// ใช้: node scripts/reset-demo-db.js
// ตัวกันพลาด: ทำงานเฉพาะ DB_HOST เป็นเครื่องตัวเอง และ DB_NAME มีคำว่า "demo" เท่านั้น
require('dotenv/config');

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const mysql = require('mysql2/promise');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function assertSafe() {
  const missing = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_NAME'].filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`ไม่พบค่าใน .env: ${missing.join(', ')}`);
  }
  if (!LOCAL_HOSTS.has(process.env.DB_HOST)) {
    throw new Error(`ปฏิเสธ: DB_HOST=${process.env.DB_HOST} ไม่ใช่เครื่องตัวเอง (สคริปต์นี้ลบฐานทิ้ง)`);
  }
  if (!/demo/i.test(process.env.DB_NAME)) {
    throw new Error(`ปฏิเสธ: DB_NAME="${process.env.DB_NAME}" ต้องมีคำว่า demo (กันลบฐานจริง)`);
  }
  if (!/^[A-Za-z0-9_]+$/.test(process.env.DB_NAME)) {
    throw new Error('DB_NAME ใช้ได้เฉพาะ A-Z a-z 0-9 _');
  }
}

function runNpmScript(name) {
  console.log(`\n> npm run ${name}`);
  const result = spawnSync('npm', ['run', name], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    throw new Error(`npm run ${name} ล้มเหลว`);
  }
}

async function main() {
  assertSafe();
  const db = process.env.DB_NAME;

  // เชื่อมต่อโดยไม่ระบุฐาน เพราะฐานอาจยังไม่มี
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? '',
  });

  try {
    console.log(`ลบและสร้างฐาน ${db} ที่ ${process.env.DB_HOST}:${process.env.DB_PORT}`);
    await conn.query(`DROP DATABASE IF EXISTS \`${db}\``);
    await conn.query(
      `CREATE DATABASE \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await conn.end();
  }

  runNpmScript('migrate');
  runNpmScript('seed:admin');

  console.log(`\nเสร็จ: ฐาน ${db} ว่างเปล่า มีแค่โครงตารางกับบัญชี admin`);
  console.log('ถัดไป: npm run build && npm start (backend) · npm run dev (frontend)');
}

main().catch((err) => {
  console.error('\nรีเซ็ตล้มเหลว:', err.message);
  process.exit(1);
});
