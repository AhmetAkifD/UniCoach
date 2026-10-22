import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma, type User } from "@prisma/client";
import {
  AVATAR_MAX_BYTES,
  isAdminShortcut,
  type AuthResponse,
  type AuthUser,
  type ChangePasswordInput,
  type CheckEmailResponse,
  type ThemePreference,
  type LoginInput,
  type RegisterInput,
  type UpdateProfileInput,
} from "@unicoach/shared";
import { removeFiles as removeBookFiles } from "../books/books.service";
import { PrismaService } from "../prisma/prisma.service";
import { hashPassword, verifyPassword } from "./password";

/** Profil fotoğraflarının dizini (Docker'da uploads volume'u, PDF'lerle aynı yer). */
const AVATAR_DIR = path.join(path.resolve(process.env.UPLOAD_DIR ?? "storage"), "avatars");
export const avatarFile = (userId: string) => path.join(AVATAR_DIR, `${userId}.jpg`);

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

  /** Profil: ad, soyad, hazırlanılan sınav ve tema; verilmeyen alanlar değişmez. */
  async updateProfile(userId: string, input: UpdateProfileInput): Promise<AuthUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.firstName !== undefined && { firstName: input.firstName }),
        ...(input.lastName !== undefined && { lastName: input.lastName }),
        ...(input.examTrack !== undefined && { examTrack: input.examTrack }),
        ...(input.theme !== undefined && { theme: input.theme }),
      },
    });
    return toAuthUser(user);
  }

  /** Şifre değişikliği şu anki şifreyle doğrulanır. Admin kısayolu hesabının şifresi değişmez. */
  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await this.verified(userId, input.currentPassword, "Şu anki şifren hatalı.");
    if (isAdminShortcut(user.email, input.currentPassword)) {
      throw new BadRequestException("Admin kısayolu hesabının şifresi değiştirilemez.");
    }
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(input.newPassword) } });
  }

  /** Hesap ve bütün verileri silinir (veritabanında cascade); diskteki PDF'ler ve profil fotoğrafı da. */
  async deleteAccount(userId: string, password: string): Promise<void> {
    await this.verified(userId, password, "Şifren hatalı.");
    const books = await this.prisma.questionBook.findMany({ where: { userId }, select: { id: true } });
    await this.prisma.user.delete({ where: { id: userId } });
    await Promise.all([...books.map((b) => removeBookFiles(b.id)), rm(avatarFile(userId), { force: true })]);
  }

  /** Profil fotoğrafı: gövde tarayıcıda küçültülmüş ham JPEG'dir. */
  async saveAvatar(userId: string, body: NodeJS.ReadableStream): Promise<AuthUser> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of body) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
      size += buf.length;
      if (size > AVATAR_MAX_BYTES) throw new PayloadTooLargeException("Fotoğraf çok büyük.");
      chunks.push(buf);
    }
    const data = Buffer.concat(chunks);
    // JPEG imzası: FF D8 FF
    if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8 || data[2] !== 0xff) {
      throw new BadRequestException("Fotoğraf JPEG olarak gönderilmeli.");
    }
    await mkdir(AVATAR_DIR, { recursive: true });
    await writeFile(avatarFile(userId), data);
    const user = await this.prisma.user.update({ where: { id: userId }, data: { avatarUpdatedAt: new Date() } });
    return toAuthUser(user);
  }

  async removeAvatar(userId: string): Promise<AuthUser> {
    await rm(avatarFile(userId), { force: true });
    const user = await this.prisma.user.update({ where: { id: userId }, data: { avatarUpdatedAt: null } });
    return toAuthUser(user);
  }

  /** Fotoğraf dosyasının yolu; yüklenmemişse 404. */
  async avatarPath(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatarUpdatedAt: true } });
    if (!user?.avatarUpdatedAt) throw new NotFoundException("Profil fotoğrafı yok.");
    return avatarFile(userId);
  }

  private async verified(userId: string, password: string, message: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) throw new BadRequestException(message);
    return user;
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
    theme: (user.theme as ThemePreference) ?? "system",
    // Sorgu dizesi yüklemeyle değişir; tarayıcı önbelleğindeki eski fotoğraf gösterilmez.
    avatarUrl: user.avatarUpdatedAt ? `/api/auth/me/avatar?v=${user.avatarUpdatedAt.getTime()}` : null,
    createdAt: user.createdAt.toISOString(),
  };
}
