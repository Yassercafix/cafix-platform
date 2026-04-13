-- Migration: Fix order_status enum missing values
-- Date: April 13, 2026
-- Purpose: Add missing values 'pending', 'preparing', 'ready', 'served' to the order_status enum to match backend expectations.

-- PostgreSQL doesn't allow adding enum values inside a transaction (DO block) easily in all versions,
-- so we use direct ALTER TYPE statements.

ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'preparing';
ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'ready';
ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'served';
