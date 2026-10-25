import { X509Certificate } from 'crypto';
import * as mysql from 'mysql2/promise';
import { createLogger } from '../common/logger';

const logger = createLogger('Database');

function normalizePem(value: string): string {
  return value
    .trim()
    .replace(/^DB_SSL_CA\s*=\s*/, '')
    .replace(/^["']|["']$/g, '')
    .replace(/\\n/g, '\n')
    .trim();
}

function describeCa(pem: string): string {
  try {
    const cert = new X509Certificate(pem);
    return `อ่านใบรับรอง CA ได้ (CA=${cert.ca}, หมดอายุ ${cert.validTo})`;
  } catch {
    return 'อ่านเป็นใบรับรองไม่ได้ — ตรวจค่า DB_SSL_CA ต้องขึ้นต้น -----BEGIN CERTIFICATE----- และลงท้าย -----END CERTIFICATE-----';
  }
}

function buildPoolOptions(): mysql.PoolOptions {
  const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_NAME'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`ไม่พบค่าใน .env: ${missing.join(', ')} — คัดลอก backend/.env.example เป็น backend/.env ก่อน`);
  }

  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME,

    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    ssl: process.env.DB_SSL_CA ? { ca: normalizePem(process.env.DB_SSL_CA) } : undefined,
  };
}

// สร้าง pool แล้วลองต่อหนึ่งครั้ง (ต่อไม่ได้ = โยน error ให้บูตล้ม) 
export async function createDbPool(): Promise<mysql.Pool> {
  const options = buildPoolOptions();
  logger.log(
    process.env.DB_SSL_CA
      ? `DB_SSL_CA: ${describeCa(normalizePem(process.env.DB_SSL_CA))}`
      : 'DB_SSL_CA: ไม่ได้ตั้งค่า (เชื่อมต่อแบบไม่ใช้ SSL)',
  );

  const pool = mysql.createPool(options);
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    logger.log(`เชื่อมต่อ MySQL สำเร็จ: ${options.database} ที่ ${options.host}:${options.port}`);
  } catch (err) {
    logger.error(`เชื่อมต่อ MySQL ไม่สำเร็จ: ${(err as Error).message}`);
    throw err;
  }
  return pool;
}
