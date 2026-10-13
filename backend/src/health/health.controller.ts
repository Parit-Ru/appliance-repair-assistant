import { Controller, Get, Inject } from '@nestjs/common';
import type { Pool } from 'mysql2/promise';

import { MYSQL_POOL } from '../database/database.constants';

@Controller('health')
export class HealthController {
  /**
   * ขอยืม connection pool จาก DatabaseModule
   *
   * ไม่ได้ import DatabaseModule ในไฟล์ health.module.ts เลย
   * แต่ขอได้เพราะ DatabaseModule ประกาศตัวเองเป็น @Global()
   */
  constructor(@Inject(MYSQL_POOL) private readonly pool: Pool) {}

  @Get()
  async check() {
    // ยิงคำสั่งง่ายที่สุดที่พิสูจน์ว่าฐานข้อมูลตอบสนองอยู่
    // ใช้ SELECT 1 แทนการนับแถวจริง เพราะเบากว่าและไม่ผูกกับตารางใดตาราง
    let database: 'ok' | 'error' = 'ok';
    let databaseError: string | undefined;

    try {
      await this.pool.query('SELECT 1');
    } catch (err) {
      database = 'error';
      databaseError = (err as Error).message;
    }

    return {
      status: database === 'ok' ? 'ok' : 'degraded',
      service: 'appliance-repair-backend',
      database,
      ...(databaseError ? { databaseError } : {}),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV ?? 'development',
    };
  }
}