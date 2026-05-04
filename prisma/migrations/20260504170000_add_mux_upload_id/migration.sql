-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN "muxUploadId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_muxUploadId_key" ON "Lesson"("muxUploadId");
