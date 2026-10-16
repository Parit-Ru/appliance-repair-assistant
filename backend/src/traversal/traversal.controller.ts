/**
 * traversal.controller.ts — 7 endpoint ของ API เดินขั้นตอนการตรวจอาการ
 *
 * ไฟล์นี้ตั้งใจให้ "โง่" ที่สุดเท่าที่เป็นไปได้ ไม่มีการตัดสินใจอะไรเองเลย:
 *   - รับ request
 *   - ตรวจรูปร่าง body ด้วยฟังก์ชันจาก traversal.dto.ts
 *   - ส่งต่อให้ TraversalService ทำงานจริง
 *   - คืนสิ่งที่ service ให้กลับมาตรงๆ
 *
 * error ทุกชนิดที่เกิดขึ้น (ไม่ว่าจาก parse* หรือจาก service) ไม่ได้ถูกจับที่นี่เลย
 * ปล่อยให้หลุดขึ้นไปให้ TraversalExceptionFilter ที่ติดไว้ระดับ controller
 * ด้านล่างเป็นคนแปลงเป็น HTTP response แทน
 *
 * @Body() รับเป็น unknown เสมอ ไม่ประกาศเป็น DTO class ของ NestJS/class-validator
 * เพราะตัดสินใจไม่ใช้ class-validator — รูปร่างของ body ที่แท้จริง
 * ถูกพิสูจน์ (และแปลง type ให้ TypeScript เชื่อ) ผ่าน parseStartSessionBody /
 * parseTraversalAction / parseOutcomeBody เท่านั้น
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
import { resolveOptionalOwner, resolveRequiredOwner } from '../auth/session-owner';

import {
  parseOptionalManualId,
  parseOutcomeBody,
  parseStartSessionBody,
  parseTraversalAction,
} from './traversal.dto';
import type { SessionResponseDto } from './traversal.dto';
import { TraversalExceptionFilter } from './traversal.exception.filter';
import { TraversalService } from './traversal.service';
import type { GraphSummary, ManualSummary } from './graph.repository';

@Controller('traversal')
@UseFilters(TraversalExceptionFilter)
export class TraversalController {
  constructor(private readonly traversalService: TraversalService) {}

  /** GET /traversal/graphs — ?manualId=… (ไม่บังคับ) เฉพาะผังของรุ่นนั้น */
  @Get('graphs')
  listGraphs(@Query('manualId') manualId?: unknown): GraphSummary[] {
    // ไม่ async เพราะ service.listGraphs() เองก็ไม่ async (อ่านจากหน่วยความจำล้วน)
    return this.traversalService.listGraphs(parseOptionalManualId(manualId));
  }

  /** GET /traversal/manuals */
  @Get('manuals')
  listManuals(): ManualSummary[] {
    return this.traversalService.listManuals();
  }

  /**
   * POST /traversal/sessions — body: { graphId, query?, manualId?, modelSelection? }
   * modelSelection ไม่บังคับ: 'selected' (เลือกรุ่นเอง) | 'unknown' (ไม่ทราบรุ่น) บันทึกไว้แยกเคสตอนวัดผล ไม่กระทบขั้นตอน
   * query ไม่บังคับ ไว้คิดคะแนนความมั่นใจ · manualId ไม่บังคับ: ถ้าส่งมา ผังต้องเป็นของรุ่นนั้น (ไม่ใช่ → 400 GRAPH_MANUAL_MISMATCH)
   * เจ้าของ session: ส่ง Authorization: Bearer ที่ถูกต้อง → เป็นของ user นั้น (ไม่ดู X-Client-Id)
   * ไม่ส่ง → guest: หัวข้อ X-Client-Id ไม่บังคับ (UUID ของเบราว์เซอร์ ผิดรูป → 400 INVALID_CLIENT_ID)
   * token เสีย/หมดอายุ → 401 UNAUTHENTICATED
   *
   * endpoint ของ session ทั้งหมดด้านล่างติด OptionalJwtAuthGuard: guest ใช้ได้เหมือนเดิม แต่ session ของ user
   * ต้องมี token ของเจ้าของ (ไม่ใช่ → 404 SESSION_NOT_FOUND) · graphs/manuals ไม่ติด จึงไม่พังเพราะ token เสีย
   */
  @Post('sessions')
  @UseGuards(OptionalJwtAuthGuard)
  async startSession(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
    @Headers('x-client-id') clientIdHeader?: unknown,
  ): Promise<SessionResponseDto> {
    // parseStartSessionBody โยน InvalidRequestBodyError ทันทีถ้า body ผิดรูปแบบ
    // โค้ดจะไม่เดินไปถึง service เลยในกรณีนั้น (filter จับ error แล้วแปลงเป็น 400 แทน)
    const { graphId, query, manualId, modelSelection } = parseStartSessionBody(body);
    const owner = resolveOptionalOwner(request.user, clientIdHeader);
    return this.traversalService.startSession(graphId, query, manualId, modelSelection, owner);
  }

  /** GET /traversal/sessions/:id */
  @Get('sessions/:id')
  @UseGuards(OptionalJwtAuthGuard)
  async getSession(
    @Req() request: AuthenticatedRequest,
    @Param('id') sessionId: string,
  ): Promise<SessionResponseDto> {
    return this.traversalService.getSession(sessionId, request.user?.sub);
  }

  /** POST /traversal/sessions/:id/actions — body คือ TraversalAction ตรงๆ ไม่ห่อ object อื่น */
  @Post('sessions/:id/actions')
  @UseGuards(OptionalJwtAuthGuard)
  async submitAction(
    @Req() request: AuthenticatedRequest,
    @Param('id') sessionId: string,
    @Body() body: unknown,
  ): Promise<SessionResponseDto> {
    const action = parseTraversalAction(body);
    return this.traversalService.submitAction(sessionId, action, request.user?.sub);
  }

  /**
   * POST /traversal/sessions/:id/outcome — body: { text }
   *
   * บันทึกข้อความผลลัพธ์ที่ผู้ใช้กรอกตอนการตรวจจบ (ได้ครั้งเดียวต่อ session)
   * เป็น endpoint แยกจาก /actions โดยตั้งใจ: ไม่ผ่าน submitAction/resolveNextNode เลย
   *
   * ตอบ 200 ไม่ใช่ 201: ไม่ได้สร้างทรัพยากรใหม่ แค่บันทึกข้อมูลเพิ่มให้ session ที่มีอยู่
   * (ต่างจาก /sessions และ /actions ที่ตอบ 201 ตามค่าเริ่มต้นของ NestJS สำหรับ POST)
   */
  @Post('sessions/:id/outcome')
  @HttpCode(200)
  @UseGuards(OptionalJwtAuthGuard)
  async submitOutcome(
    @Req() request: AuthenticatedRequest,
    @Param('id') sessionId: string,
    @Body() body: unknown,
  ): Promise<SessionResponseDto> {
    const { text } = parseOutcomeBody(body);
    return this.traversalService.submitOutcome(sessionId, text, request.user?.sub);
  }

  /**
   * DELETE /traversal/sessions/:id
   *
   * ต้องตอบ 204 ไม่มี body — @HttpCode(204) บังคับ status code เอง
   * ฟังก์ชันคืน Promise<void> พอ ไม่ต้อง return อะไร NestJS จะไม่แนบ body ให้
   *
   * เจ้าของเหมือน /history: ล็อกอิน (Bearer) → user · ไม่ล็อกอิน → X-Client-Id บังคับ (ไม่ส่ง/ผิดรูป → 400 INVALID_CLIENT_ID)
   * ลบได้เฉพาะ session ของเจ้าของนั้น ไม่ใช่เจ้าของ → 404 SESSION_NOT_FOUND (เหมือน session ไม่มีอยู่)
   */
  @Delete('sessions/:id')
  @HttpCode(204)
  @UseGuards(OptionalJwtAuthGuard)
  async abandonSession(
    @Req() request: AuthenticatedRequest,
    @Param('id') sessionId: string,
    @Headers('x-client-id') clientIdHeader?: unknown,
  ): Promise<void> {
    const owner = resolveRequiredOwner(request.user, clientIdHeader);
    await this.traversalService.abandonSession(sessionId, owner);
  }
}