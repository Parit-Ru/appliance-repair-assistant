import { Router } from 'express';
import type { RequestHandler } from 'express';
import { currentUser } from '../auth/auth.middleware';
import { resolveRequiredOwner } from '../auth/session-owner';
import { asyncRoute } from '../common/error-handler';
import { parseFeedbackBody, parseHistoryQuery } from './history.dto';
import type { HistoryService } from './history.service';

export function historyRoutes(history: HistoryService, optionalAuth: RequestHandler): Router {
  const router = Router();

  // GET /history?page=&pageSize= 
  router.get('/',optionalAuth,asyncRoute(async (request, response) => {
      const owner = resolveRequiredOwner(currentUser(request), request.headers['x-client-id']);
      response.json(await history.list(owner, parseHistoryQuery(request.query)));
    }),
  );

  // GET /history/:id 
  router.get('/:id',optionalAuth,asyncRoute(async (request, response) => {
      const owner = resolveRequiredOwner(currentUser(request), request.headers['x-client-id']);
      response.json(await history.detail(owner, request.params.id));
    }),
  );

  // POST /history/:id/feedback — body: { helpful: boolean, comment?: string } 
  router.post('/:id/feedback',optionalAuth,asyncRoute(async (request, response) => {
      const owner = resolveRequiredOwner(currentUser(request), request.headers['x-client-id']);
      response.status(200).json(await history.saveFeedback(owner, request.params.id, parseFeedbackBody(request.body)));
    }),
  );

  // DELETE /history/:id 
  router.delete('/:id',optionalAuth,asyncRoute(async (request, response) => {
      const owner = resolveRequiredOwner(currentUser(request), request.headers['x-client-id']);
      await history.remove(owner, request.params.id);
      response.status(204).end();
    }),
  );

  return router;
}
