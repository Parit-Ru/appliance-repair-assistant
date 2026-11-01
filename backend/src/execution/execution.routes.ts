import { Router } from 'express';
import type { RequestHandler } from 'express';
import { currentUser } from '../auth/auth.middleware';
import { resolveOptionalOwner, resolveRequiredOwner } from '../auth/session-owner';
import { asyncRoute } from '../common/error-handler';
import { parseOptionalManualId, parseOutcomeBody, parseStartSessionBody, parseExecutionAction } from './execution.dto';
import type { ExecutionService } from './execution.service';

export function executionRoutes(execution: ExecutionService, optionalAuth: RequestHandler): Router {
  const router = Router();

  router.get('/flows', (request, response) => {
    response.json(execution.listFlows(parseOptionalManualId(request.query.manualId)));
  });

  router.get('/manuals', (_request, response) => {
    response.json(execution.listManuals());
  });

  router.post('/sessions',optionalAuth,asyncRoute(async (request, response) => {
      const { flowId, query, manualId, modelSelection } = parseStartSessionBody(request.body);
      const owner = resolveOptionalOwner(currentUser(request), request.headers['x-client-id']);
      response.status(201).json(await execution.startSession(flowId, query, manualId, modelSelection, owner));
    }),
  );

  router.get('/sessions/:id',optionalAuth,asyncRoute(async (request, response) => {
      response.json(await execution.getSession(request.params.id, currentUser(request)?.sub));
    }),
  );

  router.post('/sessions/:id/actions',optionalAuth,asyncRoute(async (request, response) => {
      const action = parseExecutionAction(request.body);
      response.status(201).json(await execution.submitAction(request.params.id, action, currentUser(request)?.sub));
    }),
  );

  router.post('/sessions/:id/outcome',optionalAuth,asyncRoute(async (request, response) => {
      const { text } = parseOutcomeBody(request.body);
      response.status(200).json(await execution.submitOutcome(request.params.id, text, currentUser(request)?.sub));
    }),
  );

  router.delete('/sessions/:id',optionalAuth,asyncRoute(async (request, response) => {
      const owner = resolveRequiredOwner(currentUser(request), request.headers['x-client-id']);
      await execution.abandonSession(request.params.id, owner);
      response.status(204).end();
    }),
  );

  return router;
}
