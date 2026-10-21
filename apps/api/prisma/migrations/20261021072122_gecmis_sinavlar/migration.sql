-- DropIndex
DROP INDEX "BookQuestion_bookId_section_number_key";

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "track" "ExamTrack" NOT NULL,
    "durationSec" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "correct" INTEGER,
    "wrong" INTEGER,
    "blank" INTEGER,
    "net" DOUBLE PRECISION,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamQuestion" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "bookQuestionId" TEXT,
    "section" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "page" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "w" DOUBLE PRECISION NOT NULL,
    "h" DOUBLE PRECISION NOT NULL,
    "choiceCount" INTEGER NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "answer" TEXT,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "ExamQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Exam_userId_startedAt_idx" ON "Exam"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExamQuestion_examId_position_key" ON "ExamQuestion"("examId", "position");

-- CreateIndex
CREATE INDEX "BookQuestion_bookId_section_number_idx" ON "BookQuestion"("bookId", "section", "number");

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "QuestionBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_bookQuestionId_fkey" FOREIGN KEY ("bookQuestionId") REFERENCES "BookQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
