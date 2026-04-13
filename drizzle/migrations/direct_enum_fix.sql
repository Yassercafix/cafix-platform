-- DIRECT SQL FIX: order_status enum
-- Execute these statements directly on the database

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'preparing';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'ready';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'served';
