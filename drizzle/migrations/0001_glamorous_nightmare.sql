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
ALTER TABLE "public"."users" ALTER COLUMN "role" SET DATA TYPE "public"."user_role" USING "role"::"public"."user_role";