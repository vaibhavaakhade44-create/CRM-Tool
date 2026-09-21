#!/usr/bin/env bash
#
# One-time setup for a brand-new (empty) Neon database.
# Creates all tables, your super-admin login, and an optional demo org.
#
#   cd "/Users/admin/Desktop/Techentrance Project/BOS/CRM-Tool/backend"
#   bash scripts/setup-fresh-db.sh
#
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=============================================="
echo "  Fresh Neon database setup"
echo "=============================================="
read -rp "Paste your Neon connection string (the pooled one, ends in ...neon.tech/neondb?...): " POOLED
read -rp "Admin login email: " ADMIN_EMAIL
read -rsp "Admin login password (8+ chars, will not display): " ADMIN_PASS; echo

if [ -z "$POOLED" ] || [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASS" ]; then
  echo "ERROR: all three values are required. Re-run the script."
  exit 1
fi

# Prisma schema changes (DDL) must use a DIRECT connection, not the pooled one.
DIRECT="${POOLED/-pooler./.}"

echo
echo ">> [1/4] Creating all tables in the new database (this can take a minute)..."
DATABASE_URL="$DIRECT" npx prisma db push --skip-generate

echo
echo ">> [2/4] Regenerating the Prisma client..."
npx prisma generate >/dev/null
echo "    done."

echo
echo ">> [3/4] Creating your super-admin login..."
DATABASE_URL="$DIRECT" SUPER_ADMIN_EMAIL="$ADMIN_EMAIL" SUPER_ADMIN_PASSWORD="$ADMIN_PASS" npm run create-superadmin

echo
echo ">> [4/4] Seeding a demo organisation (optional — safe if this fails)..."
DATABASE_URL="$DIRECT" npx ts-node --transpile-only src/prisma/seedDemo.ts || echo "    (demo seed skipped — not critical)"

echo
echo "=============================================="
echo "  DONE."
echo "=============================================="
echo
echo "Next: in Render -> crm-tool-ne6c -> Environment, set DATABASE_URL to this EXACT string"
echo "(the POOLED one you pasted, with -pooler in it):"
echo
echo "    $POOLED"
echo
