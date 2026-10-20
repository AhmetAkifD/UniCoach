import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma, type User } from "@prisma/client";
import {
  isAdminShortcut,
  type AuthResponse,
  type AuthUser,
  type CheckEmailResponse,
  type LoginInput,
  type RegisterInput,
  type UpdateProfileInput,
} from "@unicoach/shared";
import { PrismaService } from "../prisma/prisma.service";
import { hashPassword, verifyPassword } from "./password";

export interface JwtPayload {
  sub: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Giriş akışının ilk adımı: e-posta kayıtlıysa şifre, değilse kayıt adımına geçilir. */
  async checkEmail(email: string): Promise<CheckEmailResponse> {
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    return { exists: user !== null };
  }

  async register(input: RegisterInput): Promise<AuthResponse> {
    try {
      const user = await this.prisma.user.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          examTrack: input.examTrack,
          passwordHash: await hashPassword(input.password),
          // Rol yalnızca burada belirlenir; istemciden gelen bir rol alanı kabul edilmez.
          role: isAdminShortcut(input.email, input.password) ? "ADMIN" : "STUDENT",
        },
      });
      return this.issue(user);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Bu e-posta adresiyle kayıtlı bir hesap zaten var.");
      }
      throw err;
    }
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new UnauthorizedException("E-posta adresi veya şifre hatalı.");
    }
    return this.issue(user);
  }

  /** Profil: şimdilik yalnızca hazırlanılan sınav değiştirilebilir. */
  async updateProfile(userId: string, input: UpdateProfileInput): Promise<AuthUser> {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { examTrack: input.examTrack } });
    return toAuthUser(user);
  }

  /** Belirteçteki kullanıcıyı getirir; kullanıcı silinmişse null. */
  async findUser(id: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? toAuthUser(user) : null;
  }

  private async issue(user: User): Promise<AuthResponse> {
    const payload: JwtPayload = { sub: user.id };
    return { user: toAuthUser(user), accessToken: await this.jwt.signAsync(payload) };
  }
}

function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    examTrack: user.examTrack,
    createdAt: user.createdAt.toISOString(),
  };
}
