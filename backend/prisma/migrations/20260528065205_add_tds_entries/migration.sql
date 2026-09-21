-- CreateEnum
CREATE TYPE "TDSType" AS ENUM ('TDS', 'TCS');

-- CreateTable
CREATE TABLE "TDSEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "TDSType" NOT NULL DEFAULT 'TDS',
    "partyId" TEXT,
    "invoiceId" TEXT,
    "section" TEXT NOT NULL,
    "description" TEXT,
    "baseAmount" DOUBLE PRECISION NOT NULL,
    "tdsRate" DOUBLE PRECISION NOT NULL,
    "tdsAmount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "challanNumber" TEXT,
    "depositedAt" TIMESTAMP(3),
    "isDeposited" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TDSEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TDSEntry_organizationId_idx" ON "TDSEntry"("organizationId");

-- CreateIndex
CREATE INDEX "TDSEntry_organizationId_type_idx" ON "TDSEntry"("organizationId", "type");

-- CreateIndex
CREATE INDEX "TDSEntry_organizationId_isDeposited_idx" ON "TDSEntry"("organizationId", "isDeposited");

-- AddForeignKey
ALTER TABLE "TDSEntry" ADD CONSTRAINT "TDSEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TDSEntry" ADD CONSTRAINT "TDSEntry_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
