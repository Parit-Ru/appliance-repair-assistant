import { Router } from 'express';
import type { RequestHandler } from 'express';
import { asyncRoute } from '../common/error-handler';
import { parseFeedbackQuery, parseSummaryQuery } from './admin.dto';
import type { AdminService } from './admin.service';

export function adminRoutes(admin: AdminService, requireAuth: RequestHandler, requireAdmin: RequestHandler): Router {
  const router = Router();

  // GET /admin/feedback?helpful=true|false&from=YYYY-MM-DD&to=YYYY-MM-DD&page=&pageSize= 
  router.get('/feedback',requireAuth,requireAdmin,asyncRoute(async (request, response) => {
      response.json(await admin.feedback(parseFeedbackQuery(request.query)));
    }),
  );

  // GET /admin/analytics/summary?days=1..90 
  router.get('/analytics/summary',requireAuth,requireAdmin,asyncRoute(async (request, response) => {
      response.json(await admin.summary(parseSummaryQuery(request.query)));
    }),
  );

  return router;
}
