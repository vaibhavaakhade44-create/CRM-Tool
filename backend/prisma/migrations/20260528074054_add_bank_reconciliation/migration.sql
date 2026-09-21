-- CreateEnum
CREATE TYPE "BankTxnType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "ReconcileStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'IGNORED');

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "txnDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "BankTxnType" NOT NULL,
    "reference" TEXT,
    "reconcileStatus" "ReconcileStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matchedInvoiceId" TEXT,
    "matchedPaymentId" TEXT,
    "notes" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankTransaction_organizationId_idx" ON "BankTransaction"("organizationId");

-- CreateIndex
CREATE INDEX "BankTransaction_organizationId_reconcileStatus_idx" ON "BankTransaction"("organizationId", "reconcileStatus");

-- CreateIndex
CREATE INDEX "BankTransaction_organizationId_txnDate_idx" ON "BankTransaction"("organizationId", "txnDate");

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
