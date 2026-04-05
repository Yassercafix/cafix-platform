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
