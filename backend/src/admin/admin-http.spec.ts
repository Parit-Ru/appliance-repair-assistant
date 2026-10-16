/**
 * admin-http.spec.ts — ยิง HTTP จริงผ่าน pipeline ของ Nest (guard → pipe → controller → exception filter)
 *
 * ประกอบ AdminController + AdminService + AdminStore + JwtAuthGuard + RolesGuard "ตัวจริง"
 * ปลอมเฉพาะฐานข้อมูล (pool ในหน่วยความจำ) และ GraphRepository — จึงจับกรณีลืม @UseFilters (401/403 กลายเป็น 500)
 * หรือลืม @Roles ได้จริง ซึ่งการเรียกฟังก์ชันตรงๆ จับไม่ได้
 * ไม่ใช้ supertest/@nestjs/testing: ใช้ NestFactory + fetch ของ Node (ไม่ต้องติดตั้งแพ็กเกจเพิ่ม)
 *
 * pool จำลองคืน "แถวที่มีช่องอันตรายปนมาด้วย" (email, password_hash, client_id, user_id, display_name)
 * เพื่อพิสูจน์ว่าต่อให้ชั้นล่างคืนช่องเกินมา response ก็ไม่หลุดออกไป
 */

import { INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { sign } from 'jsonwebtoken';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role } from '../auth/role.enum';
import { RolesGuard } from '../auth/roles.guard';
import { MYSQL_POOL } from '../database/database.constants';
import { GraphRepository } from '../traversal/graph.repository';
import { AdminController } from './admin.controller';
import { thaiDayIndex } from './admin.dto';
import { AdminService } from './admin.service';
import { AdminStore } from './admin.store';

const SECRET = 'test-secret-test-secret-test-secret-123456';
const FIXED_NOW = Date.UTC(2026, 9, 16, 5, 0, 0) / 1000; // 16 ต.ค. 2026 12:00 เวลาไทย

/** ช่องอันตรายที่ต้องไม่หลุดออก response */
const POISON = {
  email: 'leak@example.com',
  password_hash: '$2a$10$hashleakhashleak',
  client_id: 'CLIENTLEAK-1111',
  user_id: 'USERLEAK-2222',
  display_name: 'NAMELEAK',
};
const POISON_PATTERN = /leak@example|\$2a\$|hashleak|CLIENTLEAK|USERLEAK|NAMELEAK|password_hash|"email"|@/;

class FakePool {
  calls: Array<{ sql: string; params: unknown[] }> = [];

  async query(rawSql: string, params: unknown[] = []): Promise<[unknown, undefined]> {
    const sql = rawSql.replace(/\s+/g, ' ').trim();
    this.calls.push({ sql, params });
    return [this.rowsFor(sql), undefined];
  }

  private rowsFor(sql: string): unknown[] {
    if (sql.includes('GROUP BY day_idx')) {
      return [{ day_idx: thaiDayIndex(FIXED_NOW), started: '2', completed: '1', ...POISON }];
    }
    if (sql.includes('GROUP BY graph_id, current_node_id')) {
      return [
        { graph_id: 'graph-1', current_node_id: 'end', n: '2', ...POISON },
        { graph_id: 'graph-gone', current_node_id: 'x', n: '1' },
      ];
    }
    if (sql.includes('GROUP BY graph_id')) {
      return [
        { graph_id: 'graph-1', n: '4', ...POISON },
        { graph_id: 'graph-gone', n: '1' },
      ];
    }
    if (sql.includes('AS avg_confidence')) {
      return [
        {
          total: '5', completed: '3', in_progress: '1', expired_unfinished: '1',
          by_user: '1', by_guest: '2', by_none: '2', avg_confidence: '0.71234', confidence_samples: '4', ...POISON,
        },
      ];
    }
    if (sql.includes('FROM session_feedback f')) {
      if (sql.includes('COUNT(*) AS total')) return [{ total: '1' }];
      return [
        {
          session_id: 's-1', helpful: 1, comment: 'ใช้ได้ดี', created_epoch: FIXED_NOW, updated_epoch: FIXED_NOW,
          graph_id: 'graph-1', owner_type: 'user', ...POISON,
        },
      ];
    }
    if (sql.includes('FROM session_feedback')) {
      return [{ total: '4', helpful_count: '3' }];
    }
    if (sql.includes('FROM sessions s')) {
      if (sql.includes('COUNT(*) AS total')) return [{ total: '1' }];
      return [
        {
          session_id: 's-2', graph_id: 'graph-1', current_node_id: 'end', status: 'completed', expired: 0,
          confidence: '0.812', model_selection: 'selected', created_epoch: FIXED_NOW, has_feedback: 1,
          owner_type: 'guest', ...POISON,
        },
      ];
    }
    throw new Error(`FakePool ไม่รองรับ: ${sql}`);
  }
}

const fakeGraphs = {
  findById: (graphId: string) =>
    graphId === 'graph-1'
      ? {
          graph_id: 'graph-1',
          device_category: 'Microwave',
          brand: 'Samsung',
          entry_symptom_th: 'ไม่ร้อน',
          nodes: [{ node_id: 'end', type: 'resolution', outcome_kind: 'user_fixed' }],
        }
      : undefined,
};

const pool = new FakePool();

@Module({
  imports: [JwtModule.register({ secret: SECRET, signOptions: { algorithm: 'HS256', expiresIn: '1h' } })],
  controllers: [AdminController],
  providers: [
    { provide: MYSQL_POOL, useValue: pool },
    { provide: GraphRepository, useValue: fakeGraphs },
    AdminStore,
    AdminService,
    JwtAuthGuard,
    RolesGuard,
  ],
})
class TestModule {}

let app: INestApplication;
let baseUrl: string;

beforeAll(async () => {
  app = await NestFactory.create(TestModule, { logger: false });
  app.get(AdminService).nowEpoch = () => FIXED_NOW;
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address() as { port: number };
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  pool.calls = [];
});

const adminToken = sign({ sub: 'admin-1', role: Role.Admin }, SECRET, { algorithm: 'HS256', expiresIn: '1h' });
const userToken = sign({ sub: 'user-1', role: Role.User }, SECRET, { algorithm: 'HS256', expiresIn: '1h' });
const expiredToken = sign(
  { sub: 'admin-1', role: Role.Admin, exp: Math.floor(Date.now() / 1000) - 60 },
  SECRET,
  { algorithm: 'HS256' },
);
const wrongSecretToken = sign({ sub: 'admin-1', role: Role.Admin }, 'another-secret-another-secret-another-1', {
  algorithm: 'HS256',
  expiresIn: '1h',
});
const unknownRoleToken = sign({ sub: 'admin-1', role: 'root' }, SECRET, { algorithm: 'HS256', expiresIn: '1h' });

async function get(path: string, token?: string, scheme = 'Bearer') {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: token === undefined ? {} : { Authorization: `${scheme} ${token}` },
  });
  const text = await response.text();
  let json: Record<string, unknown> | undefined;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: response.status, text, json };
}

const ENDPOINTS = ['/admin/feedback', '/admin/analytics/summary', '/admin/sessions'];

function expectErrorShape(json: Record<string, unknown> | undefined, statusCode: number, code: string) {
  expect(json).toBeDefined();
  expect(Object.keys(json!).sort()).toEqual(['code', 'message', 'statusCode']);
  expect(json).toMatchObject({ statusCode, code });
  expect(typeof json!.message).toBe('string');
  expect((json!.message as string).length).toBeGreaterThan(0);
}

describe.each(ENDPOINTS)('%s', (path) => {
  it('(1) ไม่มี token → 401 UNAUTHENTICATED รูปแบบ {statusCode, code, message} และไม่แตะฐานข้อมูล', async () => {
    const result = await get(path);
    expect(result.status).toBe(401);
    expectErrorShape(result.json, 401, 'UNAUTHENTICATED');
    expect(pool.calls).toHaveLength(0);
  });

  it('(2) token ของ user ธรรมดา → 403 FORBIDDEN (ไม่ใช่ 500) และไม่แตะฐานข้อมูล', async () => {
    const result = await get(path, userToken);
    expect(result.status).toBe(403);
    expectErrorShape(result.json, 403, 'FORBIDDEN');
    expect(pool.calls).toHaveLength(0);
  });

  it('(3) token ของ admin → 200', async () => {
    const result = await get(path, adminToken);
    expect(result.status).toBe(200);
    expect(result.json).toBeDefined();
    expect(pool.calls.length).toBeGreaterThan(0);
  });

  it.each([
    ['หมดอายุ', expiredToken, 'Bearer'],
    ['เซ็นด้วยกุญแจอื่น', wrongSecretToken, 'Bearer'],
    ['ข้อความมั่ว', 'abc.def.ghi', 'Bearer'],
    ['role ที่ไม่รู้จักใน payload', unknownRoleToken, 'Bearer'],
    ['ไม่ใช่ scheme Bearer', adminToken, 'Basic'],
  ])('(4) token %s → 401 UNAUTHENTICATED รูปแบบเดียวกัน', async (_name, token, scheme) => {
    const result = await get(path, token, scheme);
    expect(result.status).toBe(401);
    expectErrorShape(result.json, 401, 'UNAUTHENTICATED');
    expect(pool.calls).toHaveLength(0);
  });

  it('สิทธิ์ถูกตรวจก่อน query: user ธรรมดาส่ง query ผิดก็ได้ 403 ไม่ใช่ 400 (ไม่เผยว่า parser ทำงานอย่างไร)', async () => {
    const result = await get(`${path}?pageSize=9999&days=0`, userToken);
    expect(result.status).toBe(403);
  });

  it('(6) response ของ admin ไม่มี email / password_hash / id ของเจ้าของ แม้ชั้นล่างคืนช่องเหล่านั้นมา', async () => {
    const result = await get(path, adminToken);
    expect(result.status).toBe(200);
    expect(result.text).not.toMatch(POISON_PATTERN);
  });
});

describe('รูปร่างของ 200', () => {
  it('GET /admin/feedback', async () => {
    const { json } = await get('/admin/feedback', adminToken);
    expect(json).toEqual({
      items: [
        {
          sessionId: 's-1',
          helpful: true,
          comment: 'ใช้ได้ดี',
          createdAt: new Date(FIXED_NOW * 1000).toISOString(),
          updatedAt: new Date(FIXED_NOW * 1000).toISOString(),
          graphId: 'graph-1',
          deviceCategory: 'Microwave',
          brand: 'Samsung',
          ownerType: 'user',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
  });

  it('GET /admin/sessions', async () => {
    const { json } = await get('/admin/sessions', adminToken);
    expect(json).toEqual({
      items: [
        {
          sessionId: 's-2',
          graphId: 'graph-1',
          deviceCategory: 'Microwave',
          brand: 'Samsung',
          status: 'completed',
          expired: false,
          confidence: 0.812,
          modelSelection: 'selected',
          outcomeKind: 'user_fixed',
          hasFeedback: true,
          ownerType: 'guest',
          createdAt: new Date(FIXED_NOW * 1000).toISOString(),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
  });

  it('GET /admin/analytics/summary — ช่วง 30 วัน เวลาไทย อัตราความพอใจ ผังที่หายไป และวันที่ไม่มีข้อมูลเป็น 0', async () => {
    const { json } = await get('/admin/analytics/summary', adminToken);
    const summary = json as any;

    expect(summary.window).toEqual({ days: 30, from: '2026-09-17', to: '2026-10-16' });
    expect(summary.sessions).toEqual({
      total: 5, completed: 3, inProgress: 1, expiredUnfinished: 1, byOwner: { user: 1, guest: 2, none: 2 },
    });
    expect(summary.feedback).toEqual({ total: 4, helpful: 3, notHelpful: 1, satisfactionRate: 0.75 });
    expect(summary.confidence).toEqual({ average: 0.712, sampleSize: 4 });
    expect(summary.outcomes).toEqual({
      user_fixed: 2, normal_behavior: 0, handoff_informed: 0, handoff_unknown: 0, unknown: 1,
    });
    expect(summary.topGraphs).toEqual([
      { graphId: 'graph-1', entrySymptomTh: 'ไม่ร้อน', count: 4 },
      { graphId: 'graph-gone', entrySymptomTh: null, count: 1 },
    ]);
    expect(summary.topDevices).toEqual([
      { deviceCategory: 'Microwave', count: 4 },
      { deviceCategory: 'unknown', count: 1 },
    ]);
    expect(summary.perDay).toHaveLength(30);
    expect(summary.perDay[0]).toEqual({ date: '2026-09-17', started: 0, completed: 0 });
    expect(summary.perDay[29]).toEqual({ date: '2026-10-16', started: 2, completed: 1 });
  });

  it('days=7 ใช้ช่วงเดียวกันทุกส่วน (window และ perDay 7 วัน และ epoch ที่ส่ง SQL ตรงกันทุกคำสั่ง)', async () => {
    const { json } = await get('/admin/analytics/summary?days=7', adminToken);
    const summary = json as any;
    expect(summary.window).toEqual({ days: 7, from: '2026-10-10', to: '2026-10-16' });
    expect(summary.perDay).toHaveLength(7);

    const windows = pool.calls.map((call) => call.params.slice(0, 2).join('..'));
    expect(new Set(windows).size).toBe(1);
  });
});

describe('(5) เพดาน pagination และ input ผิด → 400 INVALID_ADMIN_QUERY', () => {
  it.each([
    '/admin/feedback?pageSize=101',
    '/admin/feedback?pageSize=0',
    '/admin/feedback?page=0',
    '/admin/feedback?page=abc',
    '/admin/feedback?page=1&page=2',
    '/admin/feedback?helpful=maybe',
    '/admin/feedback?from=2026-13-40',
    '/admin/feedback?from=2026-10-05&to=2026-10-01',
    '/admin/feedback?from=2024-01-01&to=2026-01-01',
    '/admin/sessions?pageSize=1000',
    '/admin/sessions?status=abandoned',
    '/admin/sessions?ownerType=admin',
    `/admin/sessions?graphId=${'x'.repeat(121)}`,
    '/admin/sessions?to=not-a-date',
    '/admin/analytics/summary?days=0',
    '/admin/analytics/summary?days=91',
    '/admin/analytics/summary?days=abc',
  ])('%s', async (path) => {
    const result = await get(path, adminToken);
    expect(result.status).toBe(400);
    expectErrorShape(result.json, 400, 'INVALID_ADMIN_QUERY');
    expect(pool.calls).toHaveLength(0);
  });

  it('pageSize=100 (เพดานพอดี) ผ่าน และส่ง LIMIT/OFFSET เป็นพารามิเตอร์', async () => {
    const result = await get('/admin/sessions?pageSize=100&page=3', adminToken);
    expect(result.status).toBe(200);
    const listCall = pool.calls.find((call) => call.sql.includes('LIMIT ? OFFSET ?'))!;
    expect(listCall.params.slice(-2)).toEqual([100, 200]);
  });

  it('ตัวกรองไปถึง SQL เป็นพารามิเตอร์ ไม่ถูกต่อเป็นข้อความ', async () => {
    const injection = "g' OR '1'='1";
    const result = await get(
      `/admin/sessions?graphId=${encodeURIComponent(injection)}&status=completed&ownerType=guest&from=2026-10-01&to=2026-10-02`,
      adminToken,
    );
    expect(result.status).toBe(200);
    for (const call of pool.calls) {
      expect(call.sql).not.toContain(injection);
    }
    const countCall = pool.calls.find((call) => call.sql.includes('COUNT(*) AS total'))!;
    expect(countCall.params).toEqual([
      'completed',
      injection,
      Date.UTC(2026, 9, 1) / 1000 - 7 * 3600,
      Date.UTC(2026, 9, 3) / 1000 - 7 * 3600,
    ]);
  });
});

describe('ความเป็นส่วนตัวและการอ่านอย่างเดียวในระดับ SQL', () => {
  it('ทุกคำสั่ง SQL ของ 3 endpoint: SELECT เท่านั้น ไม่แตะ users และไม่ดึง email/password_hash/display_name/user_id/client_id', async () => {
    for (const path of ENDPOINTS) {
      await get(`${path}?ownerType=user`, adminToken);
      await get(path, adminToken);
    }
    expect(pool.calls.length).toBeGreaterThan(5);

    for (const { sql } of pool.calls) {
      expect(sql).toMatch(/^SELECT /);
      expect(sql).not.toMatch(/password_hash|email|display_name/i);
      expect(sql).not.toMatch(/\bFROM users\b|\bJOIN users\b/i);
      expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP|TRUNCATE)\b/i);
      // user_id / client_id ใช้ได้เฉพาะตรวจว่าเป็น NULL หรือไม่ (ชนิดเจ้าของ) ไม่ SELECT ค่าออกมา
      expect(sql).not.toMatch(/\b(user_id|client_id)\b(?! IS (NOT )?NULL)/);
    }
  });

  it('ไม่มี /admin/users (ตัดสินใจไม่ทำ)', async () => {
    const result = await get('/admin/users', adminToken);
    expect(result.status).toBe(404);
  });
});
