-- AlterTable
ALTER TABLE "QuestionBook" ADD COLUMN     "detectMethod" TEXT NOT NULL DEFAULT 'auto',
ADD COLUMN     "keyMethod" TEXT NOT NULL DEFAULT 'auto';
