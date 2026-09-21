-- Phase 1-5: All Sectors — Bug Tracker, Time Tracking, SLA, Resource Allocation, Client Portal,
-- Tele-calling, Services, Stock Market/Advisory, Health, Custom Fields, SMS Logs
-- IDEMPOTENT VERSION: safe to re-run if partial apply already occurred

-- ── CreateEnum (DO blocks — skip if type already exists) ─────

DO $$ BEGIN CREATE TYPE "BugSeverity" AS ENUM ('CRITICAL','HIGH','MEDIUM','LOW'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "BugStatus" AS ENUM ('OPEN','IN_PROGRESS','RESOLVED','CLOSED','WONT_FIX','DUPLICATE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CallOutcome" AS ENUM ('CONNECTED','NO_ANSWER','BUSY','VOICEMAIL','WRONG_NUMBER','CALLBACK_REQUESTED','INTERESTED','NOT_INTERESTED','CONVERTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ContractStatus" AS ENUM ('DRAFT','ACTIVE','PAUSED','EXPIRED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "TradeCallStatus" AS ENUM ('ACTIVE','TARGET_HIT','STOP_LOSS','EXPIRED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "Gender" AS ENUM ('MALE','FEMALE','OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "BloodGroup" AS ENUM ('A_POS','A_NEG','B_POS','B_NEG','AB_POS','AB_NEG','O_POS','O_NEG','UNKNOWN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CustomFieldType" AS ENUM ('TEXT','NUMBER','DATE','BOOLEAN','SELECT','MULTI_SELECT','URL','EMAIL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── AlterTable SupportTicket (skip if column already exists) ─

DO $$ BEGIN ALTER TABLE "SupportTicket" ADD COLUMN "slaPolicyId" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ── CreateTable (IF NOT EXISTS on all tables) ─────────────────

CREATE TABLE IF NOT EXISTS "Bug" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "BugSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "BugStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "reportedById" TEXT,
    "assignedToId" TEXT,
    "sprintId" TEXT,
    "stepsToRepro" TEXT,
    "expectedResult" TEXT,
    "actualResult" TEXT,
    "environment" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bug_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BugComment" (
    "id" TEXT NOT NULL,
    "bugId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BugComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProjectTimeEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "userId" TEXT NOT NULL,
    "description" TEXT,
    "hours" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectTimeEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GitCommit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "author" TEXT,
    "authorEmail" TEXT,
    "branch" TEXT,
    "repoName" TEXT,
    "committedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GitCommit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SLAPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "firstResponseHours" INTEGER NOT NULL DEFAULT 4,
    "resolutionHours" INTEGER NOT NULL DEFAULT 24,
    "escalationHours" INTEGER,
    "appliesTo" TEXT NOT NULL DEFAULT 'SUPPORT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SLAPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ResourceAllocation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT,
    "allocationPct" INTEGER NOT NULL DEFAULT 100,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResourceAllocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClientPortalUser" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "partyId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientPortalUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CallLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT,
    "partyId" TEXT,
    "agentId" TEXT,
    "campaignId" TEXT,
    "phone" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'OUTBOUND',
    "outcome" "CallOutcome",
    "duration" INTEGER,
    "notes" TEXT,
    "recordingUrl" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "calledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CallScript" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "content" TEXT NOT NULL,
    "objections" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CallScript_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DNCEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "reason" TEXT,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DNCEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DialerCampaign" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scriptId" TEXT,
    "targetCount" INTEGER NOT NULL DEFAULT 0,
    "dialedCount" INTEGER NOT NULL DEFAULT 0,
    "connectedCount" INTEGER NOT NULL DEFAULT 0,
    "convertedCount" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DialerCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ServiceCatalogItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'service',
    "deliveryDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceCatalogItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ServiceContract" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "partyId" TEXT,
    "serviceItemId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "value" DOUBLE PRECISION,
    "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "nextBillingDate" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "slaHours" INTEGER,
    "assignedToId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceContract_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KBArticle" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "helpful" INTEGER NOT NULL DEFAULT 0,
    "notHelpful" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KBArticle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InternalMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT,
    "threadId" TEXT,
    "message" TEXT NOT NULL,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InternalMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdvisoryPlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxAlerts" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdvisoryPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdvisorySubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "partyId" TEXT,
    "planId" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "amount" DOUBLE PRECISION NOT NULL,
    "kycVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdvisorySubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TradeCall" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "exchange" TEXT,
    "callType" TEXT NOT NULL DEFAULT 'BUY',
    "segment" TEXT NOT NULL DEFAULT 'EQUITY',
    "entryPrice" DOUBLE PRECISION,
    "entryLow" DOUBLE PRECISION,
    "entryHigh" DOUBLE PRECISION,
    "targetPrice" DOUBLE PRECISION,
    "target2" DOUBLE PRECISION,
    "stopLoss" DOUBLE PRECISION,
    "riskReward" DOUBLE PRECISION,
    "status" "TradeCallStatus" NOT NULL DEFAULT 'ACTIVE',
    "rationale" TEXT,
    "outcome" DOUBLE PRECISION,
    "calledById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TradeCall_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ResearchReport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "symbol" TEXT,
    "reportType" TEXT NOT NULL DEFAULT 'EQUITY',
    "summary" TEXT,
    "content" TEXT,
    "rating" TEXT,
    "targetPrice" DOUBLE PRECISION,
    "currentPrice" DOUBLE PRECISION,
    "fileUrl" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResearchReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KYCRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "partyId" TEXT,
    "panNumber" TEXT,
    "aadharNumber" TEXT,
    "bankAccount" TEXT,
    "ifscCode" TEXT,
    "bankName" TEXT,
    "dematAccount" TEXT,
    "dpId" TEXT,
    "riskProfile" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "documents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KYCRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MarketAlert" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "alertType" TEXT NOT NULL DEFAULT 'PRICE',
    "condition" TEXT,
    "triggerValue" DOUBLE PRECISION,
    "message" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "triggeredAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketAlert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Patient" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientCode" TEXT,
    "name" TEXT NOT NULL,
    "dob" TIMESTAMP(3),
    "gender" "Gender",
    "bloodGroup" "BloodGroup",
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "emergencyName" TEXT,
    "emergencyPhone" TEXT,
    "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "chronicConds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PatientVisit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitType" TEXT NOT NULL DEFAULT 'OPD',
    "doctorId" TEXT,
    "chiefComplaint" TEXT,
    "diagnosis" TEXT,
    "vitalsBP" TEXT,
    "vitalsPulse" INTEGER,
    "vitalsTemp" DOUBLE PRECISION,
    "vitalsWeight" DOUBLE PRECISION,
    "vitalsHeight" DOUBLE PRECISION,
    "vitalsSpO2" INTEGER,
    "notes" TEXT,
    "followUpDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PatientVisit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Prescription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitId" TEXT,
    "doctorId" TEXT,
    "medicines" JSONB NOT NULL DEFAULT '[]',
    "instructions" TEXT,
    "diet" TEXT,
    "followUpDays" INTEGER,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LabReport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitId" TEXT,
    "testName" TEXT NOT NULL,
    "testCategory" TEXT,
    "results" JSONB NOT NULL DEFAULT '{}',
    "normalRange" TEXT,
    "interpretation" TEXT,
    "technicianId" TEXT,
    "conductedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LabReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CustomField" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "fieldType" "CustomFieldType" NOT NULL DEFAULT 'TEXT',
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomField_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CustomFieldValue" (
    "id" TEXT NOT NULL,
    "customFieldId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "value" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SMSLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'MSG91',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "providerId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "sentById" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SMSLog_pkey" PRIMARY KEY ("id")
);

-- ── CreateIndexes (IF NOT EXISTS on all indexes) ──────────────

CREATE INDEX IF NOT EXISTS "Bug_organizationId_idx" ON "Bug"("organizationId");
CREATE INDEX IF NOT EXISTS "Bug_projectId_idx" ON "Bug"("projectId");
CREATE INDEX IF NOT EXISTS "Bug_organizationId_status_idx" ON "Bug"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "Bug_assignedToId_idx" ON "Bug"("assignedToId");
CREATE INDEX IF NOT EXISTS "BugComment_bugId_idx" ON "BugComment"("bugId");
CREATE INDEX IF NOT EXISTS "ProjectTimeEntry_organizationId_idx" ON "ProjectTimeEntry"("organizationId");
CREATE INDEX IF NOT EXISTS "ProjectTimeEntry_projectId_idx" ON "ProjectTimeEntry"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectTimeEntry_userId_idx" ON "ProjectTimeEntry"("userId");
CREATE INDEX IF NOT EXISTS "ProjectTimeEntry_date_idx" ON "ProjectTimeEntry"("date");
CREATE UNIQUE INDEX IF NOT EXISTS "GitCommit_projectId_sha_key" ON "GitCommit"("projectId", "sha");
CREATE INDEX IF NOT EXISTS "GitCommit_organizationId_idx" ON "GitCommit"("organizationId");
CREATE INDEX IF NOT EXISTS "GitCommit_projectId_idx" ON "GitCommit"("projectId");
CREATE INDEX IF NOT EXISTS "SLAPolicy_organizationId_idx" ON "SLAPolicy"("organizationId");
CREATE INDEX IF NOT EXISTS "ResourceAllocation_organizationId_idx" ON "ResourceAllocation"("organizationId");
CREATE INDEX IF NOT EXISTS "ResourceAllocation_projectId_idx" ON "ResourceAllocation"("projectId");
CREATE INDEX IF NOT EXISTS "ResourceAllocation_userId_idx" ON "ResourceAllocation"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "ClientPortalUser_organizationId_email_key" ON "ClientPortalUser"("organizationId", "email");
CREATE INDEX IF NOT EXISTS "ClientPortalUser_organizationId_idx" ON "ClientPortalUser"("organizationId");
CREATE INDEX IF NOT EXISTS "CallLog_organizationId_idx" ON "CallLog"("organizationId");
CREATE INDEX IF NOT EXISTS "CallLog_leadId_idx" ON "CallLog"("leadId");
CREATE INDEX IF NOT EXISTS "CallLog_agentId_idx" ON "CallLog"("agentId");
CREATE INDEX IF NOT EXISTS "CallLog_campaignId_idx" ON "CallLog"("campaignId");
CREATE INDEX IF NOT EXISTS "CallLog_calledAt_idx" ON "CallLog"("calledAt");
CREATE INDEX IF NOT EXISTS "CallScript_organizationId_idx" ON "CallScript"("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "DNCEntry_organizationId_phone_key" ON "DNCEntry"("organizationId", "phone");
CREATE INDEX IF NOT EXISTS "DNCEntry_organizationId_idx" ON "DNCEntry"("organizationId");
CREATE INDEX IF NOT EXISTS "DialerCampaign_organizationId_idx" ON "DialerCampaign"("organizationId");
CREATE INDEX IF NOT EXISTS "DialerCampaign_organizationId_status_idx" ON "DialerCampaign"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "ServiceCatalogItem_organizationId_idx" ON "ServiceCatalogItem"("organizationId");
CREATE INDEX IF NOT EXISTS "ServiceContract_organizationId_idx" ON "ServiceContract"("organizationId");
CREATE INDEX IF NOT EXISTS "ServiceContract_organizationId_status_idx" ON "ServiceContract"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "ServiceContract_nextBillingDate_idx" ON "ServiceContract"("nextBillingDate");
CREATE UNIQUE INDEX IF NOT EXISTS "KBArticle_organizationId_slug_key" ON "KBArticle"("organizationId", "slug");
CREATE INDEX IF NOT EXISTS "KBArticle_organizationId_idx" ON "KBArticle"("organizationId");
CREATE INDEX IF NOT EXISTS "KBArticle_organizationId_isPublic_idx" ON "KBArticle"("organizationId", "isPublic");
CREATE INDEX IF NOT EXISTS "InternalMessage_organizationId_idx" ON "InternalMessage"("organizationId");
CREATE INDEX IF NOT EXISTS "InternalMessage_senderId_idx" ON "InternalMessage"("senderId");
CREATE INDEX IF NOT EXISTS "InternalMessage_recipientId_idx" ON "InternalMessage"("recipientId");
CREATE INDEX IF NOT EXISTS "InternalMessage_threadId_idx" ON "InternalMessage"("threadId");
CREATE INDEX IF NOT EXISTS "AdvisoryPlan_organizationId_idx" ON "AdvisoryPlan"("organizationId");
CREATE INDEX IF NOT EXISTS "AdvisorySubscription_organizationId_idx" ON "AdvisorySubscription"("organizationId");
CREATE INDEX IF NOT EXISTS "AdvisorySubscription_organizationId_status_idx" ON "AdvisorySubscription"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "TradeCall_organizationId_idx" ON "TradeCall"("organizationId");
CREATE INDEX IF NOT EXISTS "TradeCall_organizationId_status_idx" ON "TradeCall"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "TradeCall_symbol_idx" ON "TradeCall"("symbol");
CREATE INDEX IF NOT EXISTS "ResearchReport_organizationId_idx" ON "ResearchReport"("organizationId");
CREATE INDEX IF NOT EXISTS "ResearchReport_symbol_idx" ON "ResearchReport"("symbol");
CREATE UNIQUE INDEX IF NOT EXISTS "KYCRecord_organizationId_partyId_key" ON "KYCRecord"("organizationId", "partyId");
CREATE INDEX IF NOT EXISTS "KYCRecord_organizationId_idx" ON "KYCRecord"("organizationId");
CREATE INDEX IF NOT EXISTS "MarketAlert_organizationId_idx" ON "MarketAlert"("organizationId");
CREATE INDEX IF NOT EXISTS "MarketAlert_symbol_idx" ON "MarketAlert"("symbol");
CREATE INDEX IF NOT EXISTS "MarketAlert_isActive_idx" ON "MarketAlert"("isActive");
CREATE INDEX IF NOT EXISTS "Patient_organizationId_idx" ON "Patient"("organizationId");
CREATE INDEX IF NOT EXISTS "Patient_phone_idx" ON "Patient"("phone");
CREATE INDEX IF NOT EXISTS "PatientVisit_organizationId_idx" ON "PatientVisit"("organizationId");
CREATE INDEX IF NOT EXISTS "PatientVisit_patientId_idx" ON "PatientVisit"("patientId");
CREATE INDEX IF NOT EXISTS "PatientVisit_visitDate_idx" ON "PatientVisit"("visitDate");
CREATE INDEX IF NOT EXISTS "Prescription_organizationId_idx" ON "Prescription"("organizationId");
CREATE INDEX IF NOT EXISTS "Prescription_patientId_idx" ON "Prescription"("patientId");
CREATE INDEX IF NOT EXISTS "LabReport_organizationId_idx" ON "LabReport"("organizationId");
CREATE INDEX IF NOT EXISTS "LabReport_patientId_idx" ON "LabReport"("patientId");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomField_organizationId_entity_fieldKey_key" ON "CustomField"("organizationId", "entity", "fieldKey");
CREATE INDEX IF NOT EXISTS "CustomField_organizationId_entity_idx" ON "CustomField"("organizationId", "entity");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomFieldValue_customFieldId_entityId_key" ON "CustomFieldValue"("customFieldId", "entityId");
CREATE INDEX IF NOT EXISTS "CustomFieldValue_customFieldId_idx" ON "CustomFieldValue"("customFieldId");
CREATE INDEX IF NOT EXISTS "CustomFieldValue_entityId_idx" ON "CustomFieldValue"("entityId");
CREATE INDEX IF NOT EXISTS "SMSLog_organizationId_idx" ON "SMSLog"("organizationId");
CREATE INDEX IF NOT EXISTS "SMSLog_phone_idx" ON "SMSLog"("phone");
CREATE INDEX IF NOT EXISTS "SMSLog_createdAt_idx" ON "SMSLog"("createdAt");

-- ── AddForeignKey constraints (DO blocks — skip if already exists) ──

DO $$ BEGIN ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_slaPolicyId_fkey" FOREIGN KEY ("slaPolicyId") REFERENCES "SLAPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Bug" ADD CONSTRAINT "Bug_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Bug" ADD CONSTRAINT "Bug_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "BugComment" ADD CONSTRAINT "BugComment_bugId_fkey" FOREIGN KEY ("bugId") REFERENCES "Bug"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ProjectTimeEntry" ADD CONSTRAINT "ProjectTimeEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ProjectTimeEntry" ADD CONSTRAINT "ProjectTimeEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "GitCommit" ADD CONSTRAINT "GitCommit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "GitCommit" ADD CONSTRAINT "GitCommit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "SLAPolicy" ADD CONSTRAINT "SLAPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ResourceAllocation" ADD CONSTRAINT "ResourceAllocation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ResourceAllocation" ADD CONSTRAINT "ResourceAllocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ClientPortalUser" ADD CONSTRAINT "ClientPortalUser_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CallScript" ADD CONSTRAINT "CallScript_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "DNCEntry" ADD CONSTRAINT "DNCEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "DialerCampaign" ADD CONSTRAINT "DialerCampaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ServiceCatalogItem" ADD CONSTRAINT "ServiceCatalogItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ServiceContract" ADD CONSTRAINT "ServiceContract_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ServiceContract" ADD CONSTRAINT "ServiceContract_serviceItemId_fkey" FOREIGN KEY ("serviceItemId") REFERENCES "ServiceCatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "KBArticle" ADD CONSTRAINT "KBArticle_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "InternalMessage" ADD CONSTRAINT "InternalMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AdvisoryPlan" ADD CONSTRAINT "AdvisoryPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AdvisorySubscription" ADD CONSTRAINT "AdvisorySubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AdvisorySubscription" ADD CONSTRAINT "AdvisorySubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AdvisoryPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "TradeCall" ADD CONSTRAINT "TradeCall_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ResearchReport" ADD CONSTRAINT "ResearchReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "KYCRecord" ADD CONSTRAINT "KYCRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "MarketAlert" ADD CONSTRAINT "MarketAlert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Patient" ADD CONSTRAINT "Patient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "PatientVisit" ADD CONSTRAINT "PatientVisit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "PatientVisit" ADD CONSTRAINT "PatientVisit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "PatientVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "LabReport" ADD CONSTRAINT "LabReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "LabReport" ADD CONSTRAINT "LabReport_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CustomField" ADD CONSTRAINT "CustomField_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_customFieldId_fkey" FOREIGN KEY ("customFieldId") REFERENCES "CustomField"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "SMSLog" ADD CONSTRAINT "SMSLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
