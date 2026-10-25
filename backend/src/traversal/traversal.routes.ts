import { Router } from 'express';
import type { RequestHandler } from 'express';
import { currentUser } from '../auth/auth.middleware';
import { resolveOptionalOwner, resolveRequiredOwner } from '../auth/session-owner';
import { asyncRoute } from '../common/error-handler';
import { parseOptionalManualId, parseOutcomeBody, parseStartSessionBody, parseTraversalAction } from './traversal.dto';
import type { TraversalService } from './traversal.service';

export function traversalRoutes(traversal: TraversalService, optionalAuth: RequestHandler): Router {
  const router = Router();

  router.get('/graphs', (request, response) => {
    response.json(traversal.listGraphs(parseOptionalManualId(request.query.manualId)));
  });

  router.get('/manuals', (_request, response) => {
    response.json(traversal.listManuals());
  });

  router.post('/sessions',optionalAuth,asyncRoute(async (request, response) => {
      const { graphId, query, manualId, modelSelection } = parseStartSessionBody(request.body);
      const owner = resolveOptionalOwner(currentUser(request), request.headers['x-client-id']);
      response.status(201).json(await traversal.startSession(graphId, query, manualId, modelSelection, owner));
    }),
  );

  router.get('/sessions/:id',optionalAuth,asyncRoute(async (request, response) => {
      response.json(await traversal.getSession(request.params.id, currentUser(request)?.sub));
    }),
  );

  router.post('/sessions/:id/actions',optionalAuth,asyncRoute(async (request, response) => {
      const action = parseTraversalAction(request.body);
      response.status(201).json(await traversal.submitAction(request.params.id, action, currentUser(request)?.sub));
    }),
  );

  router.post('/sessions/:id/outcome',optionalAuth,asyncRoute(async (request, response) => {
      const { text } = parseOutcomeBody(request.body);
      response.status(200).json(await traversal.submitOutcome(request.params.id, text, currentUser(request)?.sub));
    }),
  );

  router.delete('/sessions/:id',optionalAuth,asyncRoute(async (request, response) => {
      const owner = resolveRequiredOwner(currentUser(request), request.headers['x-client-id']);
      await traversal.abandonSession(request.params.id, owner);
      response.status(204).end();
    }),
  );

  return router;
}
