import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, createParamDecorator } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { SESSION_COOKIE, type AuthUser } from "@unicoach/shared";
import type { Request } from "express";
import { AuthService, type JwtPayload } from "./auth.service";

type AuthedRequest = Request & { user?: AuthUser };

/**
 * Belirteci `Authorization: Bearer` başlığından (mobil, web sunucusu) ya da
 * `uc_session` çerezinden (tarayıcı → /api rewrite) okur.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = bearerToken(req) ?? cookieToken(req);
    if (!token) throw new UnauthorizedException("Bu işlem için giriş yapmalısın.");

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException("Oturumun sona ermiş. Lütfen tekrar giriş yap.");
    }

    const user = await this.auth.findUser(payload.sub);
    if (!user) throw new UnauthorizedException("Oturumun sona ermiş. Lütfen tekrar giriş yap.");
    req.user = user;
    return true;
  }
}

/** AuthGuard'dan geçen isteğin kullanıcısı. */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthedRequest>().user,
);

function bearerToken(req: Request): string | undefined {
  const [scheme, token] = req.headers.authorization?.split(" ") ?? [];
  return scheme === "Bearer" && token ? token : undefined;
}

function cookieToken(req: Request): string | undefined {
  for (const part of req.headers.cookie?.split(";") ?? []) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}
