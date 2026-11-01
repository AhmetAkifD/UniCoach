import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotebooksController } from "./notebooks.controller";
import { NotebooksService } from "./notebooks.service";

@Module({
  imports: [AuthModule],
  controllers: [NotebooksController],
  providers: [NotebooksService],
  exports: [NotebooksService],
})
export class NotebooksModule {}
