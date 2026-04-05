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
