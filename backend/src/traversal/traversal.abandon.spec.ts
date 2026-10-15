/**
 * ทดสอบ DELETE /traversal/sessions/:id ผ่าน HTTP จริง (NestFactory + fetch) ด้วย pool ปลอมในหน่วยความจำ
 *
 * จุดประสงค์: พิสูจน์ว่าลบได้เฉพาะเจ้าของ (client_id ตรงกับตอนเริ่ม session) — ไม่ต่อฐานข้อมูลจริง
 * pool ปลอมทำตามเงื่อนไข WHERE ที่ "เขียนอยู่ใน SQL จริง" เท่านั้น (เหมือน history.service.spec.ts)
 * ถ้า SQL ใน session.store.ts ลืม `client_id = ?` เทสต์ "ไม่ใช่เจ้าของ" จะล้มทันที
 *
 * ส่วนอื่นของ TraversalService (ผัง, อุปกรณ์, ค้นหาอาการ, rephrase) ไม่ถูกเรียกในเส้นทางนี้ จึงใส่ stub ว่าง
 * ไม่โหลดโมเดล embedding และไม่ผ่าน DatabaseModule ตัวจริง (ที่ต้องใช้ DB_HOST ฯลฯ)
 */

import { Global, Module } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { AddressInfo } from 'node:net';

import { MYSQL_POOL } from '../database/database.constants';
import { RephraseService } from '../rephrase/rephrase.service';
import { SymptomSearchService } from '../symptom-search/symptom-search.service';
import type { SessionStatus } from '../traversal-engine/types';
import { EquipmentRepository } from './equipment.repository';
import { GraphRepository } from './graph.repository';
import { SessionStore } from './session.store';
import { TraversalController } from './traversal.controller';
import { TraversalService } from './traversal.service';

const OWNER = '11111111-1111-4111-8111-111111111111';
const STRANGER = '22222222-2222-4222-8222-222222222222';
const SESSION = '33333333-3333-4333-8333-333333333333';
const UNKNOWN_SESSION = '44444444-4444-4444-8444-444444444444';

// ============================================================
// pool ปลอม: ตาราง sessions ในหน่วยความจำ
// ============================================================

interface FakeSession {
  clientId: string | null;
  status: SessionStatus;
  expired: boolean;
}

interface Executed {
  sql: string;
  params: unknown[];
}

class FakePool {
  readonly sessions = new Map<string, FakeSession>();
  readonly deletes: Executed[] = [];

  reset(): void {
    this.sessions.clear();
    this.deletes.length = 0;
  }

  seed(sessionId: string, session: Partial<FakeSession> = {}): void {
    this.sessions.set(sessionId, { clientId: OWNER, status: 'in_progress', expired: false, ...session });
  }

  async query(sql: string, params: unknown[] = []): Promise<unknown[]> {
    if (!/^\s*DELETE\s+FROM\s+sessions\b/i.test(sql)) {
      // เส้นทางนี้ไม่ควรมี SELECT/UPDATE ใดๆ (ตรวจ+ลบในคำสั่งเดียว) · ตอบว่างไว้เฉยๆ
      return [[]];
    }
    this.deletes.push({ sql, params });

    const sessionId = String(params[0]);
    const row = this.sessions.get(sessionId);
    if (!row) return [{ affectedRows: 0 }];

    // ทำตามเงื่อนไขที่ปรากฏใน SQL เท่านั้น
    const needsOwner = /client_id\s*=\s*\?/i.test(sql);
    const needsFresh = /expires_at\s*>\s*NOW\(\)/i.test(sql);
    if (needsOwner && row.clientId !== params[1]) return [{ affectedRows: 0 }]; // NULL = x ไม่เป็นจริงใน SQL
    if (needsFresh && row.expired) return [{ affectedRows: 0 }];

    this.sessions.delete(sessionId);
    return [{ affectedRows: 1 }];
  }
}

const pool = new FakePool();

@Global()
@Module({
  providers: [{ provide: MYSQL_POOL, useValue: pool }],
  exports: [MYSQL_POOL],
})
class FakeDatabaseModule {}

@Module({
  imports: [FakeDatabaseModule],
  controllers: [TraversalController],
  providers: [
    SessionStore,
    TraversalService,
    { provide: GraphRepository, useValue: {} },
    { provide: EquipmentRepository, useValue: {} },
    { provide: SymptomSearchService, useValue: {} },
    { provide: RephraseService, useValue: {} },
  ],
})
class TestAppModule {}

// ============================================================

describe('DELETE /traversal/sessions/:id (ตรวจเจ้าของ)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    app = await NestFactory.create(TestAppModule, { logger: false });
    // ตัวเลือกเดียวกับ main.ts (ไม่ได้ตั้ง allowedHeaders)
    app.enableCors({ origin: 'http://localhost:5173', credentials: true });
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    pool.reset();
  });

  function remove(sessionId: string, client: string | null = OWNER) {
    return fetch(`${baseUrl}/traversal/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: client === null ? {} : { 'X-Client-Id': client },
    });
  }

  it('เจ้าของลบ session ที่ยังเดินอยู่ได้: 204 ไม่มี body และแถวหายไป', async () => {
    pool.seed(SESSION, { status: 'in_progress' });

    const response = await remove(SESSION);

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(pool.sessions.has(SESSION)).toBe(false);
  });

  it('เจ้าของลบ session ที่จบแล้วได้เหมือนเดิม (ไม่จำกัดสถานะ)', async () => {
    pool.seed(SESSION, { status: 'completed' });

    const response = await remove(SESSION);

    expect(response.status).toBe(204);
    expect(pool.sessions.has(SESSION)).toBe(false);
  });

  it('คำสั่ง SQL ที่ใช้ระบุทั้ง session_id และ client_id ตามลำดับพารามิเตอร์ (กันตรวจเจ้าของหลุดตอนแก้ภายหลัง)', async () => {
    pool.seed(SESSION);

    await remove(SESSION);

    expect(pool.deletes).toHaveLength(1);
    const [{ sql, params }] = pool.deletes;
    expect(sql).toMatch(/session_id\s*=\s*\?/i);
    expect(sql).toMatch(/client_id\s*=\s*\?/i);
    expect(params).toEqual([SESSION, OWNER]);
  });

  it('ไม่ใช่เจ้าของ: 404 SESSION_NOT_FOUND และแถวยังอยู่ครบ (ไม่ใช่ 403)', async () => {
    pool.seed(SESSION, { clientId: OWNER });

    const response = await remove(SESSION, STRANGER);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ statusCode: 404, code: 'SESSION_NOT_FOUND' });
    expect(pool.sessions.get(SESSION)).toMatchObject({ clientId: OWNER });
  });

  it('ไม่ใช่เจ้าของ ตอบเหมือน session ที่ไม่มีอยู่จริง (ไม่เปิดเผยว่ามี session นี้)', async () => {
    pool.seed(SESSION, { clientId: OWNER });

    const notMine = await remove(SESSION, STRANGER);
    const missing = await remove(UNKNOWN_SESSION, STRANGER);

    expect(notMine.status).toBe(missing.status);
    const a = (await notMine.json()) as { statusCode: number; code: string };
    const b = (await missing.json()) as { statusCode: number; code: string };
    expect({ statusCode: a.statusCode, code: a.code }).toEqual({ statusCode: b.statusCode, code: b.code });
  });

  it('session ที่ไม่มีเจ้าของ (client_id เป็น NULL): ใครก็ลบผ่าน API ไม่ได้ → 404', async () => {
    pool.seed(SESSION, { clientId: null });

    const response = await remove(SESSION, OWNER);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'SESSION_NOT_FOUND' });
    expect(pool.sessions.has(SESSION)).toBe(true);
  });

  it('session ของเจ้าของที่หมดอายุแล้ว: 404 เหมือน session ที่ไม่มี (ตรงกับ find ที่กรอง expires_at)', async () => {
    pool.seed(SESSION, { expired: true });

    const response = await remove(SESSION);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'SESSION_NOT_FOUND' });
  });

  it('ยกเลิกซ้ำครั้งที่สอง: 404 ไม่ใช่ 204 เงียบๆ (พฤติกรรมเดิม)', async () => {
    pool.seed(SESSION);

    const first = await remove(SESSION);
    const second = await remove(SESSION);

    expect(first.status).toBe(204);
    expect(second.status).toBe(404);
    expect(await second.json()).toMatchObject({ code: 'SESSION_NOT_FOUND' });
  });

  it('ไม่ส่ง X-Client-Id: 400 INVALID_CLIENT_ID และไม่มีการลบใดๆ', async () => {
    pool.seed(SESSION);

    const response = await remove(SESSION, null);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ statusCode: 400, code: 'INVALID_CLIENT_ID' });
    expect(pool.deletes).toHaveLength(0);
    expect(pool.sessions.has(SESSION)).toBe(true);
  });

  it('X-Client-Id ไม่ใช่ UUID: 400 INVALID_CLIENT_ID และไม่มีการลบใดๆ', async () => {
    pool.seed(SESSION);

    const response = await remove(SESSION, 'not-a-uuid');

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'INVALID_CLIENT_ID' });
    expect(pool.deletes).toHaveLength(0);
    expect(pool.sessions.has(SESSION)).toBe(true);
  });

  it('X-Client-Id ตัวพิมพ์ใหญ่: แปลงเป็นตัวพิมพ์เล็กก่อนเทียบ (เหมือนตอนเริ่ม session) จึงยังเป็นเจ้าของ', async () => {
    pool.seed(SESSION);

    const response = await remove(SESSION, OWNER.toUpperCase());

    expect(response.status).toBe(204);
    expect(pool.sessions.has(SESSION)).toBe(false);
  });

  it('CORS preflight: DELETE พร้อมหัวข้อ X-Client-Id ผ่านจาก origin ของหน้าเว็บ', async () => {
    const response = await fetch(`${baseUrl}/traversal/sessions/${SESSION}`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'DELETE',
        'Access-Control-Request-Headers': 'x-client-id',
      },
    });

    expect(response.status).toBeLessThan(300);
    expect(response.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('x-client-id');
    expect(response.headers.get('access-control-allow-methods')).toContain('DELETE');
  });
});
