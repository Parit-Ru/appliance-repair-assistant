import { Router } from 'express';
import type { RequestHandler } from 'express';
import { asyncRoute } from '../common/error-handler';
import { parseFeedbackQuery, parseSummaryQuery } from './admin.dto';
import type { AdminService } from './admin.service';

// router ครอบทุกอย่างใต้ /admin: ด่านสิทธิ์ใส่ครั้งเดียวที่นี่ก่อน route ทุกตัว route ใหม่ที่ mount ผ่าน callback จึงถูกป้องกันโดยอัตโนมัติ
// (path ใต้ /admin ที่ไม่มีจริงจะได้ 401/403 แทน 404 เมื่อยังไม่ผ่านด่าน)
export function adminArea(requireAuth: RequestHandler, requireAdmin: RequestHandler, mount: (router: Router) => void): Router {
  const router = Router();
  router.use(requireAuth, requireAdmin);
  mount(router);
  return router;
}

export function adminRoutes(admin: AdminService): Router {
  const router = Router();

  // GET /admin/feedback?helpful=true|false&from=YYYY-MM-DD&to=YYYY-MM-DD&page=&pageSize= 
  router.get('/feedback',asyncRoute(async (request, response) => {
      response.json(await admin.feedback(parseFeedbackQuery(request.query)));
    }),
  );

  // GET /admin/analytics/summary?days=1..90 
  router.get('/analytics/summary',asyncRoute(async (request, response) => {
      response.json(await admin.summary(parseSummaryQuery(request.query)));
    }),
  );

  return router;
}
