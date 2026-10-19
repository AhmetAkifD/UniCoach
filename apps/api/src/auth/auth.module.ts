import { Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        let secret = config.get<string>("JWT_SECRET");
        if (!secret) {
          if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET ortam değişkeni tanımlı değil.");
          secret = "unicoach-dev-secret";
          Logger.warn("JWT_SECRET tanımlı değil; geliştirme anahtarı kullanılıyor.", "AuthModule");
        }
        return { secret, signOptions: { expiresIn: "7d" } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
