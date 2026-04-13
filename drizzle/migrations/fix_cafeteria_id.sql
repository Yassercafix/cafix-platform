-- Migration: Fix cafeteriaId column case sensitivity in orders table
-- Date: April 13, 2026
-- Purpose: Ensure the orders table has the exact "cafeteriaId" column (quoted for case sensitivity) as expected by the backend.

DO $$ 
BEGIN
    -- Check if 'cafeteriaid' (lowercase) exists and rename it to 'cafeteriaId'
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'cafeteriaid'
    ) THEN
        ALTER TABLE "orders" RENAME COLUMN "cafeteriaid" TO "cafeteriaId";
    
    -- Check if 'cafeteria_id' (snake_case) exists and rename it to 'cafeteriaId'
    ELSIF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'cafeteria_id'
    ) THEN
        ALTER TABLE "orders" RENAME COLUMN "cafeteria_id" TO "cafeteriaId";
    
    -- If 'cafeteriaId' (correct case) does not exist at all, add it
    ELSIF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'cafeteriaId'
    ) THEN
        ALTER TABLE "orders" ADD COLUMN "cafeteriaId" TEXT NOT NULL;
    END IF;
END $$;
