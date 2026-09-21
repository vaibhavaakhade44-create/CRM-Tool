-- AddColumn Invoice publicToken
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "publicToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_publicToken_key" ON "Invoice"("publicToken");
