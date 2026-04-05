-- Migration: Add Payment Method Field to Recharge Requests
-- Date: April 1, 2026
-- Purpose: Store payment method as a dedicated field instead of in notes

ALTER TABLE "rechargeRequests"
ADD COLUMN IF NOT EXISTS "payment_method" varchar(50);

-- Create index for payment method queries
CREATE INDEX IF NOT EXISTS "idx_rechargeRequests_payment_method" ON "rechargeRequests"("payment_method");
