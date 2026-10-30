import express = require('express');
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../app';
import { createAuthMiddleware } from '../auth/auth.middleware';
import { Role } from '../auth/role.enum';
import { TokenService } from '../auth/token';
import { errorHandler, notFoundHandler } from '../common/error-handler';
import { adminArea, adminRoutes } from './admin.routes';
import type { AdminService } from './admin.service';

// pool ปลอมสำหรับเทสต์ createApp(): ทุกคำสั่ง SQL ได้ผลว่าง (ผังว่าง อุปกรณ์ว่าง ไม่มี user) ไม่ต่อ DB จริง
jest.mock('../database/pool', () => ({
  createDbPool: async () => ({ query: async () => [[], []] }),
}));

/** ทดสอบด่านสิทธิ์ของ /admin ผ่าน HTTP จริง (ไม่ใช้ DB จริง: role ปัจจุบันมาจาก Map ปลอม) */
const tokens = TokenService.fromEnv({ JWT_SECRET: 'a'.repeat(40) } as NodeJS.ProcessEnv);

const rolesInDb = new Map<string, Role>();
let lookupError: Error | undefined;
const users = {
  async findById(id: string) {
    if (lookupError) throw lookupError;
    const role = rolesInDb.get(id);
    return role === undefined ? undefined : { role };
  },
};

const fakeAdminService = {
  feedback: async () => ({ items: [] }),
  summary: async () => ({ ok: true }),
} as unknown as AdminService;

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const { requireAuth, requireAdmin } = createAuthMiddleware(tokens, users);
  const app = express();
  app.use(express.json());
  app.use(
    '/admin',
    adminArea(requireAuth, requireAdmin, (router) => {
      router.use(adminRoutes(fakeAdminService));
      // route ใหม่ที่ "ลืม" ใส่ middleware เอง: ต้องถูกป้องกันด้วยด่านของ /admin
      router.get('/brand-new', (_request, response) => {
        response.json({ secret: true });
      });
      router.use('/nested', express.Router().get('/thing', (_request, response) => {
        response.json({ secret: true });
      }));
    }),
  );
  app.use(notFoundHandler);
  app.use(errorHandler);

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  rolesInDb.clear();
  lookupError = undefined;
});

const tokenFor = (id: string, role: Role) => tokens.sign({ sub: id, role });

async function get(path: string, token?: string): Promise<Response> {
  return fetch(`${baseUrl}${path}`, { headers: token === undefined ? {} : { authorization: `Bearer ${token}` } });
}

describe('ด่านสิทธิ์ /admin', () => {
  it('ไม่มี token → 401', async () => {
    expect((await get('/admin/analytics/summary')).status).toBe(401);
    expect((await get('/admin/feedback')).status).toBe(401);
  });

  it('token ของ user ธรรมดา → 403', async () => {
    rolesInDb.set('u1', Role.User);
    const response = await get('/admin/analytics/summary', tokenFor('u1', Role.User));
    expect(response.status).toBe(403);
  });

  it('token ของ admin ที่ยังเป็น admin ใน DB → ผ่าน', async () => {
    rolesInDb.set('a1', Role.Admin);
    const response = await get('/admin/analytics/summary', tokenFor('a1', Role.Admin));
    expect(response.status).toBe(200);
  });

  it('JWT บอก admin แต่ DB ถอด role แล้ว (token ยังไม่หมดอายุ) → 403', async () => {
    rolesInDb.set('a2', Role.User);
    const response = await get('/admin/analytics/summary', tokenFor('a2', Role.Admin));
    expect(response.status).toBe(403);
  });

  it('JWT บอก admin แต่ไม่พบ user ใน DB แล้ว → 403', async () => {
    const response = await get('/admin/feedback', tokenFor('ghost', Role.Admin));
    expect(response.status).toBe(403);
  });

  it('DB ล้มระหว่างตรวจ role → ไม่ผ่าน (500 ไม่ใช่ 200)', async () => {
    rolesInDb.set('a3', Role.Admin);
    lookupError = new Error('db down');
    const response = await get('/admin/analytics/summary', tokenFor('a3', Role.Admin));
    expect(response.status).toBe(500);
  });

  it('route ใหม่ใต้ /admin ที่ไม่ได้ใส่ middleware เอง → ไม่มี token ได้ 401', async () => {
    expect((await get('/admin/brand-new')).status).toBe(401);
    expect((await get('/admin/nested/thing')).status).toBe(401);
  });

  it('route ใหม่ใต้ /admin → user ธรรมดา 403, admin ผ่าน', async () => {
    rolesInDb.set('u1', Role.User);
    rolesInDb.set('a1', Role.Admin);
    expect((await get('/admin/brand-new', tokenFor('u1', Role.User))).status).toBe(403);
    expect((await get('/admin/brand-new', tokenFor('a1', Role.Admin))).status).toBe(200);
    expect((await get('/admin/nested/thing', tokenFor('a1', Role.Admin))).status).toBe(200);
  });

  it('path ใต้ /admin ที่ไม่มีจริง และไม่มี token → 401 (ไม่รั่วว่า path มีหรือไม่)', async () => {
    expect((await get('/admin/does-not-exist')).status).toBe(401);
  });
});

describe('ด่านสิทธิ์ /admin ใน createApp() จริง', () => {
  const ENV_KEYS = ['JWT_SECRET', 'SYMPTOM_SEARCH_ENABLED', 'GROQ_API_KEY', 'AUTHORING_LLM_MODEL', 'REPHRASE_ENABLED'] as const;
  const savedEnv = new Map<string, string | undefined>();
  let appServer: Server;
  let appUrl: string;

  beforeAll(async () => {
    for (const key of ENV_KEYS) savedEnv.set(key, process.env[key]);
    process.env.JWT_SECRET = 'b'.repeat(40);
    // ไม่โหลดโมเดล embedding และไม่ต่อ LLM ระหว่างเทสต์
    for (const key of ['SYMPTOM_SEARCH_ENABLED', 'GROQ_API_KEY', 'AUTHORING_LLM_MODEL', 'REPHRASE_ENABLED'] as const) delete process.env[key];

    const app = await createApp();
    await new Promise<void>((resolve) => {
      appServer = app.listen(0, '127.0.0.1', resolve);
    });
    appUrl = `http://127.0.0.1:${(appServer.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => appServer.close(() => resolve()));
    for (const key of ENV_KEYS) {
      const value = savedEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('ไม่มี token → 401 ทั้ง /admin/drafts, /admin/feedback และ /admin/analytics/summary', async () => {
    for (const path of ['/admin/drafts', '/admin/feedback', '/admin/analytics/summary']) {
      const response = await fetch(`${appUrl}${path}`);
      expect({ path, status: response.status }).toEqual({ path, status: 401 });
    }
  });
});
