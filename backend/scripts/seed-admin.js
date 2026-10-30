// seed-admin.js — สร้างบัญชี admin คนแรก (ทางเดียวที่สร้าง admin ได้; /auth/register สร้างได้แต่ user)
//
// อ่านจาก backend/.env:
//   ADMIN_EMAIL          (บังคับ)
//   ADMIN_PASSWORD       (บังคับ ยาว 8-72 ตัวอักษร และไม่เกิน 72 ไบต์ เหมือนกฎตอนสมัคร)
//   ADMIN_DISPLAY_NAME   (ไม่บังคับ ค่าเริ่มต้น "Admin")
//
// รันซ้ำได้ปลอดภัย (idempotent):
//   - ยังไม่มีอีเมลนี้            → สร้างบัญชี admin ใหม่
//   - มีอยู่แล้วเป็น user         → ยกเป็น admin "โดยไม่เปลี่ยนรหัสผ่าน"
//   - มีอยู่แล้วเป็น admin        → ไม่ทำอะไร
// ไม่พิมพ์รหัสผ่านออกหน้าจอ · ไม่มีข้อมูลล็อกอินในโค้ด
//
// รัน: npm run seed:admin   (ต้องรัน npm run migrate ให้ถึง 010 ก่อน)

require('dotenv/config');

const crypto = require('node:crypto');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

/** ต้องเท่ากับ BCRYPT_ROUNDS ใน src/auth/auth.service.ts */
const BCRYPT_ROUNDS = 10;

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;
const MAX_PASSWORD_BYTES = 72;
const MAX_EMAIL_LENGTH = 255;
const MAX_DISPLAY_NAME_LENGTH = 100;
/** ให้เหมือน EMAIL_PATTERN ใน src/auth/auth.dto.ts */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

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
    ssl: process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : undefined,
  };
}

function readAdminInput() {
  const problems = [];

  const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  if (email === '') {
    problems.push('ไม่พบ ADMIN_EMAIL ใน .env');
  } else if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    problems.push('ADMIN_EMAIL ไม่ถูกรูปแบบอีเมล');
  }

  const password = process.env.ADMIN_PASSWORD ?? '';
  if (password === '') {
    problems.push('ไม่พบ ADMIN_PASSWORD ใน .env');
  } else if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    problems.push(`ADMIN_PASSWORD ต้องยาว ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} ตัวอักษร`);
  } else if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    problems.push(`ADMIN_PASSWORD เกิน ${MAX_PASSWORD_BYTES} ไบต์ (bcrypt จะตัดส่วนท้ายทิ้ง) ให้สั้นลงหรือใช้อักษรอังกฤษ`);
  }

  const displayName = (process.env.ADMIN_DISPLAY_NAME ?? '').trim() || 'Admin';
  if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    problems.push(`ADMIN_DISPLAY_NAME ยาวเกิน ${MAX_DISPLAY_NAME_LENGTH} ตัวอักษร`);
  }

  if (problems.length > 0) {
    throw new Error(`ค่าใน .env ไม่ครบ/ไม่ถูกต้อง:\n  - ${problems.join('\n  - ')}`);
  }
  return { email, password, displayName };
}

async function main() {
  const { email, password, displayName } = readAdminInput();

  const conn = await mysql.createConnection(connectionConfig());
  try {
    const [rows] = await conn.query('SELECT id, role FROM users WHERE email = ? LIMIT 1', [email]);

    if (rows.length === 0) {
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      await conn.query(
        `INSERT INTO users (id, email, password_hash, display_name, role)
         VALUES (?, ?, ?, ?, 'admin')`,
        [crypto.randomUUID(), email, passwordHash, displayName],
      );
      console.log(`สร้างบัญชี admin แล้ว: ${email}`);
      return;
    }

    const existing = rows[0];
    if (existing.role === 'admin') {
      console.log(`${email} เป็น admin อยู่แล้ว — ไม่ทำอะไร`);
      return;
    }

    await conn.query("UPDATE users SET role = 'admin' WHERE id = ?", [existing.id]);
    console.log(`ยก ${email} เป็น admin แล้ว (ไม่เปลี่ยนรหัสผ่านเดิม)`);
    console.log('หมายเหตุ: token ที่ออกไปก่อนหน้านี้ยังมี role เป็น user จนกว่าจะหมดอายุ — ให้ล็อกอินใหม่');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('\nseed admin ล้มเหลว:', err.message);
  process.exit(1);
});
