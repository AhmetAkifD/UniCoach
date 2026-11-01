import { readFileSync } from "node:fs";
import path from "node:path";
import { Controller, Get } from "@nestjs/common";
import type { HealthResponse } from "@unicoach/shared";
import { PrismaService } from "../prisma/prisma.service";

/** apps/api/package.json'daki sürüm (npm dışında — Docker, kurulum betiği — çalışınca npm_package_version boştur). */
const VERSION = (() => {
  try {
    return (JSON.parse(readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf8")) as { version?: string }).version ?? "?";
  } catch {
    return "?";
  }
})();

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthResponse> {
    return {
      status: "ok",
      database: (await this.prisma.isHealthy()) ? "up" : "down",
      version: VERSION,
      time: new Date().toISOString(),
    };
  }
}
