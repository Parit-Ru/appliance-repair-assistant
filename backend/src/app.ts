import cors = require('cors');
import express = require('express');
import { adminArea, adminRoutes } from './admin/admin.routes';
import { AdminService } from './admin/admin.service';
import { AdminStore } from './admin/admin.store';
import { createAuthMiddleware } from './auth/auth.middleware';
import { authRoutes } from './auth/auth.routes';
import { AuthService } from './auth/auth.service';
import { TokenService } from './auth/token';
import { UsersStore } from './auth/users.store';
import { createDraftLlmFromEnv } from './authoring/draft-llm.client';
import { draftsRoutes } from './authoring/drafts.routes';
import { DraftsService } from './authoring/drafts.service';
import { DraftsStore } from './authoring/drafts.store';
import { UnpdfTextExtractor } from './authoring/pdf-text';
import { errorHandler, notFoundHandler } from './common/error-handler';
import { createLogger } from './common/logger';
import { createDbPool } from './database/pool';
import { EmbeddingService } from './embedding/embedding.service';
import { healthRoutes } from './health/health.routes';
import { historyRoutes } from './history/history.routes';
import { HistoryService } from './history/history.service';
import { HistoryStore } from './history/history.store';
import { createGroqClientFromEnv } from './rephrase/groq-llm.client';
import { RephraseService } from './rephrase/rephrase.service';
import { symptomSearchRoutes } from './symptom-search/symptom-search.routes';
import { SymptomSearchService } from './symptom-search/symptom-search.service';
import { EquipmentRepository } from './execution/equipment.repository';
import { FlowRepository } from './execution/flow.repository';
import { SessionStore } from './execution/session.store';
import { executionRoutes } from './execution/execution.routes';
import { ExecutionService } from './execution/execution.service';

function createRephraseService(): RephraseService {
  const client = createGroqClientFromEnv();
  if (!client && process.env.REPHRASE_ENABLED === 'true') {
    createLogger('RephraseService').warn('REPHRASE_ENABLED=true แต่ตั้ง GROQ_API_KEY/GROQ_MODEL ไม่ครบ — ใช้ข้อความต้นฉบับ');
  }
  return new RephraseService(client, {
    enabled: client !== null,
    timeoutMs: Number(process.env.REPHRASE_TIMEOUT_MS) || 3000,
  });
}

export async function createApp(): Promise<express.Express> {
  const tokens = TokenService.fromEnv();
  const pool = await createDbPool();

  const flows = new FlowRepository(pool);
  const equipment = new EquipmentRepository(pool);
  const symptomSearch = new SymptomSearchService(new EmbeddingService(), flows);
  const execution = new ExecutionService(flows, equipment, new SessionStore(pool), symptomSearch, createRephraseService());
  const users = new UsersStore(pool);
  const auth = new AuthService(users, tokens);
  const history = new HistoryService(new HistoryStore(pool), flows);
  const admin = new AdminService(new AdminStore(pool), flows);
  const drafts = new DraftsService(new DraftsStore(pool), flows, symptomSearch, new UnpdfTextExtractor(), createDraftLlmFromEnv());

  await flows.load(); 
  await equipment.load();
  symptomSearch.start();
  await drafts.failInterruptedDrafts();

  const { optionalAuth, requireAuth, requireAdmin } = createAuthMiddleware(tokens, users);
  const app = express();

  app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173', credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/health', healthRoutes(pool));
  app.use('/auth', authRoutes(auth, requireAuth));
  app.use('/symptom-search', symptomSearchRoutes(symptomSearch));
  app.use('/execution', executionRoutes(execution, optionalAuth));
  app.use('/history', historyRoutes(history, optionalAuth));
  app.use('/admin', adminArea(requireAuth, requireAdmin, (router) => {
    router.use(adminRoutes(admin));
    router.use('/drafts', draftsRoutes(drafts));
  }));

  app.use(notFoundHandler); 
  app.use(errorHandler);

  return app;
}
