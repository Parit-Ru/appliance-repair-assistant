import { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import { asyncRoute } from '../common/error-handler';

export function healthRoutes(pool: Pool): Router {
  const router = Router();

  router.get('/',asyncRoute(async (_request, response) => {
      let database: 'ok' | 'error' = 'ok';
      let databaseError: string | undefined;
      try {
        await pool.query('SELECT 1');
      } catch (err) {
        database = 'error';
        databaseError = (err as Error).message;
      }

      response.json({
        status: database === 'ok' ? 'ok' : 'degraded',
        service: 'appliance-repair-backend',
        database,
        ...(databaseError ? { databaseError } : {}),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV ?? 'development',
      });
    }),
  );

  return router;
}
