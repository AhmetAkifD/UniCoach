import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import {
  createSourceSchema,
  progressSchema,
  updateSourceSchema,
  type AuthUser,
  type CreateSourceInput,
  type ProgressInput,
  type SourceDetail,
  type SourceItem,
  type SourceSummary,
  type UpdateSourceInput,
} from "@unicoach/shared";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { SourcesService } from "./sources.service";

/** Konu Anlatımı kütüphanesi. Her istek yalnızca giriş yapan öğrencinin kaynaklarına erişir. */
@Controller("sources")
@UseGuards(AuthGuard)
export class SourcesController {
  constructor(private readonly sources: SourcesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<SourceSummary[]> {
    return this.sources.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createSourceSchema)) body: CreateSourceInput,
  ): Promise<SourceSummary> {
    return this.sources.create(user.id, body);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<SourceDetail> {
    return this.sources.get(user.id, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateSourceSchema)) body: UpdateSourceInput,
  ): Promise<SourceSummary> {
    return this.sources.update(user.id, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<void> {
    return this.sources.remove(user.id, id);
  }

  @Put(":id/items/:itemId/progress")
  saveProgress(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body(new ZodValidationPipe(progressSchema)) body: ProgressInput,
  ): Promise<SourceItem> {
    return this.sources.saveProgress(user.id, id, itemId, body);
  }
}
