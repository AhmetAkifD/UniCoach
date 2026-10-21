import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ExamsController } from "./exams.controller";
import { ExamsService } from "./exams.service";

@Module({
  imports: [AuthModule],
  controllers: [ExamsController],
  providers: [ExamsService],
})
export class ExamsModule {}
