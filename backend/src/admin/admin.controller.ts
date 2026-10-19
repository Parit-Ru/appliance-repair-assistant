/**
 * admin.controller.ts — 2 endpoint อ่านอย่างเดียวสำหรับผู้ดูแลระบบ
 *
 *   GET /admin/feedback            รายการคะแนน/ความเห็นทั้งหมด (แบ่งหน้า)
 *   GET /admin/analytics/summary   สถิติรวมช่วง N วันล่าสุด
 *
 * ป้องกันที่ระดับ class (ครอบทุก endpoint ที่จะเพิ่มทีหลังด้วย):
 *   @UseGuards(JwtAuthGuard, RolesGuard) + @Roles(Role.Admin)
 *     ไม่มี token/token เสีย → 401 · ล็อกอินแล้วไม่ใช่ admin → 403 · ตรวจก่อน parse query เสมอ
 *   401/403 ของ guard แปลงเป็น {statusCode, code, message} โดย AllExceptionsFilter (common/) ที่ติดทั้งแอป
 *
 * "โง่" เหมือน controller อื่น: ตรวจ query (parseXxx) → ส่งให้ AdminService → คืนผลตรงๆ
 */

import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role } from '../auth/role.enum';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { parseFeedbackQuery, parseSummaryQuery } from './admin.dto';
import type { AdminFeedbackPageDto, AdminSummaryDto } from './admin.dto';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /** GET /admin/feedback?helpful=true|false&from=YYYY-MM-DD&to=YYYY-MM-DD&page=&pageSize= */
  @Get('feedback')
  async feedback(@Query() query: unknown): Promise<AdminFeedbackPageDto> {
    return this.adminService.feedback(parseFeedbackQuery(query));
  }

  /** GET /admin/analytics/summary?days=1..90 */
  @Get('analytics/summary')
  async summary(@Query() query: unknown): Promise<AdminSummaryDto> {
    return this.adminService.summary(parseSummaryQuery(query));
  }
}
