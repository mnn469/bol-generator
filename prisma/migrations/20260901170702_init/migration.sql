-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER', 'VIEWER');

-- CreateEnum
CREATE TYPE "BolStatus" AS ENUM ('ACTIVE', 'VOIDED');

-- CreateEnum
CREATE TYPE "PdfStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyUser" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BolSequence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT 'BOL',
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "padding" INTEGER NOT NULL DEFAULT 6,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BolSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BolTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "numberX" DOUBLE PRECISION NOT NULL DEFAULT 420,
    "numberY" DOUBLE PRECISION NOT NULL DEFAULT 760,
    "numberFontSize" DOUBLE PRECISION NOT NULL DEFAULT 14,
    "numberPrefixText" TEXT NOT NULL DEFAULT 'No. ',
    "coverExistingNumber" BOOLEAN NOT NULL DEFAULT false,
    "coverX" DOUBLE PRECISION NOT NULL DEFAULT 400,
    "coverY" DOUBLE PRECISION NOT NULL DEFAULT 750,
    "coverWidth" DOUBLE PRECISION NOT NULL DEFAULT 160,
    "coverHeight" DOUBLE PRECISION NOT NULL DEFAULT 24,
    "copyLabels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "copyLabelX" DOUBLE PRECISION NOT NULL DEFAULT 420,
    "copyLabelY" DOUBLE PRECISION NOT NULL DEFAULT 735,
    "copyFontSize" DOUBLE PRECISION NOT NULL DEFAULT 11,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BolTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BolRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "generatedByUserId" TEXT NOT NULL,
    "bolNumber" TEXT NOT NULL,
    "numericNumber" INTEGER NOT NULL,
    "status" "BolStatus" NOT NULL DEFAULT 'ACTIVE',
    "pdfPath" TEXT,
    "pdfStatus" "PdfStatus" NOT NULL DEFAULT 'PENDING',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "BolRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bolRecordId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyUser_companyId_userId_key" ON "CompanyUser"("companyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "BolSequence_companyId_key" ON "BolSequence"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "BolTemplate_companyId_key" ON "BolTemplate"("companyId");

-- CreateIndex
CREATE INDEX "BolRecord_companyId_generatedAt_idx" ON "BolRecord"("companyId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BolRecord_companyId_bolNumber_key" ON "BolRecord"("companyId", "bolNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BolRecord_companyId_numericNumber_key" ON "BolRecord"("companyId", "numericNumber");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_createdAt_idx" ON "AuditLog"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "CompanyUser" ADD CONSTRAINT "CompanyUser_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyUser" ADD CONSTRAINT "CompanyUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BolSequence" ADD CONSTRAINT "BolSequence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BolTemplate" ADD CONSTRAINT "BolTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BolRecord" ADD CONSTRAINT "BolRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BolRecord" ADD CONSTRAINT "BolRecord_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_bolRecordId_fkey" FOREIGN KEY ("bolRecordId") REFERENCES "BolRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
