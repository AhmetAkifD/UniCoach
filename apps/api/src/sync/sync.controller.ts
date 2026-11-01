import { BadRequestException, Body, Controller, Get, HttpCode, Post, Query, UseGuards } from "@nestjs/common";
import { syncPushSchema, type AuthUser, type SyncPullResponse, type SyncPushInput, type SyncPushResponse } from "@unicoach/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import { SyncService } from "./sync.service";

/** Cihazlar arası eşitleme: telefon çevrimdışı kopyasını buradan günceller. */
@Controller("sync")
@UseGuards(AuthGuard)
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Get("pull")
  pull(@CurrentUser() user: AuthUser, @Query("since") since?: string): Promise<SyncPullResponse> {
    const n = since === undefined || since === "" ? 0 : Number(since);
    if (!Number.isSafeInteger(n) || n < 0) throw new BadRequestException("Geçersiz eşitleme noktası.");
    return this.sync.pull(user.id, n);
  }

  @Post("push")
  @HttpCode(200)
  push(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(syncPushSchema)) body: SyncPushInput): Promise<SyncPushResponse> {
    return this.sync.push(user.id, body.ops);
  }
}
