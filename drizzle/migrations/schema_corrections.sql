-- Migration: Schema Corrections for Specification Compliance
-- Date: April 1, 2026
-- Purpose: Add missing fields and tables for commission, order lifecycle, and split bill systems

-- ============================================================================
-- 1. Add missing fields to marketers table
-- ============================================================================
ALTER TABLE "marketers" 
ADD COLUMN IF NOT EXISTS "isFrozen" boolean DEFAULT false;

-- Create index for frozen status queries
CREATE INDEX IF NOT EXISTS "idx_marketers_isFrozen" ON "marketers"("isFrozen");

-- ============================================================================
-- 2. Add missing fields to rechargeRequests table
-- ============================================================================
ALTER TABLE "rechargeRequests" 
ADD COLUMN IF NOT EXISTS "attachmentUrls" text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "reviewedAt" timestamp,
ADD COLUMN IF NOT EXISTS "reviewedBy" text,
ADD COLUMN IF NOT EXISTS "pointsApproved" decimal(10, 2),
ADD COLUMN IF NOT EXISTS "updatedAt" timestamp DEFAULT now();

-- Create indexes for recharge queries
CREATE INDEX IF NOT EXISTS "idx_rechargeRequests_status" ON "rechargeRequests"("status");
CREATE INDEX IF NOT EXISTS "idx_rechargeRequests_cafeteriaId" ON "rechargeRequests"("cafeteriaId");
CREATE INDEX IF NOT EXISTS "idx_rechargeRequests_createdAt" ON "rechargeRequests"("createdAt" DESC);

-- ============================================================================
-- 3. Create billSplitItems table for split bill tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS "billSplitItems" (
  "id" text PRIMARY KEY,
  "orderId" text NOT NULL,
  "splitId" text NOT NULL,
  "payerId" text NOT NULL,
  "orderItemId" text NOT NULL,
  "amount" decimal(10, 2),
  "description" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_billSplitItems_orderId" ON "billSplitItems"("orderId");
CREATE INDEX IF NOT EXISTS "idx_billSplitItems_splitId" ON "billSplitItems"("splitId");
CREATE INDEX IF NOT EXISTS "idx_billSplitItems_payerId" ON "billSplitItems"("payerId");

-- ============================================================================
-- 4. Create billSplitPayments table for payment tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS "billSplitPayments" (
  "id" text PRIMARY KEY,
  "orderId" text NOT NULL,
  "splitId" text NOT NULL,
  "payerId" text NOT NULL,
  "amount" decimal(10, 2) NOT NULL,
  "paymentMethod" varchar(50) NOT NULL,
  "notes" text,
  "recordedBy" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_billSplitPayments_orderId" ON "billSplitPayments"("orderId");
CREATE INDEX IF NOT EXISTS "idx_billSplitPayments_splitId" ON "billSplitPayments"("splitId");
CREATE INDEX IF NOT EXISTS "idx_billSplitPayments_payerId" ON "billSplitPayments"("payerId");

-- ============================================================================
-- 5. Update order status enum to include all required statuses
-- ============================================================================
-- Note: PostgreSQL doesn't allow direct enum modification
-- The application must handle the enum update in the schema definition
-- Valid statuses: created, sent_to_kitchen, preparing, ready, served, paid, cancelled

-- ============================================================================
-- 6. Add commissionCalculated flag to rechargeRequests if not exists
-- ============================================================================
-- This column should already exist but verify it's present
-- ALTER TABLE "rechargeRequests" 
-- ADD COLUMN IF NOT EXISTS "commissionCalculated" boolean DEFAULT false;

-- ============================================================================
-- 7. Create indexes for commission queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS "idx_commissionDistributions_rechargeRequestId" 
  ON "commissionDistributions"("rechargeRequestId");

CREATE INDEX IF NOT EXISTS "idx_commissionDistributions_marketerId" 
  ON "commissionDistributions"("marketerId");

CREATE INDEX IF NOT EXISTS "idx_commissionDistributions_status" 
  ON "commissionDistributions"("status");

-- ============================================================================
-- 8. Create indexes for marketer balance queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS "idx_marketerBalances_marketerId" 
  ON "marketerBalances"("marketerId");

-- ============================================================================
-- 9. Add order status indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS "idx_orders_status" ON "orders"("status");
CREATE INDEX IF NOT EXISTS "idx_orders_cafeteriaId" ON "orders"("cafeteriaId");
CREATE INDEX IF NOT EXISTS "idx_orders_createdAt" ON "orders"("createdAt" DESC);
