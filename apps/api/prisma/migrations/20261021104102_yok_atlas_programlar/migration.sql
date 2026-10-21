-- CreateTable
CREATE TABLE "Program" (
    "code" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "universityId" INTEGER NOT NULL,
    "universityName" TEXT NOT NULL,
    "universityType" TEXT NOT NULL,
    "cityCode" INTEGER NOT NULL,
    "cityName" TEXT NOT NULL,
    "faculty" TEXT,
    "name" TEXT NOT NULL,
    "groupId" INTEGER NOT NULL,
    "groupName" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "scoreType" TEXT NOT NULL,
    "language" TEXT,
    "educationTypeId" INTEGER,
    "educationType" TEXT,
    "scholarshipId" INTEGER NOT NULL,
    "scholarship" TEXT,
    "durationYears" INTEGER,
    "quota" INTEGER,
    "minScore" DOUBLE PRECISION,
    "rank" INTEGER,
    "history" JSONB NOT NULL,
    "minRankRequired" INTEGER,
    "fee" INTEGER,
    "conditions" INTEGER[],

    CONSTRAINT "Program_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "ProgramCondition" (
    "code" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "ProgramCondition_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "ProgramSync" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "count" INTEGER NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Program_scoreType_rank_idx" ON "Program"("scoreType", "rank");

-- CreateIndex
CREATE INDEX "Program_universityId_idx" ON "Program"("universityId");

-- CreateIndex
CREATE INDEX "Program_groupId_idx" ON "Program"("groupId");

-- CreateIndex
CREATE INDEX "Program_cityCode_idx" ON "Program"("cityCode");
