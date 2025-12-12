-- CreateEnum
CREATE TYPE "TestType" AS ENUM ('IVPLT', 'RVPLT', 'LATERAL', 'UPLIFT');

-- CreateEnum
CREATE TYPE "TestPhase" AS ENUM ('LOADING', 'HOLD', 'UNLOADING');

-- CreateEnum
CREATE TYPE "TestStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'REPORTED');

-- CreateEnum
CREATE TYPE "CertificateType" AS ENUM ('HYDRAULIC_JACK', 'PRESSURE_GAUGE', 'DIAL_GAUGE', 'PROVING_RING', 'OTHER');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "contractor" TEXT NOT NULL,
    "pmc" TEXT,
    "location" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Test" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "testType" "TestType" NOT NULL DEFAULT 'IVPLT',
    "reportNo" TEXT,
    "testDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pileId" TEXT NOT NULL,
    "pileDiameterMm" DOUBLE PRECISION NOT NULL,
    "pileDepthM" DOUBLE PRECISION NOT NULL,
    "concreteGrade" TEXT NOT NULL,
    "designLoadT" DOUBLE PRECISION NOT NULL,
    "testLoadT" DOUBLE PRECISION NOT NULL,
    "jackName" TEXT,
    "ramAreaCm2" DOUBLE PRECISION NOT NULL,
    "gaugeLeastCountMm" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "status" "TestStatus" NOT NULL DEFAULT 'DRAFT',
    "maxSettlementMm" DOUBLE PRECISION,
    "elasticReboundMm" DOUBLE PRECISION,
    "netSettlementMm" DOUBLE PRECISION,
    "safeLoadAdoptedT" DOUBLE PRECISION,
    "isPassed" BOOLEAN,
    "conclusion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Test_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reading" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "phase" "TestPhase" NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pressureKgCm2" DOUBLE PRECISION NOT NULL,
    "loadT" DOUBLE PRECISION NOT NULL,
    "dg1" DOUBLE PRECISION NOT NULL,
    "dg2" DOUBLE PRECISION NOT NULL,
    "dg3" DOUBLE PRECISION NOT NULL,
    "dg4" DOUBLE PRECISION NOT NULL,
    "dg1Enabled" BOOLEAN NOT NULL DEFAULT true,
    "dg2Enabled" BOOLEAN NOT NULL DEFAULT true,
    "dg3Enabled" BOOLEAN NOT NULL DEFAULT true,
    "dg4Enabled" BOOLEAN NOT NULL DEFAULT true,
    "avgSettlementMm" DOUBLE PRECISION NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteImage" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "caption" TEXT,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationCertificate" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "certificateType" "CertificateType" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalibrationCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "company" TEXT,
    "designation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Test_projectId_idx" ON "Test"("projectId");

-- CreateIndex
CREATE INDEX "Test_testType_idx" ON "Test"("testType");

-- CreateIndex
CREATE INDEX "Reading_testId_idx" ON "Reading"("testId");

-- CreateIndex
CREATE UNIQUE INDEX "Reading_testId_sequence_key" ON "Reading"("testId", "sequence");

-- CreateIndex
CREATE INDEX "SiteImage_testId_idx" ON "SiteImage"("testId");

-- CreateIndex
CREATE INDEX "CalibrationCertificate_testId_idx" ON "CalibrationCertificate"("testId");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationCertificate_testId_certificateType_key" ON "CalibrationCertificate"("testId", "certificateType");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_email_key" ON "UserProfile"("email");

-- AddForeignKey
ALTER TABLE "Test" ADD CONSTRAINT "Test_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reading" ADD CONSTRAINT "Reading_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteImage" ADD CONSTRAINT "SiteImage_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationCertificate" ADD CONSTRAINT "CalibrationCertificate_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;
