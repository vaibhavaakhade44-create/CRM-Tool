-- CreateTable
CREATE TABLE "RecordComment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT,
    "authorEmail" TEXT,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecordComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecordComment_organizationId_idx" ON "RecordComment"("organizationId");

-- CreateIndex
CREATE INDEX "RecordComment_organizationId_entityType_entityId_idx" ON "RecordComment"("organizationId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "RecordComment" ADD CONSTRAINT "RecordComment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
