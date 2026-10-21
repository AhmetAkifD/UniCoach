import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PREFERENCE_MAX, type PreferenceItem, type ProgramSummary } from "@unicoach/shared";
import { PrismaService } from "../prisma/prisma.service";
import { ProgramsService, toSummary } from "../programs/programs.service";

@Injectable()
export class PreferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly programs: ProgramsService,
  ) {}

  /** Program bilgisi indirilmiş veride varsa oradan (güncel), yoksa eklendiği andaki hâlinden. */
  async list(userId: string): Promise<PreferenceItem[]> {
    const rows = await this.prisma.preference.findMany({ where: { userId }, orderBy: { position: "asc" } });
    const current = await this.prisma.program.findMany({ where: { code: { in: rows.map((r) => r.programCode) } } });
    const byCode = new Map(current.map((p) => [p.code, toSummary(p)]));
    return rows.map((r, i) => ({
      position: i + 1,
      program: byCode.get(r.programCode) ?? (r.snapshot as unknown as ProgramSummary),
      addedAt: r.addedAt.toISOString(),
    }));
  }

  async add(userId: string, code: number): Promise<PreferenceItem[]> {
    const [count, exists] = await Promise.all([
      this.prisma.preference.count({ where: { userId } }),
      this.prisma.preference.findUnique({ where: { userId_programCode: { userId, programCode: code } } }),
    ]);
    if (exists) throw new ConflictException("Bu program zaten listende.");
    if (count >= PREFERENCE_MAX) {
      throw new BadRequestException(`Tercih listesine en fazla ${PREFERENCE_MAX} program ekleyebilirsin.`);
    }
    const program = await this.programs.findByCode(code);
    if (!program) throw new NotFoundException("Program bulunamadı.");
    await this.prisma.preference.create({
      data: { userId, programCode: code, position: count + 1, snapshot: program as unknown as Prisma.InputJsonValue },
    });
    return this.list(userId);
  }

  /** `codes` listedeki programların tamamı olmalı. */
  async reorder(userId: string, codes: number[]): Promise<PreferenceItem[]> {
    const rows = await this.prisma.preference.findMany({ where: { userId }, select: { programCode: true } });
    const saved = new Set(rows.map((r) => r.programCode));
    if (codes.length !== saved.size || codes.some((c) => !saved.has(c))) {
      throw new BadRequestException("Liste değişmiş; sayfayı yenileyip tekrar dene.");
    }
    await this.prisma.$transaction(
      codes.map((programCode, i) =>
        this.prisma.preference.update({
          where: { userId_programCode: { userId, programCode } },
          data: { position: i + 1 },
        }),
      ),
    );
    return this.list(userId);
  }

  async remove(userId: string, code: number): Promise<PreferenceItem[]> {
    const { count } = await this.prisma.preference.deleteMany({ where: { userId, programCode: code } });
    if (!count) throw new NotFoundException("Program listende yok.");
    // Sıra numaraları boşluksuz kalsın.
    const rest = await this.prisma.preference.findMany({ where: { userId }, orderBy: { position: "asc" } });
    await this.prisma.$transaction(
      rest.map((r, i) => this.prisma.preference.update({ where: { id: r.id }, data: { position: i + 1 } })),
    );
    return this.list(userId);
  }
}
