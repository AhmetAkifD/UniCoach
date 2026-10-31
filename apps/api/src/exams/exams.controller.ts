import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, UseGuards } from "@nestjs/common";
import {
  createExamSchema,
  examAnswerSchema,
  extendExamSchema,
  type AuthUser,
  type CreateExamInput,
  type ExamAnswerInput,
  type ExamDetail,
  type ExamQuestion,
  type ExamSummary,
  type ExtendExamInput,
} from "@unicoach/shared";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ExamsService } from "./exams.service";

/** Sınavlar. Her istek yalnızca giriş yapan öğrencinin sınavlarına erişir. */
@Controller("exams")
@UseGuards(AuthGuard)
export class ExamsController {
  constructor(private readonly exams: ExamsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<ExamSummary[]> {
    return this.exams.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createExamSchema)) body: CreateExamInput,
  ): Promise<ExamDetail> {
    return this.exams.create(user.id, body);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<ExamDetail> {
    return this.exams.get(user.id, id);
  }

  @Put(":id/answers/:questionId")
  answer(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("questionId") questionId: string,
    @Body(new ZodValidationPipe(examAnswerSchema)) body: ExamAnswerInput,
  ): Promise<ExamQuestion> {
    return this.exams.answer(user.id, id, questionId, body);
  }

  @Post(":id/finish")
  @HttpCode(200)
  finish(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<ExamDetail> {
    return this.exams.finish(user.id, id);
  }

  @Post(":id/pause")
  @HttpCode(200)
  pause(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<ExamDetail> {
    return this.exams.pause(user.id, id);
  }

  @Post(":id/resume")
  @HttpCode(200)
  resume(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<ExamDetail> {
    return this.exams.resume(user.id, id);
  }

  @Post(":id/extend")
  @HttpCode(200)
  extend(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(extendExamSchema)) body: ExtendExamInput,
  ): Promise<ExamDetail> {
    return this.exams.extend(user.id, id, body);
  }

  @Post(":id/sync")
  @HttpCode(200)
  sync(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<ExamDetail> {
    return this.exams.sync(user.id, id);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<void> {
    return this.exams.remove(user.id, id);
  }
}
