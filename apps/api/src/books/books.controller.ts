import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Req, Res, UseGuards } from "@nestjs/common";
import {
  bookProgressSchema,
  createBookSchema,
  saveBookQuestionsSchema,
  updateBookSchema,
  type AuthUser,
  type BookProgressInput,
  type BookQuestion,
  type BookSummary,
  type CreateBookInput,
  type SaveBookQuestionsInput,
  type UpdateBookInput,
} from "@unicoach/shared";
import type { Request, Response } from "express";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { BooksService } from "./books.service";

/** Soru Bankası PDF'leri. Her istek yalnızca giriş yapan öğrencinin PDF'lerine erişir. */
@Controller("books")
@UseGuards(AuthGuard)
export class BooksController {
  constructor(private readonly books: BooksService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<BookSummary[]> {
    return this.books.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createBookSchema)) body: CreateBookInput,
  ): Promise<BookSummary> {
    return this.books.create(user.id, body);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<BookSummary> {
    return this.books.get(user.id, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateBookSchema)) body: UpdateBookInput,
  ): Promise<BookSummary> {
    return this.books.update(user.id, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<void> {
    return this.books.remove(user.id, id);
  }

  @Put(":id/progress")
  saveProgress(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(bookProgressSchema)) body: BookProgressInput,
  ): Promise<BookSummary> {
    return this.books.saveProgress(user.id, id, body);
  }

  @Get(":id/questions")
  questions(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<BookQuestion[]> {
    return this.books.questions(user.id, id);
  }

  @Put(":id/questions")
  saveQuestions(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(saveBookQuestionsSchema)) body: SaveBookQuestionsInput,
  ): Promise<BookQuestion[]> {
    return this.books.saveQuestions(user.id, id, body);
  }

  /** Gövde ham PDF'tir (Content-Type: application/pdf); JSON gövde ayrıştırıcısına girmeden diske akıtılır. */
  @Put(":id/file")
  upload(@CurrentUser() user: AuthUser, @Param("id") id: string, @Req() req: Request): Promise<BookSummary> {
    const length = Number(req.headers["content-length"]);
    return this.books.upload(user.id, id, req, Number.isFinite(length) ? length : undefined);
  }

  /** PDF'i Range desteğiyle verir: görüntüleyici büyük dosyanın yalnızca gereken sayfalarını indirir. */
  @Get(":id/file")
  async file(@CurrentUser() user: AuthUser, @Param("id") id: string, @Res() res: Response): Promise<void> {
    const file = await this.books.file(user.id, id);
    res.sendFile(file.path, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(`${file.title}.pdf`)}`,
        "Cache-Control": "private, no-cache",
      },
    });
  }
}
