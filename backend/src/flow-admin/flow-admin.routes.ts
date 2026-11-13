/*
  flow-admin.routes.ts — admin management of published flows (under /admin/flows)

    GET  /admin/flows        ?q=&manualId=&deviceCategory=&status=active|deleted|all&page=&pageSize=
    GET  /admin/flows/:id    flow detail with usage counts
    DELETE /admin/flows/:id          soft delete → 204 (sessions, history and feedback are kept; 409 FLOW_ALREADY_DELETED)
    POST /admin/flows/:id/restore    undo the delete → 200 { detail, searchIndex } (409 FLOW_NOT_DELETED)
    PUT  /admin/flows/:id    { expectedRevision, states: [{ state_id, question|prompt|content, safety_warning? }] }
                             edits the text of existing states only; 409 FLOW_EDIT_CONFLICT when expectedRevision is stale
    PUT  /admin/flows/:id/structure   { expectedRevision, acknowledgedWarnings?, initial_state, states: [full state objects as GET returns] }
                             replaces states and edges → 200 { detail, changed }
                             409 FLOW_STRUCTURE_INVALID | FLOW_STRUCTURE_WARNINGS_UNACKNOWLEDGED | FLOW_STATE_IN_USE | FLOW_EDIT_CONFLICT
 */

import { Router } from 'express';
import { asyncRoute } from '../common/error-handler';
import { currentUser } from '../auth/auth.middleware';
import { parseListQuery, parseStructureBody, parseUpdateBody } from './flow-admin.dto';
import type { FlowAdminService } from './flow-admin.service';

export function flowAdminRoutes(flowAdmin: FlowAdminService): Router {
  const router = Router();

  router.get('/', asyncRoute(async (request, response) => {
    response.json(await flowAdmin.list(parseListQuery(request.query)));
  }));

  router.get('/:id', asyncRoute(async (request, response) => {
    response.json(await flowAdmin.get(request.params.id));
  }));

  router.put('/:id', asyncRoute(async (request, response) => {
    const body = parseUpdateBody(request.body);
    response.json(await flowAdmin.updateStates(request.params.id, currentUser(request)!.sub, body));
  }));

  router.put('/:id/structure', asyncRoute(async (request, response) => {
    const body = parseStructureBody(request.body);
    response.json(await flowAdmin.updateStructure(request.params.id, currentUser(request)!.sub, body));
  }));

  router.delete('/:id', asyncRoute(async (request, response) => {
    await flowAdmin.remove(request.params.id, currentUser(request)!.sub);
    response.status(204).end();
  }));

  router.post('/:id/restore', asyncRoute(async (request, response) => {
    response.json(await flowAdmin.restore(request.params.id, currentUser(request)!.sub));
  }));

  return router;
}
