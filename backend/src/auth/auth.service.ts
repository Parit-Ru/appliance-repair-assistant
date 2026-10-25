import { compare, hash, hashSync } from 'bcryptjs';
import { ApiError } from '../common/api-error';
import { isoFromEpoch } from '../common/helpers';
import type { AuthResponseDto, LoginBody, RegisterBody, UserDto } from './auth.dto';
import { Role } from './role.enum';
import { TokenService } from './token';
import { DuplicateEmailError, UsersStore } from './users.store';
import type { UserRecord } from './users.store';

const BCRYPT_ROUNDS = 10;

const emailTaken = () => new ApiError(409, 'EMAIL_TAKEN', 'อีเมลนี้ถูกใช้สมัครแล้ว');
const invalidCredentials = () => new ApiError(401, 'INVALID_CREDENTIALS', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');

function toUserDto(user: UserRecord): UserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    createdAt: isoFromEpoch(user.createdAtEpoch),
  };
}

export class AuthService {
  private readonly dummyHash = hashSync(globalThis.crypto.randomUUID(), BCRYPT_ROUNDS);

  constructor(
    private readonly usersStore: UsersStore,
    private readonly tokens: TokenService,
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
        role: Role.User,
      });
    } catch (err) {
      if (err instanceof DuplicateEmailError) {
        throw emailTaken();
      }
      throw err;
    }

    return this.issue(user);
  }

  async login(body: LoginBody): Promise<AuthResponseDto> {
    const user = await this.usersStore.findByEmail(body.email);

    const matches = await compare(body.password, user ? user.passwordHash : this.dummyHash);
    if (!user || !matches) {
      throw invalidCredentials();
    }

    return this.issue(user);
  }
  
  async me(userId: string): Promise<UserDto> {
    const user = await this.usersStore.findById(userId);
    if (!user) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'ไม่พบบัญชีนี้แล้ว กรุณาเข้าสู่ระบบใหม่');
    }
    return toUserDto(user);
  }

  private issue(user: UserRecord): AuthResponseDto {
    const accessToken = this.tokens.sign({ sub: user.id, role: user.role });
    return { accessToken, user: toUserDto(user) };
  }
}
