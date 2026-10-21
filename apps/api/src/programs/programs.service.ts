import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import type { Prisma, Program as ProgramRow } from "@prisma/client";
import type {
  ProgramFilterOptions,
  ProgramHistory,
  ProgramLevel,
  ProgramPage,
  ProgramSearchInput,
  ProgramSnapshot,
  ProgramSummary,
  ResultScoreType,
  UniversityType,
} from "@unicoach/shared";
import { PrismaService } from "../prisma/prisma.service";
import {
  atlasCities,
  atlasGroups,
  atlasResultsAnnounced,
  atlasSearch,
  atlasUniversities,
  scoreTypeOf,
  toProgram,
} from "./atlas.client";

/** Bir istekte çekilen program sayısı (tüm kılavuz ~22 istek) */
const SYNC_PAGE_SIZE = 1000;

@Injectable()
export class ProgramsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProgramsService.name);
  private syncing: Promise<ProgramSnapshot> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** Hiç indirilmemişse (ör. Docker'da ilk açılış) arka planda indirilir; hata API'yi durdurmaz. */
  onApplicationBootstrap() {
    if (process.env.ATLAS_AUTO_SYNC === "false") return;
    void this.prisma.programSync
      .count()
      .then((n) => (n ? null : this.sync()))
      .catch((err: Error) => this.logger.warn(`YÖK Atlas verisi indirilemedi: ${err.message}`));
  }

  async snapshot(): Promise<ProgramSnapshot | null> {
    const last = await this.prisma.programSync.findFirst({ orderBy: { finishedAt: "desc" } });
    return last ? { year: last.year, count: last.count, syncedAt: last.finishedAt.toISOString() } : null;
  }

  /** Tüm kılavuzu indirip tabloyu baştan yazar. Aynı anda ikinci indirme başlatılmaz. */
  sync(): Promise<ProgramSnapshot> {
    this.syncing ??= this.runSync().finally(() => (this.syncing = null));
    return this.syncing;
  }

  get isSyncing() {
    return this.syncing !== null;
  }

  private async runSync(): Promise<ProgramSnapshot> {
    const started = Date.now();
    this.logger.log("YÖK Atlas verisi indiriliyor…");
    const announced = await atlasResultsAnnounced();
    const programs: Prisma.ProgramCreateManyInput[] = [];
    const conditions = new Map<number, string>();
    let total = Infinity;
    for (let page = 0; page * SYNC_PAGE_SIZE < total; page++) {
      const res = await atlasSearch({ page, size: SYNC_PAGE_SIZE });
      total = res.totalElements;
      if (!res.content.length) break;
      for (const row of res.content) {
        for (const item of row.kosulList ?? []) {
          for (const [code, text] of Object.entries(item)) conditions.set(Number(code), text);
        }
        const p = toProgram(row, announced);
        if (!p) continue;
        programs.push({
          code: p.code,
          year: p.year,
          universityId: p.universityId,
          universityName: p.universityName,
          universityType: p.universityType,
          cityCode: row.ilKodu ?? null,
          cityName: p.cityName,
          faculty: p.faculty,
          name: p.name,
          groupId: p.groupId,
          groupName: p.groupName,
          level: p.level,
          scoreType: p.scoreType,
          language: p.language,
          educationTypeId: row.ogrenimTuruId ?? null,
          educationType: p.educationType,
          scholarshipId: row.bursOraniId ?? 0,
          scholarship: p.scholarship,
          durationYears: p.durationYears,
          quota: p.quota,
          minScore: p.minScore,
          rank: p.rank,
          history: p.history as unknown as Prisma.InputJsonValue,
          minRankRequired: p.minRankRequired,
          fee: p.fee,
          conditions: (row.kosul ?? "")
            .split(",")
            .map((c) => Number(c.trim()))
            .filter((c) => Number.isInteger(c) && c > 0),
        });
      }
    }
    if (!programs.length) throw new Error("YÖK Atlas boş liste döndürdü.");
    const year = programs[0]!.year;

    const sync = await this.prisma.$transaction(
      async (tx) => {
        await tx.program.deleteMany();
        await tx.program.createMany({ data: programs, skipDuplicates: true });
        await tx.programCondition.deleteMany();
        await tx.programCondition.createMany({ data: [...conditions].map(([code, text]) => ({ code, text })) });
        return tx.programSync.create({ data: { year, count: programs.length } });
      },
      { timeout: 120_000 },
    );
    this.logger.log(`YÖK Atlas: ${programs.length} program indirildi (${Math.round((Date.now() - started) / 1000)} sn).`);
    return { year: sync.year, count: sync.count, syncedAt: sync.finishedAt.toISOString() };
  }

  /** Filtre seçenekleri: indirilmiş veriden; veri yoksa YÖK Atlas'tan. */
  async filters(): Promise<ProgramFilterOptions> {
    const snapshot = await this.snapshot();
    if (snapshot) {
      const [universities, groups, cities] = await Promise.all([
        this.prisma.program.findMany({
          distinct: ["universityId"],
          select: { universityId: true, universityName: true },
          orderBy: { universityName: "asc" },
        }),
        this.prisma.program.findMany({
          where: { groupId: { not: null } },
          distinct: ["groupId", "scoreType"],
          select: { groupId: true, groupName: true, scoreType: true },
          orderBy: { groupName: "asc" },
        }),
        this.prisma.program.findMany({
          where: { cityCode: { not: null } },
          distinct: ["cityCode"],
          select: { cityCode: true, cityName: true },
          orderBy: { cityName: "asc" },
        }),
      ]);
      return {
        universities: universities.map((u) => ({ id: u.universityId, name: u.universityName })),
        groups: groups.map((g) => ({ id: g.groupId!, name: g.groupName, scoreType: g.scoreType as ResultScoreType })),
        cities: cities.map((c) => ({ code: c.cityCode!, name: c.cityName! })),
        snapshot,
        syncing: this.isSyncing,
      };
    }
    const [universities, groups, cities] = await Promise.all([atlasUniversities(), atlasGroups(), atlasCities()]);
    return {
      universities: universities.map((u) => ({ id: u.universiteId, name: u.universiteAdi })),
      groups: groups.flatMap((g) => {
        const scoreType = scoreTypeOf(g.puanTuru);
        return scoreType ? [{ id: g.birimGrupId, name: g.birimGrupAdi, scoreType }] : [];
      }),
      cities: cities.map((c) => ({ code: c.ilKodu, name: c.ilAdi })),
      snapshot: null,
      syncing: this.isSyncing,
    };
  }

  /** Tek program: önce indirilmiş veride, yoksa canlı YÖK Atlas'ta. */
  async findByCode(code: number): Promise<ProgramSummary | null> {
    const row = await this.prisma.program.findUnique({ where: { code } });
    if (row) return toSummary(row);
    const [res, announced] = await Promise.all([atlasSearch({ code, page: 0, size: 1 }), atlasResultsAnnounced()]);
    const found = res.content.find((r) => r.kilavuzKodu === code);
    return found ? toProgram(found, announced) : null;
  }

  async search(input: ProgramSearchInput): Promise<ProgramPage> {
    if (input.source === "live") {
      const [res, announced] = await Promise.all([atlasSearch(input), atlasResultsAnnounced()]);
      return {
        source: "live",
        items: res.content.flatMap((row) => toProgram(row, announced) ?? []),
        total: res.totalElements,
        page: input.page,
        size: input.size,
      };
    }

    const where: Prisma.ProgramWhereInput = {
      scoreType: input.scoreType ?? undefined,
      universityId: input.universityIds.length ? { in: input.universityIds } : undefined,
      groupId: input.groupIds.length ? { in: input.groupIds } : undefined,
      cityCode: input.cityCodes.length ? { in: input.cityCodes } : undefined,
      level: input.level ?? undefined,
      universityType: input.universityType ?? undefined,
      scholarshipId: input.scholarshipId ?? undefined,
      educationTypeId: input.educationTypeId ?? undefined,
      // YÖK Atlas gibi: sıra aralığı verilince yerleşeni olmayan (sırası boş) programlar da listelenir.
      OR:
        input.minRank || input.maxRank
          ? [{ rank: { gte: input.minRank ?? undefined, lte: input.maxRank ?? undefined } }, { rank: null }]
          : undefined,
    };
    const [rows, total] = await Promise.all([
      this.prisma.program.findMany({
        where,
        // YÖK Atlas gibi: başarı sırasına göre, sırası olmayanlar sonda
        orderBy: [{ rank: { sort: "asc", nulls: "last" } }, { code: "asc" }],
        skip: input.page * input.size,
        take: input.size,
      }),
      this.prisma.program.count({ where }),
    ]);
    return { source: "local", items: rows.map(toSummary), total, page: input.page, size: input.size };
  }
}

export function toSummary(row: ProgramRow): ProgramSummary {
  return {
    code: row.code,
    year: row.year,
    universityId: row.universityId,
    universityName: row.universityName,
    universityType: row.universityType as UniversityType,
    cityName: row.cityName,
    faculty: row.faculty,
    name: row.name,
    groupId: row.groupId,
    groupName: row.groupName,
    level: row.level as ProgramLevel,
    scoreType: row.scoreType as ResultScoreType,
    language: row.language,
    educationType: row.educationType,
    scholarship: row.scholarship,
    durationYears: row.durationYears,
    quota: row.quota,
    minScore: row.minScore,
    rank: row.rank,
    history: row.history as unknown as ProgramHistory[],
    minRankRequired: row.minRankRequired,
    fee: row.fee,
  };
}
