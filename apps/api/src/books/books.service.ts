import { createWriteStream } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from "@nestjs/common";
import type { QuestionBook } from "@prisma/client";
import {
  BOOK_MAX_BYTES,
  type BookProgressInput,
  type BookSummary,
  type CreateBookInput,
  type UpdateBookInput,
} from "@unicoach/shared";
import type { Readable } from "node:stream";
import { PrismaService } from "../prisma/prisma.service";

/** PDF'lerin tutulduğu dizin. Docker'da bir volume'a bağlanır (docker-compose.yml → uploads). */
const BOOKS_DIR = path.join(path.resolve(process.env.UPLOAD_DIR ?? "storage"), "books");
/** Kaydı açılıp dosyası hiç gelmeyen (yarıda kalmış) yüklemeler bu süreden sonra silinir. */
const STALE_UPLOAD_MS = 60 * 60 * 1000;
const PDF_MAGIC = "%PDF-";

@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<BookSummary[]> {
    await this.removeStaleUploads(userId);
    const books = await this.prisma.questionBook.findMany({
      where: { userId, uploadedAt: { not: null } },
      orderBy: { createdAt: "desc" },
    });
    return books.map(toSummary);
  }

  async get(userId: string, id: string): Promise<BookSummary> {
    return toSummary(await this.findUploaded(userId, id));
  }

  /** Yüklemenin ilk adımı: kayıt açılır, dosya ardından `upload` ile gelir. */
  async create(userId: string, input: CreateBookInput): Promise<BookSummary> {
    const book = await this.prisma.questionBook.create({
      data: {
        userId,
        subject: input.subject,
        title: input.title,
        topic: input.topic ?? null,
        sizeBytes: input.sizeBytes,
      },
    });
    return toSummary(book);
  }

  /** Ham PDF gövdesini diske yazar. 300 MB'ı aşan ya da PDF olmayan dosya reddedilir. */
  async upload(userId: string, id: string, body: Readable, contentLength?: number): Promise<BookSummary> {
    const book = await this.prisma.questionBook.findFirst({ where: { id, userId } });
    if (!book) throw new NotFoundException("PDF bulunamadı.");
    if (book.uploadedAt) throw new ConflictException("Bu PDF zaten yüklendi.");
    if (contentLength && contentLength > BOOK_MAX_BYTES) throw tooLarge();

    await mkdir(BOOKS_DIR, { recursive: true });
    const finalPath = filePath(id);
    const partPath = `${finalPath}.part`;
    let received = 0;
    let head = Buffer.alloc(0);

    const guard = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        received += chunk.length;
        if (received > BOOK_MAX_BYTES) return callback(tooLarge());
        if (head.length < PDF_MAGIC.length) {
          head = Buffer.concat([head, chunk]).subarray(0, PDF_MAGIC.length);
          if (head.length === PDF_MAGIC.length && head.toString("latin1") !== PDF_MAGIC) {
            return callback(new BadRequestException("Bu dosya bir PDF değil."));
          }
        }
        callback(null, chunk);
      },
    });

    try {
      await pipeline(body, guard, createWriteStream(partPath));
      if (head.toString("latin1") !== PDF_MAGIC) throw new BadRequestException("Bu dosya bir PDF değil.");
      await rename(partPath, finalPath);
    } catch (err) {
      await rm(partPath, { force: true });
      if (err instanceof HttpException) throw err;
      throw new BadRequestException("Yükleme yarıda kesildi.");
    }

    const updated = await this.prisma.questionBook.update({
      where: { id },
      data: { sizeBytes: received, uploadedAt: new Date() },
    });
    return toSummary(updated);
  }

  /** Dosyanın diskteki yolu ve indirme adı (yalnızca sahibi için). */
  async file(userId: string, id: string): Promise<{ path: string; title: string }> {
    const book = await this.findUploaded(userId, id);
    return { path: filePath(book.id), title: book.title };
  }

  async update(userId: string, id: string, input: UpdateBookInput): Promise<BookSummary> {
    await this.findUploaded(userId, id);
    const data = updateBookData(input);
    return toSummary(await this.prisma.questionBook.update({ where: { id }, data }));
  }

  async remove(userId: string, id: string): Promise<void> {
    const book = await this.prisma.questionBook.findFirst({ where: { id, userId } });
    if (!book) throw new NotFoundException("PDF bulunamadı.");
    await this.prisma.questionBook.delete({ where: { id } });
    await removeFiles(id);
  }

  async saveProgress(userId: string, id: string, input: BookProgressInput): Promise<BookSummary> {
    const book = await this.findUploaded(userId, id);
    const pageCount = input.pageCount ?? book.pageCount;
    const lastPage = pageCount ? Math.min(input.page, pageCount) : input.page;
    return toSummary(await this.prisma.questionBook.update({ where: { id }, data: { lastPage, pageCount } }));
  }

  private async findUploaded(userId: string, id: string): Promise<QuestionBook> {
    const book = await this.prisma.questionBook.findFirst({ where: { id, userId, uploadedAt: { not: null } } });
    if (!book) throw new NotFoundException("PDF bulunamadı.");
    return book;
  }

  private async removeStaleUploads(userId: string) {
    const stale = await this.prisma.questionBook.findMany({
      where: { userId, uploadedAt: null, createdAt: { lt: new Date(Date.now() - STALE_UPLOAD_MS) } },
      select: { id: true },
    });
    if (!stale.length) return;
    await this.prisma.questionBook.deleteMany({ where: { id: { in: stale.map((b) => b.id) } } });
    await Promise.all(stale.map((b) => removeFiles(b.id)));
  }
}

function filePath(id: string) {
  return path.join(BOOKS_DIR, `${id}.pdf`);
}

async function removeFiles(id: string) {
  await Promise.all([rm(filePath(id), { force: true }), rm(`${filePath(id)}.part`, { force: true })]);
}

function tooLarge() {
  return new PayloadTooLargeException("PDF en fazla 300 MB olabilir.");
}

/** zod dönüşümünden sonra boş konu null gelir; tanımsız alanlar değiştirilmez. */
function updateBookData(input: UpdateBookInput) {
  return {
    ...(input.title !== undefined && { title: input.title }),
    ...(input.subject !== undefined && { subject: input.subject }),
    ...(input.topic !== undefined && { topic: input.topic }),
  };
}

function toSummary(book: QuestionBook): BookSummary {
  return {
    id: book.id,
    subject: book.subject,
    title: book.title,
    topic: book.topic,
    sizeBytes: book.sizeBytes,
    pageCount: book.pageCount,
    lastPage: book.lastPage,
    createdAt: book.createdAt.toISOString(),
    updatedAt: book.updatedAt.toISOString(),
  };
}
