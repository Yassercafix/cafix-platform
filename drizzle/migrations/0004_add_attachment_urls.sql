CREATE TABLE IF NOT EXISTS "billSplitItems" (
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
ALTER TABLE "rechargeRequests" ADD COLUMN "attachmentUrls" jsonb DEFAULT '[]'::jsonb;