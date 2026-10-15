/**
 * history.controller.ts — 4 endpoint ของหน้า "ประวัติการซ่อม"
 *
 * "โง่" เหมือน TraversalController: ตรวจรูปร่าง input → ส่งให้ HistoryService → คืนผลตรงๆ
 * error ปล่อยให้ HistoryExceptionFilter แปลงเป็น HTTP
 *
 * ทุก endpoint บังคับหัวข้อ X-Client-Id (UUID ของเบราว์เซอร์) และจำกัดผลเฉพาะ session ของ id นั้น
 * session ที่ไม่ใช่ของ id นี้ตอบ 404 เหมือนไม่มีอยู่ (ไม่ใช่ 403)
 * หมายเหตุ: นี่ไม่ใช่การยืนยันตัวตน — ใครรู้ id ก็เห็นประวัติของ id นั้นได้
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
  UseFilters,
} from '@nestjs/common';

import { parseRequiredClientId } from '../traversal/traversal.dto';
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
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  /** GET /history?q=&category=&brand=&status=&sort=newest|oldest&page=&pageSize= */
  @Get()
  async list(
    @Headers('x-client-id') clientIdHeader: unknown,
    @Query() query: unknown,
  ): Promise<HistoryListResponseDto> {
    const clientId = parseRequiredClientId(clientIdHeader);
    return this.historyService.list(clientId, parseHistoryQuery(query));
  }

  /** GET /history/:id */
  @Get(':id')
  async detail(
    @Headers('x-client-id') clientIdHeader: unknown,
    @Param('id') sessionId: string,
  ): Promise<HistoryDetailDto> {
    const clientId = parseRequiredClientId(clientIdHeader);
    return this.historyService.detail(clientId, sessionId);
  }

  /** POST /history/:id/feedback — body: { helpful: boolean, comment?: string } ตอบ 200 (แก้ค่าเดิมได้) */
  @Post(':id/feedback')
  @HttpCode(200)
  async feedback(
    @Headers('x-client-id') clientIdHeader: unknown,
    @Param('id') sessionId: string,
    @Body() body: unknown,
  ): Promise<HistoryFeedbackDto> {
    const clientId = parseRequiredClientId(clientIdHeader);
    return this.historyService.saveFeedback(clientId, sessionId, parseFeedbackBody(body));
  }

  /** DELETE /history/:id — ตอบ 204 ไม่มี body */
  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Headers('x-client-id') clientIdHeader: unknown,
    @Param('id') sessionId: string,
  ): Promise<void> {
    const clientId = parseRequiredClientId(clientIdHeader);
    await this.historyService.remove(clientId, sessionId);
  }
}
