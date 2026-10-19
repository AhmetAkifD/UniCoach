import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
import {
  checkEmailSchema,
  loginSchema,
  registerSchema,
  type AuthResponse,
  type AuthUser,
  type CheckEmailInput,
  type CheckEmailResponse,
  type LoginInput,
  type RegisterInput,
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
}
