import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { BooksModule } from "./books/books.module";
import { ExamsModule } from "./exams/exams.module";
import { ProgramsModule } from "./programs/programs.module";
import { ResultsModule } from "./results/results.module";
import { SourcesModule } from "./sources/sources.module";
import { HealthController } from "./health/health.controller";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, SourcesModule, BooksModule, ExamsModule, ResultsModule, ProgramsModule],
  controllers: [HealthController],
})
export class AppModule {}
