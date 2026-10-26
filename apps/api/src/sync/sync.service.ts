import { Injectable } from "@nestjs/common";
import type { ProgramSummary, SyncPullResponse, SyncRows, SyncTable } from "@unicoach/shared";
import { PrismaService } from "../prisma/prisma.service";
import { toSummary as toProgramSummary } from "../programs/programs.service";

/** Yazan işlemlerin paylaşımlı aldığı danışma kilidi (migration: cevrimdisi_esitleme). */
const SYNC_LOCK = 4242;

/** Veritabanı satırını eşitleme satırına çevirir: tarihler ISO, BigInt sayı, `userId` gönderilmez. */
function wire<T>(row: object): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === "userId") continue;
    out[key] = value instanceof Date ? value.toISOString() : typeof value === "bigint" ? Number(value) : value;
  }
  return out as T;
}

/**
 * Telefonun çevrimdışı kopyası için değişiklikler (packages/shared → sync.ts). `since`ten sonra eklenen, değişen ve
 * silinen satırlar; yalnızca isteyen öğrencinin satırları.
 */
@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  async pull(userId: string, since: number): Promise<SyncPullResponse> {
    const until = await this.safeCursor();
    const range = { gt: BigInt(since), lte: BigInt(until) };
    const p = this.prisma;
    const [sources, sourceItems, books, bookQuestions, exams, examQuestions, yksResults, preferences, notebooks, notebookPages, tombstones] =
      await Promise.all([
        p.source.findMany({ where: { userId, syncVersion: range } }),
        p.sourceItem.findMany({ where: { source: { userId }, syncVersion: range } }),
        // Yüklemesi bitmemiş PDF'ler gönderilmez (dosyası yok); bitince `uploadedAt` dolar ve satır yeniden gelir.
        p.questionBook.findMany({ where: { userId, uploadedAt: { not: null }, syncVersion: range } }),
        p.bookQuestion.findMany({ where: { book: { userId }, syncVersion: range } }),
        p.exam.findMany({ where: { userId, syncVersion: range } }),
        p.examQuestion.findMany({ where: { exam: { userId }, syncVersion: range } }),
        p.yksResult.findMany({ where: { userId, syncVersion: range } }),
        p.preference.findMany({ where: { userId, syncVersion: range } }),
        p.notebook.findMany({ where: { userId, syncVersion: range } }),
        p.notebookPage.findMany({ where: { notebook: { userId }, syncVersion: range } }),
        p.syncTombstone.findMany({ where: { userId, syncVersion: range }, orderBy: { syncVersion: "asc" } }),
      ]);

    // Tercihler: program indirilmiş veride varsa güncel hâli, yoksa eklendiği andaki hâli (PreferencesService.list gibi).
    const current = preferences.length
      ? await p.program.findMany({ where: { code: { in: preferences.map((r) => r.programCode) } } })
      : [];
    const programs = new Map(current.map((row) => [row.code, toProgramSummary(row)]));

    const rows: SyncRows = {
      sources: sources.map((r) => wire(r)),
      sourceItems: sourceItems.map((r) => wire(r)),
      books: books.map((r) => wire(r)),
      bookQuestions: bookQuestions.map((r) => wire(r)),
      exams: exams.map((r) => wire(r)),
      examQuestions: examQuestions.map((r) => wire(r)),
      yksResults: yksResults.map((r) => wire(r)),
      preferences: preferences.map(({ snapshot, ...r }) =>
        wire({ ...r, program: programs.get(r.programCode) ?? (snapshot as unknown as ProgramSummary) }),
      ),
      notebooks: notebooks.map((r) => wire(r)),
      notebookPages: notebookPages.map((r) => wire(r)),
    };
    return {
      cursor: until,
      rows,
      deleted: tombstones.map((t) => ({ table: t.table as SyncTable, id: t.rowId })),
      serverTime: new Date().toISOString(),
    };
  }

  /**
   * Gönderilebilecek en büyük numara. Kilit özel alınınca numara almış bütün yazma işlemleri bitmiş olur; bu yüzden
   * bu değerin altında sonradan görünecek (geç commit edilen) bir değişiklik kalmaz.
   */
  private async safeCursor(): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SYNC_LOCK}::bigint)`;
      const [row] = await tx.$queryRaw<{ last_value: bigint; is_called: boolean }[]>`SELECT last_value, is_called FROM sync_version`;
      return row && row.is_called ? Number(row.last_value) : 0;
    });
  }
}
