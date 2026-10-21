-- CreateTable
CREATE TABLE "QuestionBook" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "pageCount" INTEGER,
    "lastPage" INTEGER NOT NULL DEFAULT 1,
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionBook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionBook_userId_subject_idx" ON "QuestionBook"("userId", "subject");

-- AddForeignKey
ALTER TABLE "QuestionBook" ADD CONSTRAINT "QuestionBook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
