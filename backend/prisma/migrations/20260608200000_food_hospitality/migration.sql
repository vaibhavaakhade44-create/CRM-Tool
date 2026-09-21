-- Food & Hospitality Module: Restaurant + Hotel
-- All statements are idempotent (safe to re-run)

-- Enums
DO $$ BEGIN
  CREATE TYPE "TableStatus" AS ENUM ('AVAILABLE','OCCUPIED','RESERVED','CLEANING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "FoodOrderType" AS ENUM ('DINE_IN','TAKEAWAY','DELIVERY','ROOM_SERVICE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "KOTStatus" AS ENUM ('PENDING','PREPARING','READY','SERVED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "FoodType" AS ENUM ('VEG','NON_VEG','VEGAN','EGG');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RoomStatus" AS ENUM ('AVAILABLE','OCCUPIED','RESERVED','CLEANING','MAINTENANCE','OUT_OF_ORDER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "HotelBookingStatus" AS ENUM ('CONFIRMED','CHECKED_IN','CHECKED_OUT','CANCELLED','NO_SHOW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RestaurantTable
CREATE TABLE IF NOT EXISTS "RestaurantTable" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "tableNumber"    TEXT NOT NULL,
  "section"        TEXT,
  "capacity"       INTEGER NOT NULL DEFAULT 4,
  "status"         "TableStatus" NOT NULL DEFAULT 'AVAILABLE',
  "posX"           INTEGER,
  "posY"           INTEGER,
  "isActive"       BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantTable_orgId_num_key" ON "RestaurantTable"("organizationId","tableNumber");
CREATE INDEX IF NOT EXISTS "RestaurantTable_orgId_idx" ON "RestaurantTable"("organizationId");

-- MenuCategory
CREATE TABLE IF NOT EXISTS "MenuCategory" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "name"           TEXT NOT NULL,
  "description"    TEXT,
  "image"          TEXT,
  "sortOrder"      INTEGER NOT NULL DEFAULT 0,
  "isActive"       BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "MenuCategory_orgId_idx" ON "MenuCategory"("organizationId");

-- MenuItem
CREATE TABLE IF NOT EXISTS "MenuItem" (
  "id"              TEXT NOT NULL PRIMARY KEY,
  "organizationId"  TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "categoryId"      TEXT NOT NULL REFERENCES "MenuCategory"("id"),
  "name"            TEXT NOT NULL,
  "description"     TEXT,
  "price"           DECIMAL(10,2) NOT NULL DEFAULT 0,
  "costPrice"       DECIMAL(10,2) NOT NULL DEFAULT 0,
  "foodType"        "FoodType" NOT NULL DEFAULT 'VEG',
  "image"           TEXT,
  "taxRate"         DECIMAL(5,2) NOT NULL DEFAULT 0,
  "preparationTime" INTEGER,
  "isAvailable"     BOOLEAN NOT NULL DEFAULT TRUE,
  "isFeatured"      BOOLEAN NOT NULL DEFAULT FALSE,
  "sortOrder"       INTEGER NOT NULL DEFAULT 0,
  "tags"            TEXT[] NOT NULL DEFAULT '{}',
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "MenuItem_orgId_catId_idx" ON "MenuItem"("organizationId","categoryId");
CREATE INDEX IF NOT EXISTS "MenuItem_orgId_idx" ON "MenuItem"("organizationId");

-- MenuItemVariant
CREATE TABLE IF NOT EXISTS "MenuItemVariant" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "menuItemId" TEXT NOT NULL REFERENCES "MenuItem"("id") ON DELETE CASCADE,
  "name"       TEXT NOT NULL,
  "price"      DECIMAL(10,2) NOT NULL,
  "isDefault"  BOOLEAN NOT NULL DEFAULT FALSE
);

-- MenuItemAddon
CREATE TABLE IF NOT EXISTS "MenuItemAddon" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "menuItemId" TEXT NOT NULL REFERENCES "MenuItem"("id") ON DELETE CASCADE,
  "name"       TEXT NOT NULL,
  "price"      DECIMAL(10,2) NOT NULL DEFAULT 0,
  "isRequired" BOOLEAN NOT NULL DEFAULT FALSE
);

-- KOT
CREATE TABLE IF NOT EXISTS "KOT" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "tableId"        TEXT REFERENCES "RestaurantTable"("id"),
  "kotNumber"      TEXT NOT NULL,
  "orderType"      "FoodOrderType" NOT NULL DEFAULT 'DINE_IN',
  "status"         "KOTStatus" NOT NULL DEFAULT 'PENDING',
  "customerName"   TEXT,
  "customerPhone"  TEXT,
  "notes"          TEXT,
  "subtotal"       DECIMAL(10,2) NOT NULL DEFAULT 0,
  "taxAmount"      DECIMAL(10,2) NOT NULL DEFAULT 0,
  "total"          DECIMAL(10,2) NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "KOT_orgId_idx" ON "KOT"("organizationId");
CREATE INDEX IF NOT EXISTS "KOT_tableId_idx" ON "KOT"("tableId");
CREATE INDEX IF NOT EXISTS "KOT_createdAt_idx" ON "KOT"("createdAt");

-- KOTItem
CREATE TABLE IF NOT EXISTS "KOTItem" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "kotId"       TEXT NOT NULL REFERENCES "KOT"("id") ON DELETE CASCADE,
  "menuItemId"  TEXT NOT NULL REFERENCES "MenuItem"("id"),
  "itemName"    TEXT NOT NULL,
  "quantity"    INTEGER NOT NULL DEFAULT 1,
  "price"       DECIMAL(10,2) NOT NULL,
  "variantName" TEXT,
  "addons"      JSONB DEFAULT '[]',
  "notes"       TEXT,
  "status"      "KOTStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "KOTItem_kotId_idx" ON "KOTItem"("kotId");

-- RestaurantBill
CREATE TABLE IF NOT EXISTS "RestaurantBill" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "kotId"          TEXT REFERENCES "KOT"("id"),
  "billNumber"     TEXT NOT NULL,
  "orderType"      "FoodOrderType" NOT NULL DEFAULT 'DINE_IN',
  "subtotal"       DECIMAL(10,2) NOT NULL DEFAULT 0,
  "taxAmount"      DECIMAL(10,2) NOT NULL DEFAULT 0,
  "discount"       DECIMAL(10,2) NOT NULL DEFAULT 0,
  "roundOff"       DECIMAL(10,2) NOT NULL DEFAULT 0,
  "total"          DECIMAL(10,2) NOT NULL DEFAULT 0,
  "paymentMethod"  TEXT NOT NULL DEFAULT 'CASH',
  "paymentStatus"  TEXT NOT NULL DEFAULT 'PAID',
  "customerName"   TEXT,
  "customerPhone"  TEXT,
  "notes"          TEXT,
  "items"          JSONB NOT NULL DEFAULT '[]',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "RestaurantBill_orgId_idx" ON "RestaurantBill"("organizationId");
CREATE INDEX IF NOT EXISTS "RestaurantBill_createdAt_idx" ON "RestaurantBill"("createdAt");

-- TableReservation
CREATE TABLE IF NOT EXISTS "TableReservation" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "tableId"        TEXT REFERENCES "RestaurantTable"("id"),
  "guestName"      TEXT NOT NULL,
  "guestPhone"     TEXT NOT NULL,
  "guestEmail"     TEXT,
  "partySize"      INTEGER NOT NULL DEFAULT 2,
  "reservedAt"     TIMESTAMP(3) NOT NULL,
  "notes"          TEXT,
  "status"         TEXT NOT NULL DEFAULT 'CONFIRMED',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "TableReservation_orgId_idx" ON "TableReservation"("organizationId");
CREATE INDEX IF NOT EXISTS "TableReservation_reservedAt_idx" ON "TableReservation"("reservedAt");

-- RoomType
CREATE TABLE IF NOT EXISTS "RoomType" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "name"           TEXT NOT NULL,
  "description"    TEXT,
  "basePrice"      DECIMAL(10,2) NOT NULL,
  "capacity"       INTEGER NOT NULL DEFAULT 2,
  "bedType"        TEXT,
  "amenities"      TEXT[] NOT NULL DEFAULT '{}',
  "images"         TEXT[] NOT NULL DEFAULT '{}',
  "isActive"       BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "RoomType_orgId_idx" ON "RoomType"("organizationId");

-- HotelRoom
CREATE TABLE IF NOT EXISTS "HotelRoom" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "roomTypeId"     TEXT NOT NULL REFERENCES "RoomType"("id"),
  "roomNumber"     TEXT NOT NULL,
  "floor"          INTEGER NOT NULL DEFAULT 1,
  "status"         "RoomStatus" NOT NULL DEFAULT 'AVAILABLE',
  "notes"          TEXT,
  "isActive"       BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "HotelRoom_orgId_num_key" ON "HotelRoom"("organizationId","roomNumber");
CREATE INDEX IF NOT EXISTS "HotelRoom_orgId_idx" ON "HotelRoom"("organizationId");

-- GuestProfile
CREATE TABLE IF NOT EXISTS "GuestProfile" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "name"           TEXT NOT NULL,
  "phone"          TEXT NOT NULL,
  "email"          TEXT,
  "idType"         TEXT,
  "idNumber"       TEXT,
  "address"        TEXT,
  "city"           TEXT,
  "nationality"    TEXT NOT NULL DEFAULT 'Indian',
  "notes"          TEXT,
  "totalStays"     INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "GuestProfile_orgId_idx" ON "GuestProfile"("organizationId");
CREATE INDEX IF NOT EXISTS "GuestProfile_phone_idx" ON "GuestProfile"("phone");

-- HotelBooking
CREATE TABLE IF NOT EXISTS "HotelBooking" (
  "id"              TEXT NOT NULL PRIMARY KEY,
  "organizationId"  TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "bookingNumber"   TEXT NOT NULL,
  "roomId"          TEXT NOT NULL REFERENCES "HotelRoom"("id"),
  "guestId"         TEXT NOT NULL REFERENCES "GuestProfile"("id"),
  "checkIn"         TIMESTAMP(3) NOT NULL,
  "checkOut"        TIMESTAMP(3) NOT NULL,
  "adults"          INTEGER NOT NULL DEFAULT 1,
  "children"        INTEGER NOT NULL DEFAULT 0,
  "ratePerNight"    DECIMAL(10,2) NOT NULL,
  "totalNights"     INTEGER NOT NULL DEFAULT 1,
  "subtotal"        DECIMAL(10,2) NOT NULL DEFAULT 0,
  "taxAmount"       DECIMAL(10,2) NOT NULL DEFAULT 0,
  "discount"        DECIMAL(10,2) NOT NULL DEFAULT 0,
  "total"           DECIMAL(10,2) NOT NULL DEFAULT 0,
  "advancePaid"     DECIMAL(10,2) NOT NULL DEFAULT 0,
  "balanceDue"      DECIMAL(10,2) NOT NULL DEFAULT 0,
  "status"          "HotelBookingStatus" NOT NULL DEFAULT 'CONFIRMED',
  "paymentMethod"   TEXT,
  "source"          TEXT,
  "specialRequests" TEXT,
  "notes"           TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "HotelBooking_orgId_idx" ON "HotelBooking"("organizationId");
CREATE INDEX IF NOT EXISTS "HotelBooking_dates_idx" ON "HotelBooking"("checkIn","checkOut");
CREATE INDEX IF NOT EXISTS "HotelBooking_status_idx" ON "HotelBooking"("status");
