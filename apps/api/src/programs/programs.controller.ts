import { Body, Controller, ForbiddenException, Get, HttpCode, Logger, Post, UseGuards } from "@nestjs/common";
import {
  programSearchSchema,
  type AuthUser,
  type ProgramFilterOptions,
  type ProgramPage,
  type ProgramSearchInput,
} from "@unicoach/shared";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ProgramsService } from "./programs.service";

/** YKS Tercih: üniversite programları (YÖK Atlas). */
@Controller("programs")
@UseGuards(AuthGuard)
export class ProgramsController {
  private readonly logger = new Logger(ProgramsController.name);

  constructor(private readonly programs: ProgramsService) {}

  @Get("filters")
  filters(): Promise<ProgramFilterOptions> {
    return this.programs.filters();
  }

  @Post("search")
  @HttpCode(200)
  search(@Body(new ZodValidationPipe(programSearchSchema)) body: ProgramSearchInput): Promise<ProgramPage> {
    return this.programs.search(body);
  }

  /** Yalnızca admin: indirmeyi başlatır, bitmesini beklemez (durum `filters().syncing` ile izlenir). */
  @Post("sync")
  @HttpCode(202)
  sync(@CurrentUser() user: AuthUser): void {
    if (user.role !== "ADMIN") throw new ForbiddenException("Veriyi yalnızca admin güncelleyebilir.");
    void this.programs.sync().catch((err: Error) => this.logger.warn(`YÖK Atlas verisi indirilemedi: ${err.message}`));
  }
}
