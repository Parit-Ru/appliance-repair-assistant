/**
 * drafts.controller.ts — endpoint ของผู้ดูแลระบบสำหรับ "อัปโหลด PDF → ร่างผัง → ตรวจ → เผยแพร่"
 *
 *   POST /admin/drafts                  multipart: file (PDF) + manualId, deviceCategory, brand, modelPattern, sourceManual,
 *                                       displayName?, pageFrom, pageTo → 202 { id, status: 'drafting' }
 *   GET  /admin/drafts                  รายการร่าง (ล่าสุด 100)
 *   GET  /admin/drafts/:id              รายละเอียด: ผังร่าง + ข้อความหน้าต้นฉบับ + รายงาน validator + ความคืบหน้า
 *   PUT  /admin/drafts/:id              { graphs } แก้ผัง (เฉพาะ ready) ตรวจใหม่ทุกครั้ง
 *   POST /admin/drafts/:id/retry        ร่างที่ failed ลองใหม่ → 202
 *   POST /admin/drafts/:id/reject       { reason? }
 *   POST /admin/drafts/:id/publish      { acknowledgedWarnings? } error ≥ 1 = 409 DRAFT_INVALID · warning ≥ 1 ไม่มี flag = 409
 *
 * ป้องกันที่ระดับ class (เหมือน AdminController): @UseFilters ต้องมี ไม่งั้น 401/403/413 กลายเป็น 500
 *   @UseGuards(JwtAuthGuard, RolesGuard) + @Roles(Role.Admin) · สิทธิ์ตรวจก่อนรับไฟล์/อ่าน body เสมอ
 *
 * ขนาดไฟล์: AUTHORING_MAX_PDF_MB (ค่าเริ่มต้น 10) · multer เก็บไฟล์ในหน่วยความจำ ไม่เขียนดิสก์ (ไม่ตั้ง dest/storage)
 */

import { Body, Controller, Get, HttpCode, Param, Post, Put, Req, UploadedFile, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role } from '../auth/role.enum';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { parsePublishBody, parseRejectBody, parseUpdateBody, parseUploadFields } from './drafts.dto';
import type { DraftDetailDto, DraftSummaryDto, PublishResultDto } from './drafts.dto';
import { DraftsExceptionFilter } from './drafts.exception.filter';
import { DraftsService } from './drafts.service';

export const DEFAULT_MAX_PDF_MB = 10;

/**
 * เพดานขนาดไฟล์เป็นไบต์ — ต้องเป็นจำนวนเต็มเสมอ: busboy (ใต้ multer) เทียบขนาดด้วย === ถ้าเพดานเป็นทศนิยม
 * (เช่น AUTHORING_MAX_PDF_MB=2.3) จะไม่เคยเท่ากัน และ "ไม่บังคับเพดานเลย" เงียบๆ
 */
export function maxPdfBytes(env: NodeJS.ProcessEnv = process.env): number {
  const mb = Number(env.AUTHORING_MAX_PDF_MB);
  return Math.max(1, Math.floor((Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_MAX_PDF_MB) * 1024 * 1024));
}

/** ไฟล์ที่ multer ส่งมา (ประกาศเท่าที่ใช้ — ไม่ต้องพึ่ง @types/multer) */
interface UploadedPdf {
  buffer: Buffer;
}

@Controller('admin/drafts')
@UseFilters(DraftsExceptionFilter)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class DraftsController {
  constructor(private readonly draftsService: DraftsService) {}

  @Post()
  @HttpCode(202)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: maxPdfBytes(), files: 1, fields: 12, fieldSize: 1024 } }))
  async create(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: UploadedPdf | undefined,
    @Body() body: unknown,
  ): Promise<{ id: string; status: 'drafting' }> {
    const fields = parseUploadFields(body);
    const { id } = await this.draftsService.createFromUpload(file, fields, request.user!.sub);
    return { id, status: 'drafting' };
  }

  @Get()
  list(): Promise<{ items: DraftSummaryDto[] }> {
    return this.draftsService.list();
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<DraftDetailDto> {
    return this.draftsService.get(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: unknown): Promise<DraftDetailDto> {
    return this.draftsService.update(id, parseUpdateBody(body).graphs);
  }

  @Post(':id/retry')
  @HttpCode(202)
  async retry(@Param('id') id: string): Promise<{ id: string; status: 'drafting' }> {
    const result = await this.draftsService.retry(id);
    return { id: result.id, status: 'drafting' };
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: unknown): Promise<DraftDetailDto> {
    return this.draftsService.reject(id, request.user!.sub, parseRejectBody(body).reason);
  }

  @Post(':id/publish')
  @HttpCode(200)
  publish(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: unknown): Promise<PublishResultDto> {
    return this.draftsService.publish(id, request.user!.sub, parsePublishBody(body).acknowledgedWarnings);
  }
}
