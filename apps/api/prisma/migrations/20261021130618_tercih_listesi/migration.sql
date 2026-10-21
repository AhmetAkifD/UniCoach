-- CreateTable
CREATE TABLE "Preference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "programCode" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Preference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Preference_userId_position_idx" ON "Preference"("userId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Preference_userId_programCode_key" ON "Preference"("userId", "programCode");

-- AddForeignKey
ALTER TABLE "Preference" ADD CONSTRAINT "Preference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
