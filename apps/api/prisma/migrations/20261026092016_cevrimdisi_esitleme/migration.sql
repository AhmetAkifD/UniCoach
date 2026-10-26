-- AlterTable
ALTER TABLE "BookQuestion" ADD COLUMN     "syncVersion" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "syncVersion" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ExamQuestion" ADD COLUMN     "syncVersion" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Notebook" ADD COLUMN     "syncVersion" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "NotebookPage" ADD COLUMN     "syncVersion" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Preference" ADD COLUMN     "syncVersion" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "QuestionBook" ADD COLUMN     "syncVersion" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Source" ADD COLUMN     "syncVersion" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SourceItem" ADD COLUMN     "syncVersion" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "YksResult" ADD COLUMN     "syncVersion" BIGINT NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SyncTombstone" (
    "id" BIGSERIAL NOT NULL,
    "table" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "syncVersion" BIGINT NOT NULL,

    CONSTRAINT "SyncTombstone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncTombstone_userId_syncVersion_idx" ON "SyncTombstone"("userId", "syncVersion");

-- CreateIndex
CREATE INDEX "BookQuestion_syncVersion_idx" ON "BookQuestion"("syncVersion");

-- CreateIndex
CREATE INDEX "Exam_syncVersion_idx" ON "Exam"("syncVersion");

-- CreateIndex
CREATE INDEX "ExamQuestion_syncVersion_idx" ON "ExamQuestion"("syncVersion");

-- CreateIndex
CREATE INDEX "Notebook_syncVersion_idx" ON "Notebook"("syncVersion");

-- CreateIndex
CREATE INDEX "NotebookPage_syncVersion_idx" ON "NotebookPage"("syncVersion");

-- CreateIndex
CREATE INDEX "Preference_syncVersion_idx" ON "Preference"("syncVersion");

-- CreateIndex
CREATE INDEX "QuestionBook_syncVersion_idx" ON "QuestionBook"("syncVersion");

-- CreateIndex
CREATE INDEX "Source_syncVersion_idx" ON "Source"("syncVersion");

-- CreateIndex
CREATE INDEX "SourceItem_syncVersion_idx" ON "SourceItem"("syncVersion");

-- CreateIndex
CREATE INDEX "YksResult_syncVersion_idx" ON "YksResult"("syncVersion");

-- ---------------------------------------------------------------------------------------------------------------
-- Eşitleme tetikleyicileri (packages/shared → sync.ts). Prisma şemasında ifade edilemediği için elle yazıldı.
--
-- Her ekleme ve değişiklikte satıra genel sayaçtan yeni `syncVersion` verilir; silinen satır SyncTombstone'a yazılır.
-- Yazan işlemler paylaşımlı danışma kilidi (4242) alır; eşitleme okuması kilidi kısa süre özel alıp sayacın değerini
-- okur. Böylece okunan üst sınırın altındaki bütün numaralar işlenmiş (commit edilmiş) olur; geç biten bir işlemin
-- değişikliği atlanmaz.
-- ---------------------------------------------------------------------------------------------------------------

CREATE SEQUENCE "sync_version";

CREATE FUNCTION sync_bump() RETURNS trigger AS $$
BEGIN
  PERFORM pg_advisory_xact_lock_shared(4242);
  NEW."syncVersion" := nextval('sync_version');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- TG_ARGV: [0] eşitleme tablosu adı, [1] üst tablo (kullanıcı oradan bulunur; yoksa ''), [2] üst satır alanı.
-- Üst satırla birlikte silinen alt satırda üst satır artık görünmez; iz yazılmaz (telefon alt satırları kendisi siler).
CREATE FUNCTION sync_tombstone() RETURNS trigger AS $$
DECLARE
  owner TEXT;
BEGIN
  IF TG_ARGV[1] = '' THEN
    owner := OLD."userId";
  ELSE
    EXECUTE format('SELECT "userId" FROM %I WHERE id = $1', TG_ARGV[1]) INTO owner USING (to_jsonb(OLD) ->> TG_ARGV[2]);
  END IF;
  IF owner IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock_shared(4242);
    INSERT INTO "SyncTombstone" ("table", "rowId", "userId", "syncVersion")
    VALUES (TG_ARGV[0], OLD.id, owner, nextval('sync_version'));
  END IF;
  RETURN OLD;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_bump BEFORE INSERT OR UPDATE ON "Source" FOR EACH ROW EXECUTE FUNCTION sync_bump();
CREATE TRIGGER sync_bump BEFORE INSERT OR UPDATE ON "SourceItem" FOR EACH ROW EXECUTE FUNCTION sync_bump();
CREATE TRIGGER sync_bump BEFORE INSERT OR UPDATE ON "QuestionBook" FOR EACH ROW EXECUTE FUNCTION sync_bump();
CREATE TRIGGER sync_bump BEFORE INSERT OR UPDATE ON "BookQuestion" FOR EACH ROW EXECUTE FUNCTION sync_bump();
CREATE TRIGGER sync_bump BEFORE INSERT OR UPDATE ON "Exam" FOR EACH ROW EXECUTE FUNCTION sync_bump();
CREATE TRIGGER sync_bump BEFORE INSERT OR UPDATE ON "ExamQuestion" FOR EACH ROW EXECUTE FUNCTION sync_bump();
CREATE TRIGGER sync_bump BEFORE INSERT OR UPDATE ON "YksResult" FOR EACH ROW EXECUTE FUNCTION sync_bump();
CREATE TRIGGER sync_bump BEFORE INSERT OR UPDATE ON "Preference" FOR EACH ROW EXECUTE FUNCTION sync_bump();
CREATE TRIGGER sync_bump BEFORE INSERT OR UPDATE ON "Notebook" FOR EACH ROW EXECUTE FUNCTION sync_bump();
CREATE TRIGGER sync_bump BEFORE INSERT OR UPDATE ON "NotebookPage" FOR EACH ROW EXECUTE FUNCTION sync_bump();

CREATE TRIGGER sync_tombstone AFTER DELETE ON "Source" FOR EACH ROW EXECUTE FUNCTION sync_tombstone('sources', '', '');
CREATE TRIGGER sync_tombstone AFTER DELETE ON "SourceItem" FOR EACH ROW EXECUTE FUNCTION sync_tombstone('sourceItems', 'Source', 'sourceId');
CREATE TRIGGER sync_tombstone AFTER DELETE ON "QuestionBook" FOR EACH ROW EXECUTE FUNCTION sync_tombstone('books', '', '');
CREATE TRIGGER sync_tombstone AFTER DELETE ON "BookQuestion" FOR EACH ROW EXECUTE FUNCTION sync_tombstone('bookQuestions', 'QuestionBook', 'bookId');
CREATE TRIGGER sync_tombstone AFTER DELETE ON "Exam" FOR EACH ROW EXECUTE FUNCTION sync_tombstone('exams', '', '');
CREATE TRIGGER sync_tombstone AFTER DELETE ON "ExamQuestion" FOR EACH ROW EXECUTE FUNCTION sync_tombstone('examQuestions', 'Exam', 'examId');
CREATE TRIGGER sync_tombstone AFTER DELETE ON "YksResult" FOR EACH ROW EXECUTE FUNCTION sync_tombstone('yksResults', '', '');
CREATE TRIGGER sync_tombstone AFTER DELETE ON "Preference" FOR EACH ROW EXECUTE FUNCTION sync_tombstone('preferences', '', '');
CREATE TRIGGER sync_tombstone AFTER DELETE ON "Notebook" FOR EACH ROW EXECUTE FUNCTION sync_tombstone('notebooks', '', '');
CREATE TRIGGER sync_tombstone AFTER DELETE ON "NotebookPage" FOR EACH ROW EXECUTE FUNCTION sync_tombstone('notebookPages', 'Notebook', 'notebookId');

-- Var olan satırlara numara ver (tetikleyici çalışır; updatedAt Prisma'nındır, değişmez).
UPDATE "Source" SET "syncVersion" = 0;
UPDATE "SourceItem" SET "syncVersion" = 0;
UPDATE "QuestionBook" SET "syncVersion" = 0;
UPDATE "BookQuestion" SET "syncVersion" = 0;
UPDATE "Exam" SET "syncVersion" = 0;
UPDATE "ExamQuestion" SET "syncVersion" = 0;
UPDATE "YksResult" SET "syncVersion" = 0;
UPDATE "Preference" SET "syncVersion" = 0;
UPDATE "Notebook" SET "syncVersion" = 0;
UPDATE "NotebookPage" SET "syncVersion" = 0;
