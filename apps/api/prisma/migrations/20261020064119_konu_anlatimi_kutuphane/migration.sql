-- CreateEnum
CREATE TYPE "ExamTrack" AS ENUM ('YKS', 'LGS');

-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('VIDEO', 'PLAYLIST');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "examTrack" "ExamTrack";

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "kind" "SourceKind" NOT NULL,
    "youtubeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "thumbnailUrl" TEXT,
    "truncated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceItem" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "videoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "durationSec" INTEGER,
    "positionSec" INTEGER NOT NULL DEFAULT 0,
    "watchedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Source_userId_subject_idx" ON "Source"("userId", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "Source_userId_kind_youtubeId_key" ON "Source"("userId", "kind", "youtubeId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceItem_sourceId_position_key" ON "SourceItem"("sourceId", "position");

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceItem" ADD CONSTRAINT "SourceItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
