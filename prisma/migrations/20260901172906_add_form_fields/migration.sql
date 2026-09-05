-- AlterTable
ALTER TABLE "BolRecord" ADD COLUMN     "formData" JSONB;

-- AlterTable
ALTER TABLE "BolTemplate" ADD COLUMN     "fields" JSONB NOT NULL DEFAULT '[]';
