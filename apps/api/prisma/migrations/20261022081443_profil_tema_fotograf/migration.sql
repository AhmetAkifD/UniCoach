-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'system';
