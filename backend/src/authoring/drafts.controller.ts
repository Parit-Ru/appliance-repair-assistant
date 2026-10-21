/*
  drafts.controller.ts — endpoint ของผู้ดูแลระบบสำหรับ "อัปโหลด PDF → ร่างผัง → ตรวจ → เผยแพร่"

    POST /admin/drafts                  multipart: file (PDF) + manualId, deviceCategory, brand, modelPattern, sourceManual,
                                        displayName?, pageFrom, pageTo → 202 { id, status: 'drafting' }
    GET  /admin/drafts                  รายการร่าง (ล่าสุด 100)
    GET  /admin/drafts/:id              รายละเอียด: ผังร่าง + ข้อความหน้าต้นฉบับ + รายงาน validator + ความคืบหน้า
    PUT  /admin/drafts/:id              { graphs } แก้ผัง (เฉพาะ ready) ตรวจใหม่ทุกครั้ง
    POST /admin/drafts/:id/reject       { reason? }
    POST /admin/drafts/:id/publish      { acknowledgedWarnings? } error ≥ 1 = 409 DRAFT_INVALID · warning ≥ 1 ไม่มี flag = 409

  error ทั่วไป (ApiError, 401/403 ของ guard) แปลงโดย AllExceptionsFilter (common/) · เฉพาะ error ของตัวรับไฟล์ตอนอัปโหลด
  (multer) ใช้ UploadErrorsFilter ด้านล่าง เพราะมันเป็น HttpException ของ Nest ที่ filter กลางปล่อยให้ Nest ตอบเอง
 */

import {
  ArgumentsHost,
  BadRequestException,
  Body,
  Catch,
  Controller,
  ExceptionFilter,
  Get,
  HttpCode,
  Param,
  PayloadTooLargeException,
  Post,
  Put,
  Req,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { parsePublishBody, parseRejectBody, parseUpdateBody, parseUploadFields } from './drafts.dto';
import type { DraftDetailDto, DraftSummaryDto, PublishResultDto } from './drafts.dto';
import { DraftsService } from './drafts.service';

const DEFAULT_MAX_PDF_MB = 10;
function maxPdfBytes(env: NodeJS.ProcessEnv = process.env): number {
  const mb = Number(env.AUTHORING_MAX_PDF_MB);
  return Math.max(1, Math.floor((Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_MAX_PDF_MB) * 1024 * 1024));
}

interface UploadedPdf {
  buffer: Buffer;
}

/**
 * error ของตัวรับไฟล์ (multer) ตอน POST /admin/drafts: ไฟล์ใหญ่เกิน → 413 PDF_TOO_LARGE ·
 * ส่งหลายไฟล์ / ชื่อฟิลด์ไฟล์ผิด / ฟิลด์ข้อความเกินจำนวนหรือยาวเกิน → 400 INVALID_DRAFT_REQUEST
 */
@Catch(BadRequestException, PayloadTooLargeException)
class UploadErrorsFilter implements ExceptionFilter {
  catch(exception: BadRequestException | PayloadTooLargeException, host: ArgumentsHost): void {
    const body =
      exception instanceof PayloadTooLargeException
        ? { statusCode: 413, code: 'PDF_TOO_LARGE', message: 'ไฟล์ใหญ่เกินที่รองรับ' }
        : {
            statusCode: 400,
            code: 'INVALID_DRAFT_REQUEST',
            message: 'คำขออัปโหลดไม่ถูกต้อง (ส่งไฟล์เดียวในฟิลด์ชื่อ file และฟิลด์ข้อความตามที่กำหนด)',
          };
    host.switchToHttp().getResponse<Response>().status(body.statusCode).json(body);
  }
}

@Controller('admin/drafts')
@UseGuards(JwtAuthGuard, AdminGuard)
export class DraftsController {
  constructor(private readonly draftsService: DraftsService) {}

  @Post()
  @HttpCode(202)
  @UseFilters(UploadErrorsFilter)
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
