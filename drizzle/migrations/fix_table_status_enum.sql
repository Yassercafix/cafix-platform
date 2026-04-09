-- ============================================================================
-- FIX: table_status enum migration
-- 
-- Root cause: The live DB has table_status = ('available','occupied','reserved','cleaning')
-- but the application code inserts status = 'free' which does not exist in the enum.
-- This migration aligns the DB enum with the application code.
-- ============================================================================

-- Step 1: Add new enum values that the application code expects
-- PostgreSQL does not allow removing enum values, only adding.
-- We add the new values first, then update the default and existing rows.

ALTER TYPE "public"."table_status" ADD VALUE IF NOT EXISTS 'free';
ALTER TYPE "public"."table_status" ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE "public"."table_status" ADD VALUE IF NOT EXISTS 'ready';
ALTER TYPE "public"."table_status" ADD VALUE IF NOT EXISTS 'served';

-- Step 2: Update the default value for the status column to 'free'
ALTER TABLE "cafeteriaTables" ALTER COLUMN "status" SET DEFAULT 'free';

-- Step 3: Migrate existing rows that use old enum values to new ones
UPDATE "cafeteriaTables" SET "status" = 'free'       WHERE "status" = 'available';
UPDATE "cafeteriaTables" SET "status" = 'occupied'   WHERE "status" = 'reserved';
UPDATE "cafeteriaTables" SET "status" = 'in_progress' WHERE "status" = 'cleaning';

-- Note: 'occupied' maps to 'occupied' (same value, no change needed)
-- Old values 'available', 'reserved', 'cleaning' are kept in the enum
-- (PostgreSQL does not support removing enum values without a full type rebuild)
-- but the application will only use the new values going forward.
