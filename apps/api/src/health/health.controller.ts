import { Controller, Get } from "@nestjs/common";
import type { HealthResponse } from "@unicoach/shared";
import { PrismaService } from "../prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthResponse> {
    return {
      status: "ok",
      database: (await this.prisma.isHealthy()) ? "up" : "down",
      version: process.env.npm_package_version ?? "0.1.0",
      time: new Date().toISOString(),
    };
  }
}
