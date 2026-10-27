import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BooksModule } from "../books/books.module";
import { NotebooksModule } from "../notebooks/notebooks.module";
import { SourcesModule } from "../sources/sources.module";
import { SyncController } from "./sync.controller";
import { SyncService } from "./sync.service";

@Module({
  imports: [AuthModule, SourcesModule, BooksModule, NotebooksModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
