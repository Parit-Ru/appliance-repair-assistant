import { X509Certificate } from 'crypto';
import { Global, Module, Logger, OnApplicationShutdown, Inject } from '@nestjs/common';
import * as mysql from 'mysql2/promise';

import { MYSQL_POOL } from './database.constants';

/**
 * แปลงค่า DB_SSL_CA ให้เป็น PEM ที่ Node อ่านได้
 * ค่าที่วางใน Render ไม่ผ่าน dotenv จึงไม่มีใครตัดให้ ต้องตัดเองสองอย่างที่พลาดบ่อย:
 *   - ทั้งบรรทัดของ .env ติดมา (DB_SSL_CA="...")  - เครื่องหมายคำพูดที่ห่อค่าไว้
 * และแปลง \n ที่เป็นตัวอักษรให้เป็นขึ้นบรรทัดใหม่จริง
 */
function normalizePem(value: string): string {
  return value
    .trim()
    .replace(/^DB_SSL_CA\s*=\s*/, '')
    .replace(/^["']|["']$/g, '')
    .replace(/\\n/g, '\n')
    .trim();
}

/** อ่านใบรับรองเพื่อรายงานใน log (ไม่พิมพ์เนื้อใบรับรอง) — ถ้าอ่านไม่ได้ Node จะไม่ฟ้องทันที แต่ไปฟ้องตอนต่อ MySQL ว่า self-signed certificate */
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
  const missing: string[] = [];
  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    const message = `ไม่พบค่าใน .env: ${missing.join(', ')} — คัดลอก backend/.env.example เป็น backend/.env ก่อน`;
    throw new Error(message);
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
    ssl: process.env.DB_SSL_CA
      ? { ca: normalizePem(process.env.DB_SSL_CA) }
      : undefined,
  };
}
@Global()
@Module({
  providers: [
    {
      provide: MYSQL_POOL,
      useFactory: async (): Promise<mysql.Pool> => {
        const logger = new Logger('DatabaseModule');
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
      },
    },
  ],
  exports: [MYSQL_POOL],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(MYSQL_POOL) private readonly pool: mysql.Pool) {}
  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
    new Logger('DatabaseModule').log('ปิดการเชื่อมต่อ MySQL แล้ว');
  }
}