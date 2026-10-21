import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, YksResult as YksResultRow } from "@prisma/client";
import type { ResultSource, SaveYksResultInput, YksResult, YksScore, YksTest } from "@unicoach/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ResultsService {
  constructor(private readonly prisma: PrismaService) {}

  /** En yeni yıl önce */
  async list(userId: string): Promise<YksResult[]> {
    const rows = await this.prisma.yksResult.findMany({ where: { userId }, orderBy: { year: "desc" } });
    return rows.map(toResult);
  }

  /** Aynı yılın sonucu varsa üzerine yazılır. */
  async save(userId: string, year: number, input: SaveYksResultInput): Promise<YksResult> {
    const data = {
      source: input.source,
      diplomaGrade: input.diplomaGrade,
      obp: input.obp,
      scores: input.scores as Prisma.InputJsonValue,
      tests: input.tests as Prisma.InputJsonValue,
    };
    const row = await this.prisma.yksResult.upsert({
      where: { userId_year: { userId, year } },
      create: { userId, year, ...data },
      update: data,
    });
    return toResult(row);
  }

  async remove(userId: string, year: number): Promise<void> {
    const { count } = await this.prisma.yksResult.deleteMany({ where: { userId, year } });
    if (!count) throw new NotFoundException("Sonuç bulunamadı.");
  }
}

function toResult(row: YksResultRow): YksResult {
  return {
    id: row.id,
    year: row.year,
    source: row.source as ResultSource,
    diplomaGrade: row.diplomaGrade,
    obp: row.obp,
    scores: row.scores as unknown as YksScore[],
    tests: row.tests as unknown as YksTest[],
    updatedAt: row.updatedAt.toISOString(),
  };
}
