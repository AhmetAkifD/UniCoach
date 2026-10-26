import { BadRequestException, Controller, Get, Query, UseGuards } from "@nestjs/common";
import type { AuthUser, SyncPullResponse } from "@unicoach/shared";
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
}
