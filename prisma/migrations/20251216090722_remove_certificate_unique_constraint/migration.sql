-- DropIndex
DROP INDEX "CalibrationCertificate_testId_certificateType_key";

-- AlterTable
ALTER TABLE "CalibrationCertificate" ALTER COLUMN "certificateType" SET DEFAULT 'OTHER';
