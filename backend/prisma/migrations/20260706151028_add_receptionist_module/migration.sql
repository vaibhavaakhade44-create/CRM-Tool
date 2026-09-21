-- CreateEnum
CREATE TYPE "VisitorStatus" AS ENUM ('CHECKED_IN', 'CHECKED_OUT', 'EXPECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CourierType" AS ENUM ('INCOMING', 'OUTGOING');

-- CreateEnum
CREATE TYPE "CourierStatus" AS ENUM ('PENDING', 'DELIVERED', 'RETURNED');

-- CreateTable
CREATE TABLE "Visitor" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "company" TEXT,
    "purpose" TEXT,
    "whomToMeet" TEXT,
    "department" TEXT,
    "idType" TEXT,
    "idNumber" TEXT,
    "vehicleNumber" TEXT,
    "badgeNumber" TEXT,
    "status" "VisitorStatus" NOT NULL DEFAULT 'CHECKED_IN',
    "checkInTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutTime" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourierLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "CourierType" NOT NULL,
    "courierCompany" TEXT,
    "trackingNumber" TEXT,
    "senderName" TEXT,
    "senderCompany" TEXT,
    "recipientName" TEXT,
    "recipientDept" TEXT,
    "description" TEXT,
    "handledBy" TEXT,
    "status" "CourierStatus" NOT NULL DEFAULT 'PENDING',
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourierLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Visitor_organizationId_idx" ON "Visitor"("organizationId");

-- CreateIndex
CREATE INDEX "Visitor_organizationId_status_idx" ON "Visitor"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Visitor_checkInTime_idx" ON "Visitor"("checkInTime");

-- CreateIndex
CREATE INDEX "CourierLog_organizationId_idx" ON "CourierLog"("organizationId");

-- CreateIndex
CREATE INDEX "CourierLog_organizationId_status_idx" ON "CourierLog"("organizationId", "status");

-- CreateIndex
CREATE INDEX "CourierLog_loggedAt_idx" ON "CourierLog"("loggedAt");

-- AddForeignKey
ALTER TABLE "Visitor" ADD CONSTRAINT "Visitor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierLog" ADD CONSTRAINT "CourierLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

