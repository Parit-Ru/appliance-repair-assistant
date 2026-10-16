/**
 * history.controller.ts — 4 endpoint ของหน้า "ประวัติการซ่อม"
 *
 * "โง่" เหมือน TraversalController: ตรวจรูปร่าง input → ส่งให้ HistoryService → คืนผลตรงๆ
 * error ปล่อยให้ HistoryExceptionFilter แปลงเป็น HTTP
 *
 * เจ้าของของคำขอ (resolveRequiredOwner):
 *   - ส่ง Authorization: Bearer <token> ที่ถูกต้อง → เป็น user (ไม่ต้องส่ง X-Client-Id และไม่ดูมันเลย)
 *   - ไม่ส่ง Authorization → เป็น guest ต้องส่ง X-Client-Id (UUID ของเบราว์เซอร์) เหมือนเดิม
 *   - ส่ง Authorization แต่ token เสีย/หมดอายุ → 401 UNAUTHENTICATED (OptionalJwtAuthGuard)
 * ผลถูกจำกัดเฉพาะ session ของเจ้าของนั้น · ไม่ใช่ของตัวเอง ตอบ 404 เหมือนไม่มีอยู่ (ไม่ใช่ 403)
 * user มองไม่เห็น session ของ guest/คนอื่น และ guest มองไม่เห็น session ของ user (ดู auth/session-owner.ts)
 * หมายเหตุ: guest ไม่ใช่การยืนยันตัวตน — ใครรู้ client id ก็เห็นประวัติ guest ของ id นั้นได้
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';

import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { resolveRequiredOwner } from '../auth/session-owner';
import { parseFeedbackBody, parseHistoryQuery } from './history.dto';
import type {
  HistoryDetailDto,
  HistoryFeedbackDto,
  HistoryListResponseDto,
} from './history.dto';
import { HistoryExceptionFilter } from './history.exception.filter';
import { HistoryService } from './history.service';

@Controller('history')
@UseFilters(HistoryExceptionFilter)
@UseGuards(OptionalJwtAuthGuard)
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  /** GET /history?q=&category=&brand=&status=&sort=newest|oldest&page=&pageSize= */
  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Headers('x-client-id') clientIdHeader: unknown,
    @Query() query: unknown,
  ): Promise<HistoryListResponseDto> {
    const owner = resolveRequiredOwner(request.user, clientIdHeader);
    return this.historyService.list(owner, parseHistoryQuery(query));
  }

  /** GET /history/:id */
  @Get(':id')
  async detail(
    @Req() request: AuthenticatedRequest,
    @Headers('x-client-id') clientIdHeader: unknown,
    @Param('id') sessionId: string,
  ): Promise<HistoryDetailDto> {
    const owner = resolveRequiredOwner(request.user, clientIdHeader);
    return this.historyService.detail(owner, sessionId);
  }

  /** POST /history/:id/feedback — body: { helpful: boolean, comment?: string } ตอบ 200 (แก้ค่าเดิมได้) */
  @Post(':id/feedback')
  @HttpCode(200)
  async feedback(
    @Req() request: AuthenticatedRequest,
    @Headers('x-client-id') clientIdHeader: unknown,
    @Param('id') sessionId: string,
    @Body() body: unknown,
  ): Promise<HistoryFeedbackDto> {
    const owner = resolveRequiredOwner(request.user, clientIdHeader);
    return this.historyService.saveFeedback(owner, sessionId, parseFeedbackBody(body));
  }

  /** DELETE /history/:id — ตอบ 204 ไม่มี body */
  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Req() request: AuthenticatedRequest,
    @Headers('x-client-id') clientIdHeader: unknown,
    @Param('id') sessionId: string,
  ): Promise<void> {
    const owner = resolveRequiredOwner(request.user, clientIdHeader);
    await this.historyService.remove(owner, sessionId);
  }
}
