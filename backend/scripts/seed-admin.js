require('dotenv/config');

const crypto = require('node:crypto');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 10;

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;
const MAX_PASSWORD_BYTES = 72;
const MAX_EMAIL_LENGTH = 255;
const MAX_DISPLAY_NAME_LENGTH = 100;

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

// Runs before any database connection, so a missing name creates nothing.
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

  // No default: every admin needs their own name because flows record who edited or deleted them.
  const displayName = (process.env.ADMIN_DISPLAY_NAME ?? '').trim();
  if (displayName === '') {
    problems.push('ไม่พบ ADMIN_DISPLAY_NAME ใน .env (ต้องระบุชื่อที่แสดง และห้ามซ้ำกับ admin คนอื่น)');
  } else if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    problems.push(`ADMIN_DISPLAY_NAME ยาวเกิน ${MAX_DISPLAY_NAME_LENGTH} ตัวอักษร`);
  }

  if (problems.length > 0) {
    throw new Error(`ค่าใน .env ไม่ครบ/ไม่ถูกต้อง:\n  - ${problems.join('\n  - ')}`);
  }
  return { email, password, displayName };
}

// Returns true when another admin already uses this name.
// The comparison follows the column collation (utf8mb4_unicode_ci), so "Admin" and "admin" count as the same name.
async function adminNameTaken(conn, displayName, exceptUserId) {
  const [rows] = await conn.query(
    "SELECT id FROM users WHERE role = 'admin' AND display_name = ? AND id <> ? LIMIT 1",
    [displayName, exceptUserId ?? ''],
  );
  return rows.length > 0;
}

async function main() {
  const { email, password, displayName } = readAdminInput();

  const conn = await mysql.createConnection(connectionConfig());
  try {
    const [rows] = await conn.query(
      'SELECT id, role, display_name FROM users WHERE email = ? LIMIT 1',
      [email],
    );

    if (rows.length === 0) {
      if (await adminNameTaken(conn, displayName)) {
        throw new Error(`ชื่อ "${displayName}" ถูกใช้โดย admin คนอื่นแล้ว ตั้ง ADMIN_DISPLAY_NAME เป็นชื่ออื่น`);
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      await conn.query(
        `INSERT INTO users (id, email, password_hash, display_name, role)
         VALUES (?, ?, ?, ?, 'admin')`,
        [crypto.randomUUID(), email, passwordHash, displayName],
      );
      console.log(`สร้างบัญชี admin แล้ว: ${email} (ชื่อที่แสดง: ${displayName})`);
      return;
    }

    // The name of an existing account is never changed by this script.
    const existing = rows[0];
    const sameName = existing.display_name.toLowerCase() === displayName.toLowerCase();

    if (existing.role === 'admin') {
      console.log(`${email} เป็น admin อยู่แล้ว — ไม่ทำอะไร`);
      if (!sameName) {
        console.log(`หมายเหตุ: ชื่อที่แสดงของบัญชีนี้คือ "${existing.display_name}" ไม่เปลี่ยนตาม ADMIN_DISPLAY_NAME`);
      }
      return;
    }

    // Promoting a user also creates an admin, so the unique-name rule applies with the account's current name.
    if (await adminNameTaken(conn, existing.display_name, existing.id)) {
      throw new Error(
        `ชื่อที่แสดงของบัญชีนี้ ("${existing.display_name}") ซ้ำกับ admin คนอื่น ` +
          'สคริปต์นี้ไม่เปลี่ยนชื่อให้ ให้แก้ชื่อในตาราง users ด้วย SQL ก่อนแล้วรันใหม่',
      );
    }

    await conn.query("UPDATE users SET role = 'admin' WHERE id = ?", [existing.id]);
    console.log(`ยก ${email} เป็น admin แล้ว (ไม่เปลี่ยนรหัสผ่านและชื่อที่แสดง "${existing.display_name}")`);
    console.log('หมายเหตุ: token ที่ออกไปก่อนหน้านี้ยังมี role เป็น user จนกว่าจะหมดอายุ — ให้ล็อกอินใหม่');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('\nseed admin ล้มเหลว:', err.message);
  process.exit(1);
});
