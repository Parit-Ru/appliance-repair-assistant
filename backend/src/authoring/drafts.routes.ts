/*
  drafts.routes.ts — endpoint ของผู้ดูแลระบบสำหรับ "อัปโหลด PDF → ร่างผัง → ตรวจ → เผยแพร่" (ใต้ /admin/drafts)

    POST /admin/drafts                  multipart: file (PDF) + manualId, deviceCategory, brand, modelPattern, sourceManual,
                                        displayName?, pageFrom, pageTo → 202 { id, status: 'drafting' }
    GET  /admin/drafts                  รายการร่าง (ล่าสุด 100)
    GET  /admin/drafts/:id              รายละเอียด: ผังร่าง + ข้อความหน้าต้นฉบับ + รายงาน validator + ความคืบหน้า
    PUT  /admin/drafts/:id              { flows } แก้ผัง (เฉพาะ ready) ตรวจใหม่ทุกครั้ง
    POST /admin/drafts/:id/reject       { reason? }
    POST /admin/drafts/:id/publish      { acknowledgedWarnings? } error ≥ 1 = 409 DRAFT_INVALID · warning ≥ 1 ไม่มี flag = 409

 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import multer = require('multer');
import { currentUser } from '../auth/auth.middleware';
import { asyncRoute } from '../common/error-handler';
import { parsePublishBody, parseRejectBody, parseUpdateBody, parseUploadFields } from './drafts.dto';
import type { DraftsService } from './drafts.service';

const DEFAULT_MAX_PDF_MB = 10;
function maxPdfBytes(env: NodeJS.ProcessEnv = process.env): number {
  const mb = Number(env.AUTHORING_MAX_PDF_MB);
  return Math.max(1, Math.floor((Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_MAX_PDF_MB) * 1024 * 1024));
}

const BAD_UPLOAD_MESSAGES = new Set([
  'Too many parts',
  'Too many files',
  'Field name too long',
  'Field value too long',
  'Too many fields',
  'Unexpected field',
  'Field name missing',
  'Multipart: Boundary not found',
  'Malformed part header',
  'Unexpected end of form',
  'Unexpected end of file',
]);


function uploadPdf(): RequestHandler {
  const receive = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxPdfBytes(), files: 1, fields: 12, fieldSize: 1024 },
  }).single('file');

  return (request, response, next) => {
    receive(request, response, (err?: unknown) => {
      if (!err) {
        next();
        return;
      }
      const message = err instanceof Error ? err.message : '';
      if (message === 'File too large') {
        response.status(413).json({ statusCode: 413, code: 'PDF_TOO_LARGE', message: 'ไฟล์ใหญ่เกินที่รองรับ' });
        return;
      }
      if (BAD_UPLOAD_MESSAGES.has(message)) {
        response.status(400).json({
          statusCode: 400,
          code: 'INVALID_DRAFT_REQUEST',
          message: 'คำขออัปโหลดไม่ถูกต้อง (ส่งไฟล์เดียวในฟิลด์ชื่อ file และฟิลด์ข้อความตามที่กำหนด)',
        });
        return;
      }
      next(err);
    });
  };
}

export function draftsRoutes(drafts: DraftsService): Router {
  const router = Router();

  router.post('/',uploadPdf(),asyncRoute(async (request, response) => {
      const fields = parseUploadFields(request.body);
      const { id } = await drafts.createFromUpload(request.file, fields, currentUser(request)!.sub);
      response.status(202).json({ id, status: 'drafting' });
    }),
  );

  router.get('/',asyncRoute(async (_request, response) => {
      response.json(await drafts.list());
    }),
  );

  router.get('/:id',asyncRoute(async (request, response) => {
      response.json(await drafts.get(request.params.id));
    }),
  );

  router.put('/:id',asyncRoute(async (request, response) => {
      response.json(await drafts.update(request.params.id, parseUpdateBody(request.body).flows));
    }),
  );

  router.post('/:id/reject',asyncRoute(async (request, response) => {
      const { reason } = parseRejectBody(request.body);
      response.status(200).json(await drafts.reject(request.params.id, currentUser(request)!.sub, reason));
    }),
  );

  router.post('/:id/publish',asyncRoute(async (request, response) => {
      const { acknowledgedWarnings } = parsePublishBody(request.body);
      response.status(200).json(await drafts.publish(request.params.id, currentUser(request)!.sub, acknowledgedWarnings));
    }),
  );

  return router;
}
