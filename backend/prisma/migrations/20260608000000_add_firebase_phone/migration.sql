-- Add phone, phoneVerified, firebaseUid to User for Firebase authentication
-- Idempotent: safe to re-run

DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "phone" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "phoneVerified" BOOLEAN NOT NULL DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "firebaseUid" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX IF NOT EXISTS "User_firebaseUid_key" ON "User"("firebaseUid");
