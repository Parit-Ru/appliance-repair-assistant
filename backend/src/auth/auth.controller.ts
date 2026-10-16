/**
 * auth.controller.ts — 3 endpoint: สมัคร / เข้าสู่ระบบ / ดูข้อมูลตัวเอง
 *
 * "โง่" เหมือน HistoryController: ตรวจรูปร่าง input (parseXxx) → ส่งให้ AuthService → คืนผลตรงๆ
 * error ปล่อยให้ AuthExceptionFilter แปลงเป็น HTTP
 *
 * POST /auth/register  body { email, password, displayName }  → 201 { accessToken, user }   (role เป็น user เสมอ)
 * POST /auth/login     body { email, password }               → 200 { accessToken, user }
 * GET  /auth/me        Authorization: Bearer <token>          → 200 { id, email, displayName, role, createdAt }
 */

import { Body, Controller, Get, HttpCode, Post, Req, UseFilters, UseGuards } from '@nestjs/common';

import { parseLoginBody, parseRegisterBody } from './auth.dto';
import type { AuthResponseDto, UserDto } from './auth.dto';
import { AuthExceptionFilter } from './auth.exception.filter';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedRequest } from './jwt-auth.guard';

@Controller('auth')
@UseFilters(AuthExceptionFilter)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: unknown): Promise<AuthResponseDto> {
    return this.authService.register(parseRegisterBody(body));
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown): Promise<AuthResponseDto> {
    return this.authService.login(parseLoginBody(body));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() request: AuthenticatedRequest): Promise<UserDto> {
    // JwtAuthGuard ตั้ง request.user แล้วถ้าผ่านมาถึงตรงนี้
    return this.authService.me(request.user!.sub);
  }
}
