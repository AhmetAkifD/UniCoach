import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Notebook, NotebookPage, Prisma } from "@prisma/client";
import {
  applyNotePageDiff,
  EMPTY_NOTE_PAGE,
  NOTEBOOK_MAX_PAGES,
  notePageContentSchema,
  type NotePageDiff,
  type NotebookDetail,
  type NotebookSummary,
  type NotePage,
  type NotePageContent,
  type NotePageRef,
} from "@unicoach/shared";
import { PrismaService } from "../prisma/prisma.service";

type NotebookRow = Notebook & { pages: Pick<NotebookPage, "id" | "position" | "updatedAt">[] };

const pageRefs = { select: { id: true, position: true, updatedAt: true }, orderBy: { position: "asc" } } as const;

@Injectable()
export class NotebooksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<NotebookSummary[]> {
    const rows = await this.prisma.notebook.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { pages: true } } },
    });
    return rows.map((n) => ({ id: n.id, title: n.title, pageCount: n._count.pages, updatedAt: n.updatedAt.toISOString() }));
  }

  async get(userId: string, id: string): Promise<NotebookDetail> {
    return toDetail(await this.find(userId, id));
  }

  /** Yeni defter boş bir sayfayla açılır. */
  /** `ids` telefonda çevrimdışı açılan defterde verilir (kimlikleri telefon üretir). */
  async create(userId: string, title: string, ids?: { id: string; pageId: string }): Promise<NotebookDetail> {
    const row = await this.prisma.notebook.create({
      data: {
        ...(ids && { id: ids.id }),
        userId,
        title,
        pages: { create: { ...(ids && { id: ids.pageId }), position: 1, content: EMPTY_NOTE_PAGE as Prisma.InputJsonValue } },
      },
      include: { pages: pageRefs },
    });
    return toDetail(row);
  }

  async rename(userId: string, id: string, title: string): Promise<NotebookDetail> {
    await this.find(userId, id);
    const row = await this.prisma.notebook.update({ where: { id }, data: { title }, include: { pages: pageRefs } });
    return toDetail(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.notebook.deleteMany({ where: { id, userId } });
    if (!count) throw new NotFoundException("Defter bulunamadı.");
  }

  async page(userId: string, id: string, pageId: string): Promise<NotePage> {
    await this.find(userId, id);
    const page = await this.prisma.notebookPage.findFirst({ where: { id: pageId, notebookId: id } });
    if (!page) throw new NotFoundException("Sayfa bulunamadı.");
    return {
      id: page.id,
      position: page.position,
      updatedAt: page.updatedAt.toISOString(),
      content: page.content as unknown as NotePageContent,
    };
  }

  /**
   * Verilen sayfanın arkasına (yoksa en sona) boş sayfa ekler. Telefondan gelen eşitlemede (`pageId` verilir) arkasına
   * eklenecek sayfa bu arada başka cihazda silinmişse sayfa en sona eklenir.
   */
  async addPage(userId: string, id: string, afterPageId: string | null, pageId?: string): Promise<NotebookDetail> {
    const notebook = await this.find(userId, id);
    if (notebook.pages.length >= NOTEBOOK_MAX_PAGES) {
      throw new BadRequestException(`Bir defterde en fazla ${NOTEBOOK_MAX_PAGES} sayfa olabilir.`);
    }
    const after = afterPageId ? notebook.pages.find((p) => p.id === afterPageId) : null;
    if (afterPageId && !after && !pageId) throw new NotFoundException("Sayfa bulunamadı.");
    const position = after ? after.position + 1 : notebook.pages.length + 1;
    await this.prisma.$transaction([
      this.prisma.notebookPage.updateMany({
        where: { notebookId: id, position: { gte: position } },
        data: { position: { increment: 1 } },
      }),
      this.prisma.notebookPage.create({
        data: { ...(pageId && { id: pageId }), notebookId: id, position, content: EMPTY_NOTE_PAGE as Prisma.InputJsonValue },
      }),
      this.prisma.notebook.update({ where: { id }, data: { updatedAt: new Date() } }),
    ]);
    return this.get(userId, id);
  }

  /**
   * Sayfayı kaydeder: `content` bütün sayfayı yazar, `diff` sunucudaki sayfayla birleştirilir (başka cihazda bu arada
   * eklenenler korunur). Birleştirme satır kilidiyle yapılır; aynı anda gelen iki fark birbirini ezmez.
   */
  async savePage(
    userId: string,
    id: string,
    pageId: string,
    input: { content?: NotePageContent; diff?: NotePageDiff },
  ): Promise<NotePageRef> {
    await this.find(userId, id);
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ content: unknown }[]>`
        SELECT content FROM "NotebookPage" WHERE id = ${pageId} AND "notebookId" = ${id} FOR UPDATE`;
      if (!locked.length) throw new NotFoundException("Sayfa bulunamadı.");
      let content = input.content;
      if (input.diff) {
        const merged = notePageContentSchema.safeParse(applyNotePageDiff(locked[0]!.content as NotePageContent, input.diff));
        if (!merged.success) throw new BadRequestException("Sayfa çok doldu; yeni bir sayfaya devam et.");
        content = merged.data;
      }
      await tx.notebookPage.update({ where: { id: pageId }, data: { content: content as unknown as Prisma.InputJsonValue } });
    });
    const [page] = await this.prisma.$transaction([
      this.prisma.notebookPage.findUniqueOrThrow({ where: { id: pageId } }),
      this.prisma.notebook.update({ where: { id }, data: { updatedAt: new Date() } }),
    ]);
    return { id: page.id, position: page.position, updatedAt: page.updatedAt.toISOString() };
  }

  /** Son sayfa silinemez; sıra numaraları boşluksuz kalır. */
  async removePage(userId: string, id: string, pageId: string): Promise<NotebookDetail> {
    const notebook = await this.find(userId, id);
    const page = notebook.pages.find((p) => p.id === pageId);
    if (!page) throw new NotFoundException("Sayfa bulunamadı.");
    if (notebook.pages.length === 1) throw new BadRequestException("Defterde en az bir sayfa kalmalı.");
    await this.prisma.$transaction([
      this.prisma.notebookPage.delete({ where: { id: pageId } }),
      this.prisma.notebookPage.updateMany({
        where: { notebookId: id, position: { gt: page.position } },
        data: { position: { decrement: 1 } },
      }),
      this.prisma.notebook.update({ where: { id }, data: { updatedAt: new Date() } }),
    ]);
    return this.get(userId, id);
  }

  private async find(userId: string, id: string): Promise<NotebookRow> {
    const row = await this.prisma.notebook.findFirst({ where: { id, userId }, include: { pages: pageRefs } });
    if (!row) throw new NotFoundException("Defter bulunamadı.");
    return row;
  }
}

function toDetail(row: NotebookRow): NotebookDetail {
  return {
    id: row.id,
    title: row.title,
    pageCount: row.pages.length,
    updatedAt: row.updatedAt.toISOString(),
    pages: row.pages.map((p) => ({ id: p.id, position: p.position, updatedAt: p.updatedAt.toISOString() })),
  };
}
