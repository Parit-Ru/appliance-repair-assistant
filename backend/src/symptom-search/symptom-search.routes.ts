import { Router } from 'express';
import { asyncRoute } from '../common/error-handler';
import { parseSearchBody } from './symptom-search.dto';
import type { SymptomSearchService } from './symptom-search.service';

export function symptomSearchRoutes(searchService: SymptomSearchService): Router {
  const router = Router();

  router.post('/',asyncRoute(async (request, response) => {
      const { query, manualId } = parseSearchBody(request.body);
      response.status(200).json(await searchService.search(query, manualId));
    }),
  );

  router.get('/status', (_request, response) => {
    response.json(searchService.getStatus());
  });

  return router;
}
