import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import {
  addNotePageSchema,
  notebookInputSchema,
  saveNotePageSchema,
  type AddNotePageInput,
  type AuthUser,
  type NotebookDetail,
  type NotebookInput,
  type NotebookSummary,
  type NotePage,
  type NotePageRef,
  type SaveNotePageInput,
} from "@unicoach/shared";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { NotebooksService } from "./notebooks.service";

/** Çalışma alanı: not defterleri. Her istek yalnızca giriş yapan öğrencinin defterlerine erişir. */
@Controller("notebooks")
@UseGuards(AuthGuard)
export class NotebooksController {
  constructor(private readonly notebooks: NotebooksService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<NotebookSummary[]> {
    return this.notebooks.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(notebookInputSchema)) body: NotebookInput,
  ): Promise<NotebookDetail> {
    return this.notebooks.create(user.id, body.title);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<NotebookDetail> {
    return this.notebooks.get(user.id, id);
  }

  @Patch(":id")
  rename(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(notebookInputSchema)) body: NotebookInput,
  ): Promise<NotebookDetail> {
    return this.notebooks.rename(user.id, id, body.title);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<void> {
    return this.notebooks.remove(user.id, id);
  }

  @Post(":id/pages")
  addPage(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(addNotePageSchema)) body: AddNotePageInput,
  ): Promise<NotebookDetail> {
    return this.notebooks.addPage(user.id, id, body.afterPageId);
  }

  @Get(":id/pages/:pageId")
  page(@CurrentUser() user: AuthUser, @Param("id") id: string, @Param("pageId") pageId: string): Promise<NotePage> {
    return this.notebooks.page(user.id, id, pageId);
  }

  @Put(":id/pages/:pageId")
  savePage(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("pageId") pageId: string,
    @Body(new ZodValidationPipe(saveNotePageSchema)) body: SaveNotePageInput,
  ): Promise<NotePageRef> {
    return this.notebooks.savePage(user.id, id, pageId, body.content);
  }

  @Delete(":id/pages/:pageId")
  removePage(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("pageId") pageId: string,
  ): Promise<NotebookDetail> {
    return this.notebooks.removePage(user.id, id, pageId);
  }
}
