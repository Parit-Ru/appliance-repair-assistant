import * as jwt from 'jsonwebtoken';
import type { Role } from './role.enum';

const MIN_JWT_SECRET_LENGTH = 32;
const DEFAULT_JWT_EXPIRES_IN = '7d';
const EXPIRES_IN_PATTERN = /^\d+(s|m|h|d|w|y)$/;

export class TokenService {
  constructor(
    private readonly secret: string,
    private readonly expiresIn: string,
  ) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): TokenService {
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

    return new TokenService(secret, expiresIn);
  }

  sign(payload: { sub: string; role: Role }): string {
    return jwt.sign(payload, this.secret, { algorithm: 'HS256', expiresIn: this.expiresIn });
  }

  verify(token: string): { sub?: unknown; role?: unknown } {
    const payload = jwt.verify(token, this.secret, { algorithms: ['HS256'] });
    return typeof payload === 'string' ? {} : payload;
  }
}
