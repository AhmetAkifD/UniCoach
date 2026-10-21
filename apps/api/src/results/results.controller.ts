import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Put, UseGuards } from "@nestjs/common";
import { saveYksResultSchema, YKS_FIRST_YEAR, type AuthUser, type SaveYksResultInput, type YksResult } from "@unicoach/shared";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ResultsService } from "./results.service";

/** YKS Tercih: öğrencinin sınav sonuçları (yıl başına bir kayıt). */
@Controller("results")
@UseGuards(AuthGuard)
export class ResultsController {
  constructor(private readonly results: ResultsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<YksResult[]> {
    return this.results.list(user.id);
  }

  @Put(":year")
  save(
    @CurrentUser() user: AuthUser,
    @Param("year", ParseIntPipe) year: number,
    @Body(new ZodValidationPipe(saveYksResultSchema)) body: SaveYksResultInput,
  ): Promise<YksResult> {
    if (year < YKS_FIRST_YEAR || year > new Date().getFullYear()) throw new BadRequestException("Geçersiz sınav yılı.");
    return this.results.save(user.id, year, body);
  }

  @Delete(":year")
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param("year", ParseIntPipe) year: number): Promise<void> {
    return this.results.remove(user.id, year);
  }
}
