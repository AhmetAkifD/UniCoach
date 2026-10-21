import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Soru Bankası'nda bir PDF'in tüm soruları (şık metinleriyle) tek istekte kaydedilir; varsayılan 100 KB yetmez.
  app.useBodyParser("json", { limit: "5mb" });

  // Tüm uç noktalar /api altında: web (Next.js rewrite) ve mobil aynı yolu kullanır.
  app.setGlobalPrefix("api");
  app.enableCors({
    origin: (process.env.WEB_ORIGIN ?? "http://localhost:3000").split(","),
    credentials: true,
  });
  app.enableShutdownHooks();

  const port = Number(process.env.API_PORT ?? 4000);
  // 300 MB'lık PDF yavaş bağlantıda Node'un 5 dakikalık varsayılan istek süresini aşabilir.
  app.getHttpServer().requestTimeout = 60 * 60 * 1000;
  await app.listen(port, "0.0.0.0");
  Logger.log(`UniCoach API http://localhost:${port}/api adresinde çalışıyor`, "Bootstrap");
}

void bootstrap();
