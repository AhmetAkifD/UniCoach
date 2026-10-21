-- CreateTable
CREATE TABLE "YksResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "diplomaGrade" DOUBLE PRECISION,
    "obp" DOUBLE PRECISION,
    "scores" JSONB NOT NULL,
    "tests" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YksResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "YksResult_userId_year_key" ON "YksResult"("userId", "year");

-- AddForeignKey
ALTER TABLE "YksResult" ADD CONSTRAINT "YksResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
