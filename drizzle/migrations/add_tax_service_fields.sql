-- Migration: Add Tax Rate and Service Charge fields to Cafeterias
-- Date: April 1, 2026
-- Purpose: Add configurable tax and service charge rates for orders

ALTER TABLE "cafeterias"
ADD COLUMN IF NOT EXISTS "tax_rate" decimal(5, 4) DEFAULT '0.00',
ADD COLUMN IF NOT EXISTS "service_charge" decimal(5, 4) DEFAULT '0.00',
ADD COLUMN IF NOT EXISTS "phone" varchar(20),
ADD COLUMN IF NOT EXISTS "latitude" decimal(10, 8),
ADD COLUMN IF NOT EXISTS "longitude" decimal(11, 8),
ADD COLUMN IF NOT EXISTS "auto_logout_minutes" integer DEFAULT 120;

-- Create indexes for tax and service queries
CREATE INDEX IF NOT EXISTS "idx_cafeterias_tax_rate" ON "cafeterias"("tax_rate");
CREATE INDEX IF NOT EXISTS "idx_cafeterias_service_charge" ON "cafeterias"("service_charge");
CREATE INDEX IF NOT EXISTS "idx_cafeterias_location" ON "cafeterias"("latitude", "longitude");
