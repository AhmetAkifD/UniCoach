import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Put, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import {
  changePasswordSchema,
  checkEmailSchema,
  deleteAccountSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
  type AuthResponse,
  type AuthUser,
  type PairResponse,
  type ChangePasswordInput,
  type CheckEmailInput,
  type DeleteAccountInput,
  type CheckEmailResponse,
  type LoginInput,
  type RegisterInput,
  type UpdateProfileInput,
} from "@unicoach/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AuthGuard, CurrentUser } from "./auth.guard";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("check-email")
  @HttpCode(200)
  checkEmail(@Body(new ZodValidationPipe(checkEmailSchema)) body: CheckEmailInput): Promise<CheckEmailResponse> {
    return this.auth.checkEmail(body.email);
  }

  @Post("register")
  register(@Body(new ZodValidationPipe(registerSchema)) body: RegisterInput): Promise<AuthResponse> {
    return this.auth.register(body);
  }

  @Post("login")
  @HttpCode(200)
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput): Promise<AuthResponse> {
    return this.auth.login(body);
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  /** Telefonu eşleme (web Profil'deki QR kod): telefona oturum ve bu bilgisayarın yerel ağ adresleri. */
  @Post("pair")
  @HttpCode(200)
  @UseGuards(AuthGuard)
  pair(@CurrentUser() user: AuthUser): Promise<PairResponse> {
    return this.auth.pair(user.id);
  }

  @Patch("me")
  @UseGuards(AuthGuard)
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ): Promise<AuthUser> {
    return this.auth.updateProfile(user.id, body);
  }

  @Put("me/password")
  @HttpCode(204)
  @UseGuards(AuthGuard)
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordInput,
  ): Promise<void> {
    return this.auth.changePassword(user.id, body);
  }

  @Delete("me")
  @HttpCode(204)
  @UseGuards(AuthGuard)
  deleteAccount(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(deleteAccountSchema)) body: DeleteAccountInput,
  ): Promise<void> {
    return this.auth.deleteAccount(user.id, body.password);
  }

  /** Gövde ham JPEG'dir (Content-Type: image/jpeg); JSON ayrıştırıcısına girmez. */
  @Put("me/avatar")
  @UseGuards(AuthGuard)
  uploadAvatar(@CurrentUser() user: AuthUser, @Req() req: Request): Promise<AuthUser> {
    return this.auth.saveAvatar(user.id, req);
  }

  @Delete("me/avatar")
  @UseGuards(AuthGuard)
  removeAvatar(@CurrentUser() user: AuthUser): Promise<AuthUser> {
    return this.auth.removeAvatar(user.id);
  }

  @Get("me/avatar")
  @UseGuards(AuthGuard)
  async avatar(@CurrentUser() user: AuthUser, @Res() res: Response): Promise<void> {
    // Adres her yüklemede değiştiği için uzun süre önbellekte kalabilir.
    res.sendFile(await this.auth.avatarPath(user.id), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=31536000, immutable" },
    });
  }
}
