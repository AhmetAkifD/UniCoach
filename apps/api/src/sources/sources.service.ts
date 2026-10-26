import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type Source, type SourceItem as SourceItemRow } from "@prisma/client";
import {
  PLAYLIST_MAX_ITEMS,
  WATCHED_THRESHOLD,
  type CreateSourceInput,
  type ProgressInput,
  type SourceDetail,
  type SourceItem,
  type SourceSummary,
  type UpdateSourceInput,
} from "@unicoach/shared";
import { PrismaService } from "../prisma/prisma.service";
import { fetchOEmbed, fetchVideoTitles, playlistUrl, videoUrl } from "./youtube";

@Injectable()
export class SourcesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<SourceSummary[]> {
    const sources = await this.prisma.source.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { items: true } } },
    });
    const watched = await this.prisma.sourceItem.groupBy({
      by: ["sourceId"],
      where: { source: { userId }, watchedAt: { not: null } },
      _count: { _all: true },
    });
    const watchedBySource = new Map(watched.map((w) => [w.sourceId, w._count._all]));
    // Son çalışma: izlenen ya da yarım kalan videoların son değişikliği (yeni eklenen videolar sayılmaz).
    const studied = await this.prisma.sourceItem.groupBy({
      by: ["sourceId"],
      where: { source: { userId }, OR: [{ watchedAt: { not: null } }, { positionSec: { gt: 0 } }] },
      _max: { updatedAt: true },
    });
    const studiedBySource = new Map(studied.map((s) => [s.sourceId, s._max.updatedAt]));
    return sources.map((s) => toSummary(s, s._count.items, watchedBySource.get(s.id) ?? 0, studiedBySource.get(s.id) ?? null));
  }

  async get(userId: string, id: string): Promise<SourceDetail> {
    const source = await this.prisma.source.findFirst({
      where: { id, userId },
      include: { items: { orderBy: { position: "asc" } } },
    });
    if (!source) throw new NotFoundException("Kaynak bulunamadı.");
    const watchedCount = source.items.filter((i) => i.watchedAt).length;
    const lastStudied = source.items
      .filter((i) => i.watchedAt || i.positionSec > 0)
      .reduce<Date | null>((max, i) => (!max || i.updatedAt > max ? i.updatedAt : max), null);
    return { ...toSummary(source, source.items.length, watchedCount, lastStudied), items: source.items.map(toItem) };
  }

  async create(userId: string, input: CreateSourceInput): Promise<SourceSummary> {
    const isPlaylist = input.kind === "PLAYLIST";
    const videoIds = isPlaylist ? input.videoIds!.slice(0, PLAYLIST_MAX_ITEMS) : [input.youtubeId];

    const [meta, titles] = await Promise.all([
      fetchOEmbed(isPlaylist ? playlistUrl(input.youtubeId) : videoUrl(input.youtubeId)),
      isPlaylist ? fetchVideoTitles(videoIds) : Promise.resolve(null),
    ]);
    if (!meta && !isPlaylist) {
      throw new BadRequestException("Bu video bulunamadı ya da yerleştirmeye kapalı.");
    }

    try {
      const source = await this.prisma.source.create({
        data: {
          userId,
          subject: input.subject,
          kind: input.kind,
          youtubeId: input.youtubeId,
          title: meta?.title ?? "Oynatma listesi",
          author: meta?.author ?? null,
          thumbnailUrl: meta?.thumbnailUrl ?? null,
          truncated: isPlaylist && videoIds.length >= PLAYLIST_MAX_ITEMS,
          items: {
            create: videoIds.map((videoId, position) => ({
              position,
              videoId,
              title: (titles ? titles[position]?.title : meta?.title) ?? `${position + 1}. video`,
            })),
          },
        },
      });
      return toSummary(source, videoIds.length, 0, null);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Bu kaynak zaten kütüphanende.");
      }
      throw err;
    }
  }

  async update(userId: string, id: string, input: UpdateSourceInput): Promise<SourceSummary> {
    await this.assertOwner(userId, id);
    await this.prisma.source.update({ where: { id }, data: input });
    const [summary] = (await this.list(userId)).filter((s) => s.id === id);
    return summary!;
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.assertOwner(userId, id);
    await this.prisma.source.delete({ where: { id } });
  }

  /**
   * İzleme ilerlemesini kaydeder. Video sonuna gelince ya da %90'ı geçince "izlendi" sayılır;
   * `watched: false` gönderilirse işaret kaldırılır.
   */
  async saveProgress(userId: string, sourceId: string, itemId: string, input: ProgressInput): Promise<SourceItem> {
    const item = await this.prisma.sourceItem.findFirst({ where: { id: itemId, sourceId, source: { userId } } });
    if (!item) throw new NotFoundException("Video bulunamadı.");

    const durationSec = input.durationSec ?? item.durationSec;
    const reachedEnd = durationSec ? input.positionSec >= durationSec * WATCHED_THRESHOLD : false;
    let watchedAt = item.watchedAt;
    if (input.watched === false) watchedAt = null;
    else if (!watchedAt && (input.watched || reachedEnd)) watchedAt = new Date();

    const updated = await this.prisma.sourceItem.update({
      where: { id: item.id },
      data: { positionSec: input.positionSec, durationSec, watchedAt },
    });
    return toItem(updated);
  }

  private async assertOwner(userId: string, id: string) {
    const exists = await this.prisma.source.count({ where: { id, userId } });
    if (!exists) throw new NotFoundException("Kaynak bulunamadı.");
  }
}

function toSummary(source: Source, itemCount: number, watchedCount: number, lastStudiedAt: Date | null): SourceSummary {
  return {
    id: source.id,
    subject: source.subject,
    kind: source.kind,
    youtubeId: source.youtubeId,
    title: source.title,
    author: source.author,
    thumbnailUrl: source.thumbnailUrl,
    itemCount,
    watchedCount,
    truncated: source.truncated,
    createdAt: source.createdAt.toISOString(),
    lastStudiedAt: lastStudiedAt?.toISOString() ?? null,
  };
}

function toItem(item: SourceItemRow): SourceItem {
  return {
    id: item.id,
    position: item.position,
    videoId: item.videoId,
    title: item.title,
    durationSec: item.durationSec,
    positionSec: item.positionSec,
    watchedAt: item.watchedAt?.toISOString() ?? null,
  };
}
