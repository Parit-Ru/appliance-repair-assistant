/**
 * auth.service.ts — สมัคร / เข้าสู่ระบบ / ดูข้อมูลตัวเอง + ออก JWT
 *
 * ตรรกะล้วน: ไม่รู้จัก HTTP (error เป็นคลาสของตัวเอง ให้ AuthExceptionFilter แปลง)
 *
 * ความปลอดภัย:
 * - สมัครสาธารณะได้ role = user เท่านั้น (RegisterBody ไม่มี role) · admin สร้างได้ทางเดียวคือ scripts/seed-admin.js
 * - login ผิดทุกกรณี (ไม่พบอีเมล / รหัสผ่านผิด) ตอบ InvalidCredentialsError ข้อความเดียวกัน ไม่บอกว่าอีเมลมีอยู่หรือไม่
 *   และเมื่อไม่พบอีเมลก็ยัง compare กับ hash หลอก เพื่อให้เวลาตอบใกล้เคียงกัน (กันการเดาอีเมลจากเวลา)
 * - JWT มีแค่ sub (user id) และ role · role ใน token เชื่อตามที่ตกลง (ไม่ query DB ทุกคำขอ)
 *   ผลคือเปลี่ยน role ของใครแล้วต้องรอ token เก่าหมดอายุ (JWT_EXPIRES_IN)
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash, hashSync } from 'bcryptjs';

import type { AuthResponseDto, LoginBody, RegisterBody, UserDto } from './auth.dto';
import { Role } from './role.enum';
import { DuplicateEmailError, UsersStore } from './users.store';
import type { UserRecord } from './users.store';

/** ต้องเท่ากับ BCRYPT_ROUNDS ใน scripts/seed-admin.js (admin ที่ seed ต้องล็อกอินผ่านทางเดียวกับคนสมัคร) */
export const BCRYPT_ROUNDS = 10;

export class EmailTakenError extends Error {
  constructor() {
    super('อีเมลนี้ถูกใช้สมัครแล้ว');
    this.name = this.constructor.name;
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    this.name = this.constructor.name;
  }
}

function toUserDto(user: UserRecord): UserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    createdAt: new Date(user.createdAtEpoch * 1000).toISOString(),
  };
}

@Injectable()
export class AuthService {
  /** hash หลอกสำหรับ compare ตอนไม่พบอีเมล (สร้างครั้งเดียวตอนบูต ไม่ตรงกับรหัสผ่านของใคร) */
  private readonly dummyHash = hashSync(globalThis.crypto.randomUUID(), BCRYPT_ROUNDS);

  constructor(
    private readonly usersStore: UsersStore,
    private readonly jwtService: JwtService,
  ) {}

  async register(body: RegisterBody): Promise<AuthResponseDto> {
    const passwordHash = await hash(body.password, BCRYPT_ROUNDS);

    let user: UserRecord;
    try {
      user = await this.usersStore.create({
        id: globalThis.crypto.randomUUID(),
        email: body.email,
        passwordHash,
        displayName: body.displayName,
        // ตั้งตายตัวที่นี่ ไม่รับจากผู้ใช้เด็ดขาด
        role: Role.User,
      });
    } catch (err) {
      if (err instanceof DuplicateEmailError) {
        throw new EmailTakenError();
      }
      throw err;
    }

    return this.issue(user);
  }

  async login(body: LoginBody): Promise<AuthResponseDto> {
    const user = await this.usersStore.findByEmail(body.email);

    const matches = await compare(body.password, user ? user.passwordHash : this.dummyHash);
    if (!user || !matches) {
      throw new InvalidCredentialsError();
    }

    return this.issue(user);
  }

  /** ข้อมูลล่าสุดจากฐานข้อมูล · ผู้ใช้ถูกลบไปแล้วแต่ token ยังไม่หมดอายุ → 401 */
  async me(userId: string): Promise<UserDto> {
    const user = await this.usersStore.findById(userId);
    if (!user) {
      throw new UnauthorizedException('ไม่พบบัญชีนี้แล้ว กรุณาเข้าสู่ระบบใหม่');
    }
    return toUserDto(user);
  }

  private async issue(user: UserRecord): Promise<AuthResponseDto> {
    const accessToken = await this.jwtService.signAsync({ sub: user.id, role: user.role });
    return { accessToken, user: toUserDto(user) };
  }
}
