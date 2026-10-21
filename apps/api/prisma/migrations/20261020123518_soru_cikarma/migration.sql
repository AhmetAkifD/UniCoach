-- CreateTable
CREATE TABLE "BookQuestion" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "page" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "w" DOUBLE PRECISION NOT NULL,
    "h" DOUBLE PRECISION NOT NULL,
    "choiceCount" INTEGER NOT NULL DEFAULT 5,
    "answer" TEXT,
    "choices" TEXT[],
    "position" INTEGER NOT NULL,

    CONSTRAINT "BookQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookQuestion_bookId_position_idx" ON "BookQuestion"("bookId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "BookQuestion_bookId_section_number_key" ON "BookQuestion"("bookId", "section", "number");

-- AddForeignKey
ALTER TABLE "BookQuestion" ADD CONSTRAINT "BookQuestion_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "QuestionBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
