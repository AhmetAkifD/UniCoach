import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Exam, ExamQuestion as ExamQuestionRow, QuestionBook } from "@prisma/client";
import {
  EXAM_MAX_QUESTIONS,
  examNet,
  solvedToday,
  findSubject,
  type ChoiceLetter,
  type CreateExamInput,
  type ExamAnswerInput,
  type ExamDetail,
  type ExamQuestion,
  type ExamSummary,
  type ExamTodayStats,
  type ExamTrack,
  type ExtendExamInput,
} from "@unicoach/shared";
import { PrismaService } from "../prisma/prisma.service";

/** Ağ gecikmesi yüzünden son saniyede gelen cevaplar kaybolmasın diye süre bu kadar esnetilir. */
const GRACE_MS = 15_000;

type ExamRow = Exam & { book: Pick<QuestionBook, "title">; questions: ExamQuestionRow[] };

@Injectable()
export class ExamsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<ExamSummary[]> {
    const exams = await this.prisma.exam.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      include: { book: { select: { title: true } }, questions: true },
    });
    const settled = await Promise.all(exams.map((e) => this.finishIfExpired(e)));
    return settled.map(toSummary);
  }

  /** Bugün cevaplanan sorular (sunucu öğrencinin bilgisayarında çalıştığı için yerel gün onunkidir). */
  async today(userId: string): Promise<ExamTodayStats> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const questions = await this.prisma.examQuestion.findMany({
      where: { exam: { userId }, answer: { not: null }, answeredAt: { gte: start } },
      select: { answer: true, answeredAt: true },
    });
    return { solved: solvedToday(questions, now) };
  }

  async get(userId: string, id: string): Promise<ExamDetail> {
    const exam = await this.finishIfExpired(await this.find(userId, id));
    return toDetail(exam);
  }

  /** Seçilen testlerin cevabı girilmiş soruları PDF sırasıyla kopyalanır. */
  async create(userId: string, input: CreateExamInput): Promise<ExamDetail> {
    const book = await this.prisma.questionBook.findFirst({
      where: { id: input.bookId, userId, uploadedAt: { not: null } },
      include: { user: { select: { examTrack: true } } },
    });
    if (!book) throw new NotFoundException("PDF bulunamadı.");
    const questions = await this.prisma.bookQuestion.findMany({
      where: { bookId: book.id, section: { in: input.sections }, answer: { not: null } },
      orderBy: { position: "asc" },
    });
    if (!questions.length) throw new BadRequestException("Seçtiğin testlerde cevabı girilmiş soru yok.");
    if (questions.length > EXAM_MAX_QUESTIONS) {
      throw new BadRequestException(`Bir sınavda en fazla ${EXAM_MAX_QUESTIONS} soru olabilir.`);
    }
    // Testler PDF'teki sırayla adlandırılır.
    const sections = [...new Set(questions.map((q) => q.section))];
    const track: ExamTrack = findSubject(book.subject)?.track ?? book.user.examTrack ?? "YKS";

    const exam = await this.prisma.exam.create({
      data: {
        userId,
        bookId: book.id,
        title: sections.join(", ").slice(0, 200),
        track,
        durationSec: input.durationMin === null ? null : input.durationMin * 60,
        questions: {
          create: questions.map((q, position) => ({
            position,
            bookQuestionId: q.id,
            section: q.section,
            number: q.number,
            page: q.page,
            x: q.x,
            y: q.y,
            w: q.w,
            h: q.h,
            choiceCount: q.choiceCount,
            correctAnswer: q.answer!,
          })),
        },
      },
      include: { book: { select: { title: true } }, questions: true },
    });
    return toDetail(exam);
  }

  /** Cevap kaydı; sınav bittiyse ya da süre dolduysa reddedilir (süre dolduysa sınav kapatılır). */
  async answer(userId: string, id: string, questionId: string, input: ExamAnswerInput): Promise<ExamQuestion> {
    const exam = await this.finishIfExpired(await this.find(userId, id));
    if (exam.finishedAt) throw new ConflictException("Sınav bitti; cevap değiştirilemez.");
    if (exam.pausedAt) throw new ConflictException("Sınav duraklatıldı; devam ettirip cevapla.");
    const question = exam.questions.find((q) => q.id === questionId);
    if (!question) throw new NotFoundException("Soru bulunamadı.");
    if (input.answer && "ABCDE".indexOf(input.answer) >= question.choiceCount) {
      throw new BadRequestException("Bu soruda o şık yok.");
    }
    const updated = await this.prisma.examQuestion.update({
      where: { id: question.id },
      data: { answer: input.answer, answeredAt: new Date() },
    });
    return toQuestion(updated, false);
  }

  async finish(userId: string, id: string): Promise<ExamDetail> {
    const exam = await this.find(userId, id);
    return toDetail(exam.finishedAt ? exam : await this.close(exam));
  }

  /** Süreyi durdurur (süreli ve bitmemiş sınavda). */
  async pause(userId: string, id: string): Promise<ExamDetail> {
    const exam = await this.finishIfExpired(await this.find(userId, id));
    if (exam.finishedAt || exam.durationSec === null || exam.pausedAt) return toDetail(exam);
    return toDetail(await this.save(exam, { pausedAt: new Date() }));
  }

  /** Süreyi yeniden başlatır; sorular kaynaktan okunur (sınav sırasında yapılan düzeltmeler yansısın). */
  async resume(userId: string, id: string): Promise<ExamDetail> {
    let exam = await this.find(userId, id);
    if (!exam.finishedAt) exam = await this.syncQuestions(exam);
    if (exam.finishedAt || !exam.pausedAt) return toDetail(await this.finishIfExpired(exam));
    const pausedMs = exam.pausedMs + (Date.now() - exam.pausedAt.getTime());
    return toDetail(await this.save(exam, { pausedAt: null, pausedMs }));
  }

  /** Ek süre (dakika). Duraklatılmışken de eklenebilir. */
  async extend(userId: string, id: string, input: ExtendExamInput): Promise<ExamDetail> {
    const exam = await this.finishIfExpired(await this.find(userId, id));
    if (exam.finishedAt) throw new ConflictException("Sınav bitti; süre eklenemez.");
    if (exam.durationSec === null) throw new BadRequestException("Süresiz sınava süre eklenmez.");
    return toDetail(await this.save(exam, { extraSec: exam.extraSec + input.minutes * 60 }));
  }

  /** Kaynaktaki düzeltmeleri sınava işler; sınav bittiyse sonuç yeniden hesaplanır. */
  async sync(userId: string, id: string): Promise<ExamDetail> {
    let exam = await this.syncQuestions(await this.find(userId, id));
    if (exam.finishedAt) exam = await this.score(exam, exam.finishedAt);
    return toDetail(exam);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.find(userId, id);
    await this.prisma.exam.delete({ where: { id } });
  }

  private async find(userId: string, id: string): Promise<ExamRow> {
    const exam = await this.prisma.exam.findFirst({
      where: { id, userId },
      include: { book: { select: { title: true } }, questions: { orderBy: { position: "asc" } } },
    });
    if (!exam) throw new NotFoundException("Sınav bulunamadı.");
    return exam;
  }

  private async finishIfExpired(exam: ExamRow): Promise<ExamRow> {
    // Duraklatılmış sınavın süresi işlemez.
    if (exam.finishedAt || exam.durationSec === null || exam.pausedAt) return exam;
    return Date.now() > deadlineOf(exam)! + GRACE_MS ? this.close(exam) : exam;
  }

  private async save(exam: ExamRow, data: Partial<Pick<Exam, "pausedAt" | "pausedMs" | "extraSec">>): Promise<ExamRow> {
    const updated = await this.prisma.exam.update({ where: { id: exam.id }, data });
    return { ...exam, ...updated };
  }

  /**
   * Sorular kaynak sorudan yeniden kopyalanır (kutu, test, numara, doğru cevap). Kaynağı silinen ya da
   * cevabı kaldırılan sorular olduğu gibi kalır; öğrencinin cevabı korunur (artık o şık yoksa boşalır).
   */
  private async syncQuestions(exam: ExamRow): Promise<ExamRow> {
    const ids = exam.questions.flatMap((q) => (q.bookQuestionId ? [q.bookQuestionId] : []));
    const sources = new Map((await this.prisma.bookQuestion.findMany({ where: { id: { in: ids } } })).map((s) => [s.id, s]));
    const updates = exam.questions.flatMap((q) => {
      const s = q.bookQuestionId ? sources.get(q.bookQuestionId) : undefined;
      if (!s?.answer) return [];
      const data = {
        section: s.section,
        number: s.number,
        page: s.page,
        x: s.x,
        y: s.y,
        w: s.w,
        h: s.h,
        choiceCount: s.choiceCount,
        correctAnswer: s.answer,
        answer: q.answer && "ABCDE".indexOf(q.answer) < s.choiceCount ? q.answer : null,
      };
      const changed = (Object.keys(data) as (keyof typeof data)[]).some((k) => q[k] !== data[k]);
      return changed ? [this.prisma.examQuestion.update({ where: { id: q.id }, data })] : [];
    });
    if (!updates.length) return exam;
    await this.prisma.$transaction(updates);
    return this.find(exam.userId, exam.id);
  }

  /** Sınavı kapatır: doğru, yanlış, boş ve net hesaplanır. */
  private async close(exam: ExamRow): Promise<ExamRow> {
    // Bitiş anı süreyi aşmaz (süre dolduktan sonra açılan sayfada da doğru görünsün); duraklatılmışken
    // bitirilirse süre duraklatma anında durmuş sayılır.
    const end = exam.pausedAt ? exam.pausedAt.getTime() : Date.now();
    const finishedAt = new Date(Math.min(end, deadlineOf(exam) ?? Infinity));
    const resumed = exam.pausedAt ? await this.save(exam, { pausedAt: null }) : exam;
    return this.score(resumed, finishedAt);
  }

  /** Doğru, yanlış, boş ve net hesaplanıp kaydedilir. */
  private async score(exam: ExamRow, finishedAt: Date): Promise<ExamRow> {
    const correct = exam.questions.filter((q) => q.answer && q.answer === q.correctAnswer).length;
    const wrong = exam.questions.filter((q) => q.answer && q.answer !== q.correctAnswer).length;
    const blank = exam.questions.length - correct - wrong;
    const net = examNet(correct, wrong, exam.track);
    const updated = await this.prisma.exam.update({
      where: { id: exam.id },
      data: { finishedAt, correct, wrong, blank, net },
    });
    return { ...exam, ...updated };
  }
}

/** Süreli sınavın bitiş anı (ms): başlangıç + süre + ek süre + duraklatmalar. */
function deadlineOf(exam: Exam): number | null {
  if (exam.durationSec === null) return null;
  return exam.startedAt.getTime() + (exam.durationSec + exam.extraSec) * 1000 + exam.pausedMs;
}

function toSummary(exam: ExamRow): ExamSummary {
  return {
    id: exam.id,
    bookId: exam.bookId,
    bookTitle: exam.book.title,
    title: exam.title,
    track: exam.track,
    questionCount: exam.questions.length,
    durationSec: exam.durationSec,
    startedAt: exam.startedAt.toISOString(),
    finishedAt: exam.finishedAt?.toISOString() ?? null,
    extraSec: exam.extraSec,
    deadline: exam.durationSec === null ? null : new Date(deadlineOf(exam)!).toISOString(),
    pausedAt: exam.pausedAt?.toISOString() ?? null,
    pausedSec: Math.round(exam.pausedMs / 1000),
    answeredCount: exam.questions.filter((q) => q.answer).length,
    correct: exam.correct,
    wrong: exam.wrong,
    blank: exam.blank,
    net: exam.net,
  };
}

function toDetail(exam: ExamRow): ExamDetail {
  const finished = !!exam.finishedAt;
  return {
    ...toSummary(exam),
    questions: [...exam.questions].sort((a, b) => a.position - b.position).map((q) => toQuestion(q, finished)),
    now: new Date().toISOString(),
  };
}

/** Doğru cevap yalnızca sınav bittikten sonra gönderilir. */
function toQuestion(q: ExamQuestionRow, reveal: boolean): ExamQuestion {
  return {
    id: q.id,
    position: q.position,
    bookQuestionId: q.bookQuestionId,
    section: q.section,
    number: q.number,
    page: q.page,
    x: q.x,
    y: q.y,
    w: q.w,
    h: q.h,
    choiceCount: q.choiceCount,
    answer: (q.answer as ChoiceLetter | null) ?? null,
    correctAnswer: reveal ? (q.correctAnswer as ChoiceLetter) : null,
  };
}
