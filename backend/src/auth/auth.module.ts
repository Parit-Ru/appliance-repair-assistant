/**
 * auth.module.ts — บัญชีผู้ใช้ + JWT + guard ตามบทบาท
 *
 * MYSQL_POOL มาจาก DatabaseModule ที่เป็น @Global() ไม่ต้อง import
 * export JwtModule + JwtAuthGuard + RolesGuard ให้โมดูลอื่น (เช่น admin ใน Step 3) import AuthModule แล้วใช้
 * @UseGuards(JwtAuthGuard, RolesGuard) ได้ — guard ต้องหา JwtService เจอในโมดูลที่ใช้
 *
 * ค่าตั้งต้นจาก env (อ่านตอนบูต ผิด = บูตไม่ขึ้นพร้อมข้อความบอกวิธีแก้ ไม่ปล่อยให้รันแบบไม่ปลอดภัย):
 *   JWT_SECRET      อย่างน้อย 32 ตัวอักษร (ไม่มีค่าเริ่มต้นโดยตั้งใจ)
 *   JWT_EXPIRES_IN  เช่น 7d / 12h / 30m (ไม่ตั้ง = 7d)
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import type { JwtModuleOptions } from '@nestjs/jwt';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { UsersStore } from './users.store';

export const MIN_JWT_SECRET_LENGTH = 32;
export const DEFAULT_JWT_EXPIRES_IN = '7d';
/** จำนวน + หน่วย (s m h d w y) เช่น 7d — ไม่รับเลขเปล่า เพราะ jsonwebtoken ตีความเลขเปล่าเป็นมิลลิวินาที */
const EXPIRES_IN_PATTERN = /^\d+(s|m|h|d|w|y)$/;

export function buildJwtOptions(env: NodeJS.ProcessEnv = process.env): JwtModuleOptions {
  const secret = env.JWT_SECRET;
  if (!secret || secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET ต้องตั้งใน .env และยาวอย่างน้อย ${MIN_JWT_SECRET_LENGTH} ตัวอักษร — ` +
        `สุ่มได้ด้วย: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`,
    );
  }

  const expiresIn = env.JWT_EXPIRES_IN?.trim() || DEFAULT_JWT_EXPIRES_IN;
  if (!EXPIRES_IN_PATTERN.test(expiresIn)) {
    throw new Error(`JWT_EXPIRES_IN ไม่ถูกรูปแบบ: ต้องเป็นจำนวนตามด้วยหน่วย s/m/h/d/w/y เช่น 7d หรือ 12h`);
  }

  return { secret, signOptions: { algorithm: 'HS256', expiresIn } };
}

@Module({
  imports: [JwtModule.registerAsync({ useFactory: () => buildJwtOptions() })],
  controllers: [AuthController],
  providers: [UsersStore, AuthService, JwtAuthGuard, RolesGuard],
  exports: [JwtModule, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
