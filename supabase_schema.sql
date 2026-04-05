-- Cafeteria V2 Database Schema
-- Complete schema for Supabase PostgreSQL
-- Generated for deployment

-- ============================================
-- ENUMS (Custom Types)
-- ============================================

CREATE TYPE "public"."commission_status" AS ENUM('pending', 'available', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."ledger_type" AS ENUM('points_deduction', 'points_credit', 'commission_pending', 'commission_available', 'commission_withdrawn', 'recharge_approval', 'points_cancelled');--> statement-breakpoint
CREATE TYPE "public"."login_method" AS ENUM('email', 'google', 'github');--> statement-breakpoint
CREATE TYPE "public"."order_item_status" AS ENUM('pending', 'sent_to_kitchen', 'in_preparation', 'ready', 'served', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('open', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."period_type" AS ENUM('global_first_time', 'special_grant');--> statement-breakpoint
CREATE TYPE "public"."recharge_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."report_type" AS ENUM('daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."shift_status" AS ENUM('active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('admin', 'manager', 'waiter', 'chef');--> statement-breakpoint
CREATE TYPE "public"."staff_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."table_status" AS ENUM('available', 'occupied', 'reserved', 'cleaning');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin', 'owner', 'marketer', 'cafeteria_admin', 'manager', 'waiter', 'chef');--> statement-breakpoint
CREATE TYPE "public"."withdrawal_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cafeteriaMarketerRelationships" (

-- ============================================
-- TABLES AND CONSTRAINTS
-- ============================================

	"id" text PRIMARY KEY NOT NULL,
	"cafeteriaId" text NOT NULL,
	"marketerId" text NOT NULL,
	"commissionStartDate" timestamp DEFAULT now() NOT NULL,
	"commissionExpiryDate" timestamp NOT NULL,
	"isExpired" boolean DEFAULT false,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cafeteriaReports" (
	"id" text PRIMARY KEY NOT NULL,
	"cafeteriaId" text NOT NULL,
	"reportType" "report_type" NOT NULL,
	"reportDate" timestamp NOT NULL,
	"totalSales" numeric(15, 2) DEFAULT '0',
	"totalOrders" integer DEFAULT 0,
	"totalItemsSold" integer DEFAULT 0,
	"totalPointsDeducted" numeric(15, 2) DEFAULT '0',
	"averageOrderValue" numeric(10, 2) DEFAULT '0',
	"generatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cafeteriaStaff" (
	"id" text PRIMARY KEY NOT NULL,
	"cafeteriaId" text NOT NULL,
	"userId" text,
	"name" varchar(255) NOT NULL,
	"loginUsername" varchar(320),
	"passwordHash" text,
	"role" "staff_role" DEFAULT 'waiter',
	"status" "staff_status" DEFAULT 'active',
	"canLogin" boolean DEFAULT false,
	"permissions" jsonb,
	"loginPermissionGrantedAt" timestamp,
	"loginPermissionGrantedBy" text,
	"lastLoginAt" timestamp,
	"country" varchar(2),
	"currency" varchar(3),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cafeteriaStaff_loginUsername_unique" UNIQUE("loginUsername")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cafeteriaTables" (
	"id" text PRIMARY KEY NOT NULL,
	"cafeteriaId" text NOT NULL,
	"sectionId" text,
	"tableNumber" integer NOT NULL,
	"capacity" integer,
	"status" "table_status" DEFAULT 'available',
	"tableToken" varchar(64),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cafeteriaTables_tableToken_unique" UNIQUE("tableToken")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cafeterias" (
	"id" text PRIMARY KEY NOT NULL,
	"marketerId" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"location" varchar(255),
	"loginUsername" varchar(320),
	"passwordHash" text,
	"pointsBalance" numeric(10, 2) DEFAULT '0',
	"graceMode" boolean DEFAULT false,
	"referenceCode" varchar(50),
	"country" varchar(2),
	"currency" varchar(3),
	"currencyOverrideBy" text,
	"language" varchar(10) DEFAULT 'en',
	"freeOperationEndDate" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cafeterias_loginUsername_unique" UNIQUE("loginUsername"),
	CONSTRAINT "cafeterias_referenceCode_unique" UNIQUE("referenceCode")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commissionConfigs" (
	"id" text PRIMARY KEY NOT NULL,
	"marketerId" text NOT NULL,
	"rate" numeric(5, 2) DEFAULT '0',
	"expiryOverrideMonths" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commissionDistributions" (
	"id" text PRIMARY KEY NOT NULL,
	"rechargeRequestId" text NOT NULL,
	"marketerId" text NOT NULL,
	"level" integer NOT NULL,
	"commissionAmount" numeric(15, 2) NOT NULL,
	"status" "commission_status" DEFAULT 'pending',
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "freeOperationPeriods" (
	"id" text PRIMARY KEY NOT NULL,
	"cafeteriaId" text NOT NULL,
	"periodType" "period_type" NOT NULL,
	"startDate" timestamp NOT NULL,
	"endDate" timestamp NOT NULL,
	"reason" text,
	"createdBy" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ledgerEntries" (
	"id" text PRIMARY KEY NOT NULL,
	"type" varchar(50) NOT NULL,
	"ledgerType" "ledger_type",
	"description" text,
	"cafeteriaId" text,
	"marketerId" text,
	"amount" numeric(10, 2),
	"refId" text,
	"relatedMarketerIds" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "marketerBalances" (
	"id" text PRIMARY KEY NOT NULL,
	"marketerId" text NOT NULL,
	"pendingBalance" numeric(15, 2) DEFAULT '0',
	"availableBalance" numeric(15, 2) DEFAULT '0',
	"totalWithdrawn" numeric(15, 2) DEFAULT '0',
	"lastUpdated" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "marketerBalances_marketerId_unique" UNIQUE("marketerId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "marketers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(320),
	"loginUsername" varchar(320),
	"passwordHash" text,
	"parentId" text,
	"isRoot" boolean DEFAULT false,
	"referenceCode" varchar(50),
	"country" varchar(2),
	"currency" varchar(3),
	"currencyOverrideBy" text,
	"language" varchar(10) DEFAULT 'en',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "marketers_loginUsername_unique" UNIQUE("loginUsername"),
	CONSTRAINT "marketers_referenceCode_unique" UNIQUE("referenceCode")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "menuCategories" (
	"id" text PRIMARY KEY NOT NULL,
	"cafeteriaId" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"displayOrder" integer DEFAULT 0,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "menuItems" (
	"id" text PRIMARY KEY NOT NULL,
	"categoryId" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"price" numeric(10, 2),
	"available" boolean DEFAULT true,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orderItems" (
	"id" text PRIMARY KEY NOT NULL,
	"orderId" text NOT NULL,
	"menuItemId" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unitPrice" numeric(10, 2) NOT NULL,
	"totalPrice" numeric(10, 2) NOT NULL,
	"status" "order_item_status" DEFAULT 'pending',
	"sentToKitchenAt" timestamp,
	"readyAt" timestamp,
	"servedAt" timestamp,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"cafeteriaId" text NOT NULL,
	"tableId" text,
	"waiterId" text,
	"totalAmount" numeric(10, 2) DEFAULT '0',
	"status" "order_status" DEFAULT 'open',
	"pointsConsumed" numeric(10, 2) DEFAULT '0',
	"source" varchar(50) DEFAULT 'staff',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"closedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rechargeRequests" (
	"id" text PRIMARY KEY NOT NULL,
	"cafeteriaId" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"imageUrl" text,
	"status" "recharge_status" DEFAULT 'pending',
	"processedAt" timestamp,
	"processedBy" text,
	"notes" text,
	"commissionCalculated" boolean DEFAULT false,
	"commissionDistributionId" text,
	"pointsAddedToBalance" numeric(10, 2) DEFAULT '0',
	"country" varchar(2),
	"currency" varchar(3),
	"language" varchar(10),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sections" (
	"id" text PRIMARY KEY NOT NULL,
	"cafeteriaId" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"displayOrder" integer DEFAULT 0,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shiftSales" (
	"id" text PRIMARY KEY NOT NULL,
	"shiftId" text NOT NULL,
	"orderId" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"pointsDeducted" numeric(10, 2) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shifts" (
	"id" text PRIMARY KEY NOT NULL,
	"cafeteriaId" text NOT NULL,
	"staffId" text NOT NULL,
	"startTime" timestamp NOT NULL,
	"endTime" timestamp,
	"status" "shift_status" DEFAULT 'active',
	"totalSales" numeric(15, 2) DEFAULT '0',
	"totalOrders" integer DEFAULT 0,
	"totalItemsSold" integer DEFAULT 0,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "staffCategoryAssignments" (
	"id" text PRIMARY KEY NOT NULL,
	"staffId" text NOT NULL,
	"categoryId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "staffPerformance" (
	"id" text PRIMARY KEY NOT NULL,
	"staffId" text NOT NULL,
	"cafeteriaId" text NOT NULL,
	"reportDate" timestamp NOT NULL,
	"totalShifts" integer DEFAULT 0,
	"totalSales" numeric(15, 2) DEFAULT '0',
	"totalOrders" integer DEFAULT 0,
	"averageOrderValue" numeric(10, 2) DEFAULT '0',
	"totalItemsSold" integer DEFAULT 0,
	"totalHoursWorked" numeric(8, 2) DEFAULT '0',
	"generatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "staffSectionAssignments" (
	"id" text PRIMARY KEY NOT NULL,
	"staffId" text NOT NULL,
	"sectionId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "systemConfigs" (
	"id" text PRIMARY KEY NOT NULL,
	"key" varchar(255) NOT NULL,
	"value" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "systemConfigs_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginUsername" varchar(320),
	"passwordHash" text,
	"loginMethod" "login_method" DEFAULT 'email',
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"preferred_language" varchar(10) DEFAULT 'en',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	"cafeteriaId" text,
	"referenceCode" varchar(50),
	"marketerId" text,
	CONSTRAINT "users_openId_unique" UNIQUE("openId"),
	CONSTRAINT "users_loginUsername_unique" UNIQUE("loginUsername")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "withdrawalRequests" (
	"id" text PRIMARY KEY NOT NULL,
	"marketerId" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"status" "withdrawal_status" DEFAULT 'pending',
	"requestedAt" timestamp DEFAULT now() NOT NULL,
	"processedAt" timestamp,
	"processedBy" text,
	"notes" text
);
CREATE TYPE "public"."bill_split_status" AS ENUM('pending', 'partially_paid', 'fully_paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."kitchen_lock_status" AS ENUM('locked', 'unlocked');--> statement-breakpoint
CREATE TYPE "public"."order_escalation_status" AS ENUM('active', 'resolved');--> statement-breakpoint
ALTER TYPE "public"."order_item_status" ADD VALUE 'waiter_review' BEFORE 'pending';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billSplits" (
	"id" text PRIMARY KEY NOT NULL,
	"orderId" text NOT NULL,
	"items" jsonb NOT NULL,
	"totalAmount" numeric(10, 2) NOT NULL,
	"paidAmount" numeric(10, 2) DEFAULT '0',
	"status" "bill_split_status" DEFAULT 'pending',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kitchenLocks" (
	"id" text PRIMARY KEY NOT NULL,
	"orderItemId" text NOT NULL,
	"lockedAt" timestamp DEFAULT now() NOT NULL,
	"lockedBy" text NOT NULL,
	"status" "kitchen_lock_status" DEFAULT 'locked',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "kitchenLocks_orderItemId_unique" UNIQUE("orderItemId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orderEscalations" (
	"id" text PRIMARY KEY NOT NULL,
	"orderId" text NOT NULL,
	"cafeteriaId" text NOT NULL,
	"escalatedAt" timestamp DEFAULT now() NOT NULL,
	"resolvedAt" timestamp,
	"status" "order_escalation_status" DEFAULT 'active',
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'cafeteria_admin';--> statement-breakpoint
ALTER TABLE "cafeteriaStaff" ADD COLUMN "phone" varchar(20);--> statement-breakpoint
ALTER TABLE "cafeteriaStaff" ADD COLUMN "referenceCode" varchar(50);--> statement-breakpoint
ALTER TABLE "cafeterias" ADD COLUMN "subscriptionPlan" varchar(50) DEFAULT 'starter';--> statement-breakpoint
ALTER TABLE "cafeterias" ADD COLUMN "subscriptionStatus" varchar(50) DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "commissionDistributions" ADD COLUMN "percentage" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "commissionDistributions" ADD COLUMN "releasedAt" timestamp;--> statement-breakpoint
ALTER TABLE "ledgerEntries" ADD COLUMN "balanceBefore" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "ledgerEntries" ADD COLUMN "balanceAfter" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "rechargeRequests" ADD COLUMN "paidAmount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "rechargeRequests" ADD COLUMN "paidCurrency" varchar(3);--> statement-breakpoint
ALTER TABLE "rechargeRequests" ADD COLUMN "exchangeRateToUsd" numeric(10, 4);--> statement-breakpoint
ALTER TABLE "rechargeRequests" ADD COLUMN "pointsMultiplier" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "cafeteriaStaff" ADD CONSTRAINT "cafeteriaStaff_referenceCode_unique" UNIQUE("referenceCode");--> statement-breakpoint
ALTER TABLE "public"."cafeteriaStaff" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."staff_role";--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('cafeteria_admin', 'manager', 'waiter', 'chef');--> statement-breakpoint
ALTER TABLE "public"."cafeteriaStaff" ALTER COLUMN "role" SET DATA TYPE "public"."staff_role" USING "role"::"public"."staff_role";--> statement-breakpoint
ALTER TABLE "public"."users" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."user_role";--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'marketer', 'cafeteria_admin', 'manager', 'waiter', 'chef');--> statement-breakpoint
ALTER TABLE "public"."users" ALTER COLUMN "role" SET DATA TYPE "public"."user_role" USING "role"::"public"."user_role";ALTER TABLE "cafeterias" ALTER COLUMN "subscriptionPlan" SET DEFAULT 'starter';CREATE TABLE IF NOT EXISTS "billSplitItems" (
	"id" text PRIMARY KEY NOT NULL,
	"orderId" text NOT NULL,
	"splitId" text NOT NULL,
	"payerId" text NOT NULL,
	"orderItemId" text NOT NULL,
	"amount" numeric(10, 2),
	"description" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billSplitPayments" (
	"id" text PRIMARY KEY NOT NULL,
	"orderId" text NOT NULL,
	"splitId" text NOT NULL,
	"payerId" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"paymentMethod" varchar(50) NOT NULL,
	"notes" text,
	"recordedBy" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cafeterias" ADD COLUMN "phone" varchar(20);--> statement-breakpoint
ALTER TABLE "cafeterias" ADD COLUMN "latitude" numeric(10, 8);--> statement-breakpoint
ALTER TABLE "cafeterias" ADD COLUMN "longitude" numeric(11, 8);--> statement-breakpoint
ALTER TABLE "cafeterias" ADD COLUMN "tax_rate" numeric(5, 4) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "cafeterias" ADD COLUMN "service_charge" numeric(5, 4) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "cafeterias" ADD COLUMN "auto_logout_minutes" integer DEFAULT 120;--> statement-breakpoint
ALTER TABLE "rechargeRequests" ADD COLUMN "payment_method" varchar(50);--> statement-breakpoint
ALTER TABLE "rechargeRequests" ADD COLUMN "attachmentUrls" jsonb DEFAULT '[]'::jsonb;-- Migration: Add Payment Method Field to Recharge Requests
-- Date: April 1, 2026
-- Purpose: Store payment method as a dedicated field instead of in notes

ALTER TABLE "rechargeRequests"
ADD COLUMN IF NOT EXISTS "payment_method" varchar(50);

-- Create index for payment method queries
CREATE INDEX IF NOT EXISTS "idx_rechargeRequests_payment_method" ON "rechargeRequests"("payment_method");
-- Migration: Add missing recharge fields for proper workflow support
-- This migration adds support for:
-- 1. Multiple attachment URLs (images and PDFs)
-- 2. New status values (under_review, charged)
-- 3. Review tracking (reviewedAt, reviewedBy)
-- 4. Points approval tracking (pointsApproved)
-- 5. Updated timestamp for tracking changes

-- Add new columns to rechargeRequests table
ALTER TABLE "rechargeRequests" 
ADD COLUMN IF NOT EXISTS "attachmentUrls" text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "reviewedAt" timestamp,
ADD COLUMN IF NOT EXISTS "reviewedBy" text,
ADD COLUMN IF NOT EXISTS "pointsApproved" decimal(10, 2),
ADD COLUMN IF NOT EXISTS "updatedAt" timestamp DEFAULT now();

-- Update the recharge_status enum to include new statuses
-- Note: PostgreSQL doesn't allow direct enum modification, so we'll create a new enum
-- and migrate data in the application layer

-- Create an index on status for faster queries
CREATE INDEX IF NOT EXISTS "idx_rechargeRequests_status" ON "rechargeRequests"("status");

-- Create an index on cafeteriaId for faster queries
CREATE INDEX IF NOT EXISTS "idx_rechargeRequests_cafeteriaId" ON "rechargeRequests"("cafeteriaId");

-- Create an index on createdAt for sorting
CREATE INDEX IF NOT EXISTS "idx_rechargeRequests_createdAt" ON "rechargeRequests"("createdAt" DESC);
-- Add entity_status enum type if it doesn't exist
DO $$ BEGIN
  CREATE TYPE entity_status AS ENUM ('active', 'frozen');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add status column to marketers table
ALTER TABLE marketers ADD COLUMN IF NOT EXISTS status entity_status DEFAULT 'active';

-- Add status column to cafeterias table
ALTER TABLE cafeterias ADD COLUMN IF NOT EXISTS status entity_status DEFAULT 'active';
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
