/**
 * users.store.ts — SQL ทั้งหมดของตาราง users (migration 010)
 *
 * รูปแบบเดียวกับ HistoryStore / SessionStore: ฉีด MYSQL_POOL ใช้ query แบบมีพารามิเตอร์ (?) เท่านั้น
 * ไม่ประกอบ SQL จากข้อความของผู้ใช้
 *
 * อีเมลต้องเป็นตัวพิมพ์เล็กมาก่อนแล้ว (auth.dto.ts แปลงให้) store ไม่แปลงซ้ำ
 */

import { Inject, Injectable } from '@nestjs/common';
import type { Pool, RowDataPacket } from 'mysql2/promise';

import { MYSQL_POOL } from '../database/database.constants';
import { Role } from './role.enum';

interface UserRow extends RowDataPacket {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  role: Role;
  /** UNIX_TIMESTAMP(created_at) — เลขวินาทีไม่ขึ้นกับเขตเวลาของ Node/MySQL (เหมือน HistoryStore) */
  created_epoch: string | number;
}

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: Role;
  createdAtEpoch: number;
}

interface NewUser {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: Role;
}

/** อีเมลนี้มีบัญชีอยู่แล้ว (ชน UNIQUE uq_users_email) — AuthService แปลงเป็น ApiError 409 EMAIL_TAKEN */
export class DuplicateEmailError extends Error {
  constructor(email: string) {
    super(`อีเมล ${email} มีบัญชีอยู่แล้ว`);
    this.name = this.constructor.name;
  }
}

const SELECT_USER = `SELECT id, email, password_hash, display_name, role,
                            UNIX_TIMESTAMP(created_at) AS created_epoch
                       FROM users`;

function rowToUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    displayName: row.display_name,
    role: row.role,
    createdAtEpoch: Number(row.created_epoch),
  };
}

@Injectable()
export class UsersStore {
  constructor(@Inject(MYSQL_POOL) private readonly pool: Pool) {}

  async findByEmail(email: string): Promise<UserRecord | undefined> {
    const [rows] = await this.pool.query<UserRow[]>(`${SELECT_USER} WHERE email = ? LIMIT 1`, [email]);
    return rows[0] ? rowToUser(rows[0]) : undefined;
  }

  async findById(id: string): Promise<UserRecord | undefined> {
    const [rows] = await this.pool.query<UserRow[]>(`${SELECT_USER} WHERE id = ? LIMIT 1`, [id]);
    return rows[0] ? rowToUser(rows[0]) : undefined;
  }

  /** เพิ่มผู้ใช้ใหม่แล้วอ่านกลับ (ให้ created_at เป็นค่าจริงจากฐานข้อมูล) · อีเมลซ้ำ → DuplicateEmailError */
  async create(user: NewUser): Promise<UserRecord> {
    try {
      await this.pool.query(
        `INSERT INTO users (id, email, password_hash, display_name, role)
         VALUES (?, ?, ?, ?, ?)`,
        [user.id, user.email, user.passwordHash, user.displayName, user.role],
      );
    } catch (err) {
      if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new DuplicateEmailError(user.email);
      }
      throw err;
    }

    const created = await this.findById(user.id);
    if (!created) {
      throw new Error('เพิ่มผู้ใช้แล้วแต่อ่านกลับไม่เจอ');
    }
    return created;
  }
}
