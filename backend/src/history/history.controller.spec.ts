/**
 * ทดสอบ HistoryModule ผ่าน HTTP จริง (NestFactory + fetch) ด้วย pool ปลอมที่ตอบว่า "ไม่มีข้อมูล"
 *
 * จุดประสงค์: พิสูจน์ว่า DI ต่อกันครบ (HistoryModule ← GraphModule ← MYSQL_POOL), route/หัวข้อ/status code
 * และ filter ทำงานตามที่ตกลง — ตรรกะของรายการ/รายละเอียดทดสอบแล้วใน history.service.spec.ts
 */

import { Global, Module } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { AddressInfo } from 'node:net';

import { MYSQL_POOL } from '../database/database.constants';
import { HistoryModule } from './history.module';

const CLIENT = '33333333-3333-4333-8333-333333333333';
const SESSION = '44444444-4444-4444-8444-444444444444';

/** ทุก SELECT ได้ผลว่าง · DELETE ได้ affectedRows 0 → "ไม่พบ" */
const emptyPool = {
  query: async (sql: string): Promise<unknown[]> =>
    /^\s*DELETE/i.test(sql) ? [{ affectedRows: 0 }] : [[]],
};

@Global()
@Module({
  providers: [{ provide: MYSQL_POOL, useValue: emptyPool }],
  exports: [MYSQL_POOL],
})
class FakeDatabaseModule {}

@Module({ imports: [FakeDatabaseModule, HistoryModule] })
class TestAppModule {}

describe('HistoryController (HTTP)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    app = await NestFactory.create(TestAppModule, { logger: false });
    // ตัวเลือกเดียวกับ main.ts (ไม่ได้ตั้ง allowedHeaders) เพื่อพิสูจน์ว่าหัวข้อ X-Client-Id ผ่าน preflight ได้โดยไม่ต้องแก้ main.ts
    app.enableCors({ origin: 'http://localhost:5173', credentials: true });
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  function call(path: string, init: RequestInit & { client?: string | null } = {}) {
    const { client = CLIENT, headers, ...rest } = init;
    return fetch(`${baseUrl}${path}`, {
      ...rest,
      headers: {
        ...(client === null ? {} : { 'X-Client-Id': client }),
        ...(rest.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(headers as Record<string, string> | undefined),
      },
    });
  }

  it('CORS preflight: อนุญาตหัวข้อ X-Client-Id และเมธอด DELETE จาก origin ของหน้าเว็บ', async () => {
    const response = await fetch(`${baseUrl}/history/${SESSION}`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'DELETE',
        'Access-Control-Request-Headers': 'x-client-id,content-type',
      },
    });

    expect(response.status).toBeLessThan(300);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(response.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('x-client-id');
    expect(response.headers.get('access-control-allow-methods')).toContain('DELETE');
  });

  it('GET /history ไม่มีประวัติ: 200 รายการว่าง', async () => {
    const response = await call('/history');

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ items: [], total: 0, page: 1, totalPages: 1 });
  });

  it('ไม่ส่ง X-Client-Id: 400 INVALID_CLIENT_ID ทุก endpoint', async () => {
    const responses = await Promise.all([
      call('/history', { client: null }),
      call(`/history/${SESSION}`, { client: null }),
      call(`/history/${SESSION}`, { client: null, method: 'DELETE' }),
      call(`/history/${SESSION}/feedback`, { client: null, method: 'POST', body: JSON.stringify({ helpful: true }) }),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: 'INVALID_CLIENT_ID' });
    }
  });

  it('X-Client-Id ไม่ใช่ UUID: 400 INVALID_CLIENT_ID', async () => {
    const response = await call('/history', { client: 'not-a-uuid' });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'INVALID_CLIENT_ID' });
  });

  it('query ผิด: 400 INVALID_HISTORY_QUERY', async () => {
    const response = await call('/history?status=done&page=0');

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'INVALID_HISTORY_QUERY' });
  });

  it('GET /history/:id ที่ไม่ใช่ของ client นี้/ไม่มี: 404 HISTORY_NOT_FOUND (ไม่ใช่ 403)', async () => {
    const response = await call(`/history/${SESSION}`);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ statusCode: 404, code: 'HISTORY_NOT_FOUND' });
  });

  it('DELETE /history/:id ที่ไม่ใช่ของ client นี้/ไม่มี: 404', async () => {
    const response = await call(`/history/${SESSION}`, { method: 'DELETE' });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'HISTORY_NOT_FOUND' });
  });

  it('POST /history/:id/feedback: body ผิด 400 INVALID_FEEDBACK · body ถูกแต่ไม่ใช่ของ client 404', async () => {
    const bad = await call(`/history/${SESSION}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ helpful: 'yes' }),
    });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ code: 'INVALID_FEEDBACK' });

    // comment ยาวเกิน 500 → 400 (ตรวจก่อนถึงฐานข้อมูล)
    const tooLong = await call(`/history/${SESSION}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ helpful: true, comment: 'ก'.repeat(501) }),
    });
    expect(tooLong.status).toBe(400);
    expect(await tooLong.json()).toMatchObject({ code: 'INVALID_FEEDBACK' });

    const notMine = await call(`/history/${SESSION}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ helpful: true, comment: 'ดี' }),
    });
    expect(notMine.status).toBe(404);
  });
});
