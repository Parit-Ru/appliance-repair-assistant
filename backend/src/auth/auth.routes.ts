import { Router } from 'express';
import type { RequestHandler } from 'express';
import { asyncRoute } from '../common/error-handler';
import { currentUser } from './auth.middleware';
import { parseLoginBody, parseRegisterBody } from './auth.dto';
import type { AuthService } from './auth.service';

export function authRoutes(auth: AuthService, requireAuth: RequestHandler): Router {
  const router = Router();

  router.post('/register',asyncRoute(async (request, response) => {
      response.status(201).json(await auth.register(parseRegisterBody(request.body)));
    }),
  );

  router.post('/login',asyncRoute(async (request, response) => {
      response.status(200).json(await auth.login(parseLoginBody(request.body)));
    }),
  );

  router.get('/me',requireAuth,asyncRoute(async (request, response) => {
      response.json(await auth.me(currentUser(request)!.sub));
    }),
  );

  return router;
}
