/**
 * admin.controller.ts — 3 endpoint อ่านอย่างเดียวสำหรับผู้ดูแลระบบ
 *
 *   GET /admin/feedback            รายการคะแนน/ความเห็นทั้งหมด (แบ่งหน้า)
 *   GET /admin/analytics/summary   สถิติรวมช่วง N วันล่าสุด
 *   GET /admin/sessions            รายการ session ทั้งหมด (guest + user) แบ่งหน้า
 *
 * ป้องกันที่ระดับ class (ครอบทุก endpoint ที่จะเพิ่มทีหลังด้วย):
 *   @UseFilters(AdminExceptionFilter)  ← จำเป็น ไม่งั้น 401/403 ของ guard กลายเป็น 500
 *   @UseGuards(JwtAuthGuard, RolesGuard) + @Roles(Role.Admin)
 *     ไม่มี token/token เสีย → 401 · ล็อกอินแล้วไม่ใช่ admin → 403 · ตรวจก่อน parse query เสมอ
 *
 * "โง่" เหมือน controller อื่น: ตรวจ query (parseXxx) → ส่งให้ AdminService → คืนผลตรงๆ
 */

import { Controller, Get, Query, UseFilters, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role } from '../auth/role.enum';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { parseFeedbackQuery, parseSessionsQuery, parseSummaryQuery } from './admin.dto';
import type { AdminFeedbackItemDto, AdminSessionItemDto, AdminSummaryDto, PagedDto } from './admin.dto';
import { AdminExceptionFilter } from './admin.exception.filter';
import { AdminService } from './admin.service';

@Controller('admin')
@UseFilters(AdminExceptionFilter)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /** GET /admin/feedback?helpful=true|false&from=YYYY-MM-DD&to=YYYY-MM-DD&page=&pageSize= */
  @Get('feedback')
  async feedback(@Query() query: unknown): Promise<PagedDto<AdminFeedbackItemDto>> {
    return this.adminService.feedback(parseFeedbackQuery(query));
  }

  /** GET /admin/analytics/summary?days=1..90 */
  @Get('analytics/summary')
  async summary(@Query() query: unknown): Promise<AdminSummaryDto> {
    return this.adminService.summary(parseSummaryQuery(query));
  }

  /** GET /admin/sessions?status=&ownerType=&graphId=&from=&to=&page=&pageSize= */
  @Get('sessions')
  async sessions(@Query() query: unknown): Promise<PagedDto<AdminSessionItemDto>> {
    return this.adminService.sessions(parseSessionsQuery(query));
  }
}
