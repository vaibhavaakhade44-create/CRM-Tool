-- Migration: branding_compliance
-- Adds brandingColor, complianceConfig to Organization
-- Creates CustomFieldType enum, CustomField, CustomFieldValue, ConsentLog tables
-- Idempotent: safe to re-run

-- ── Organization: new columns ────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "Organization" ADD COLUMN "brandingColor" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Organization" ADD COLUMN "complianceConfig" JSONB;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── CustomFieldType enum ─────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "CustomFieldType" AS ENUM (
    'TEXT',
    'NUMBER',
    'DATE',
    'BOOLEAN',
    'SELECT',
    'MULTI_SELECT',
    'URL',
    'EMAIL'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── CustomField table ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "CustomField" (
    "id"             TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entity"         TEXT NOT NULL,
    "label"          TEXT NOT NULL,
    "fieldKey"       TEXT NOT NULL,
    "fieldType"      "CustomFieldType" NOT NULL DEFAULT 'TEXT',
    "options"        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "isRequired"     BOOLEAN NOT NULL DEFAULT false,
    "isActive"       BOOLEAN NOT NULL DEFAULT true,
    "sortOrder"      INTEGER NOT NULL DEFAULT 0,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomField_pkey" PRIMARY KEY ("id")
);

-- ── CustomFieldValue table ───────────────────────────────────

CREATE TABLE IF NOT EXISTS "CustomFieldValue" (
    "id"            TEXT NOT NULL,
    "customFieldId" TEXT NOT NULL,
    "entityId"      TEXT NOT NULL,
    "value"         TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- ── ConsentLog table ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ConsentLog" (
    "id"             TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entityType"     TEXT NOT NULL,
    "entityId"       TEXT NOT NULL,
    "consentType"    TEXT NOT NULL,
    "consentGiven"   BOOLEAN NOT NULL DEFAULT true,
    "ipAddress"      TEXT,
    "userAgent"      TEXT,
    "notes"          TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentLog_pkey" PRIMARY KEY ("id")
);

-- ── Unique constraints ───────────────────────────────────────
-- Use CREATE UNIQUE INDEX IF NOT EXISTS — ALTER TABLE ADD CONSTRAINT raises 42P07
-- (duplicate_table) not 42710 (duplicate_object) when the backing index already exists.

CREATE UNIQUE INDEX IF NOT EXISTS "CustomField_organizationId_entity_fieldKey_key"
  ON "CustomField"("organizationId", "entity", "fieldKey");

CREATE UNIQUE INDEX IF NOT EXISTS "CustomFieldValue_customFieldId_entityId_key"
  ON "CustomFieldValue"("customFieldId", "entityId");

-- ── Indexes ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "CustomField_organizationId_entity_idx"
  ON "CustomField"("organizationId", "entity");

CREATE INDEX IF NOT EXISTS "CustomFieldValue_customFieldId_idx"
  ON "CustomFieldValue"("customFieldId");

CREATE INDEX IF NOT EXISTS "CustomFieldValue_entityId_idx"
  ON "CustomFieldValue"("entityId");

CREATE INDEX IF NOT EXISTS "ConsentLog_organizationId_idx"
  ON "ConsentLog"("organizationId");

CREATE INDEX IF NOT EXISTS "ConsentLog_entityType_entityId_idx"
  ON "ConsentLog"("entityType", "entityId");

CREATE INDEX IF NOT EXISTS "ConsentLog_createdAt_idx"
  ON "ConsentLog"("createdAt");

-- ── Foreign keys ─────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "CustomField" ADD CONSTRAINT "CustomField_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_customFieldId_fkey"
    FOREIGN KEY ("customFieldId") REFERENCES "CustomField"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ConsentLog" ADD CONSTRAINT "ConsentLog_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
