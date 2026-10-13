/**
 * symptom-search.controller.ts — 2 endpoint ของงานค้นหาอาการ
 *
 *   POST /symptom-search         body: { query }  → SymptomSearchResponseDto
 *   GET  /symptom-search/status                   → SearchStatusDto
 *
 * ตั้งใจให้ "โง่" เหมือน TraversalController: ตรวจรูปร่าง body ด้วย parseSearchBody
 * แล้วส่งต่อ service คืนผลตรงๆ ไม่จับ error เอง ปล่อยให้ SymptomSearchExceptionFilter
 * (ติดระดับ controller) แปลงเป็น HTTP response
 *
 * POST ตอบ 200 ไม่ใช่ 201: การค้นหาไม่ได้สร้างทรัพยากรใหม่ (NestJS ค่าเริ่มต้นของ POST คือ 201)
 */

import { Body, Controller, Get, HttpCode, Post, UseFilters } from '@nestjs/common';

import { parseSearchBody } from './symptom-search.dto';
import type {
  SearchStatusDto,
  SymptomSearchResponseDto,
} from './symptom-search.dto';
import { SymptomSearchExceptionFilter } from './symptom-search.exception.filter';
import { SymptomSearchService } from './symptom-search.service';

@Controller('symptom-search')
@UseFilters(SymptomSearchExceptionFilter)
export class SymptomSearchController {
  constructor(private readonly searchService: SymptomSearchService) {}

  /** POST /symptom-search — body: { query } */
  @Post()
  @HttpCode(200)
  async search(@Body() body: unknown): Promise<SymptomSearchResponseDto> {
    const { query } = parseSearchBody(body);
    return this.searchService.search(query);
  }

  /** GET /symptom-search/status — ไว้ดูความคืบหน้าการโหลดโมเดลและหน่วยความจำ */
  @Get('status')
  status(): SearchStatusDto {
    return this.searchService.getStatus();
  }
}