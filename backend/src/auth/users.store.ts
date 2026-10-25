import type { Pool, RowDataPacket } from 'mysql2/promise';
import { Role } from './role.enum';

interface UserRow extends RowDataPacket {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  role: Role;
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

export class UsersStore {
  constructor(private readonly pool: Pool) {}

  async findByEmail(email: string): Promise<UserRecord | undefined> {
    const [rows] = await this.pool.query<UserRow[]>(`${SELECT_USER} WHERE email = ? LIMIT 1`, [email]);
    return rows[0] ? rowToUser(rows[0]) : undefined;
  }

  async findById(id: string): Promise<UserRecord | undefined> {
    const [rows] = await this.pool.query<UserRow[]>(`${SELECT_USER} WHERE id = ? LIMIT 1`, [id]);
    return rows[0] ? rowToUser(rows[0]) : undefined;
  }

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
