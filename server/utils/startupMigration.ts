/**
 * Startup Migration Utility
 *
 * Applies safe, idempotent ALTER TABLE migrations at server startup.
 * Uses guarded SQL so it is safe to run multiple times.
 *
 * This resolves legacy schema issues around sections and cafeteria tables,
 * and patches old table status values so the live database matches the
 * current application enum contract.
 */
import { getDb } from "../db.js";
import { sql } from "drizzle-orm";

const MIGRATIONS: { name: string; sql: string }[] = [
  {
    name: "sections: add cafeteriaId column",
    sql: `ALTER TABLE "sections" ADD COLUMN IF NOT EXISTS "cafeteriaId" text NOT NULL DEFAULT ''`,
  },
  {
    name: "sections: add name column",
    sql: `ALTER TABLE "sections" ADD COLUMN IF NOT EXISTS "name" varchar(255) NOT NULL DEFAULT ''`,
  },
  {
    name: "sections: add displayOrder column",
    sql: `ALTER TABLE "sections" ADD COLUMN IF NOT EXISTS "displayOrder" integer DEFAULT 0`,
  },
  {
    name: "sections: add createdAt column",
    sql: `ALTER TABLE "sections" ADD COLUMN IF NOT EXISTS "createdAt" timestamp DEFAULT now() NOT NULL`,
  },
  {
    name: "cafeteriaTables: add cafeteriaId column",
    sql: `ALTER TABLE "cafeteriaTables" ADD COLUMN IF NOT EXISTS "cafeteriaId" text NOT NULL DEFAULT ''`,
  },
  {
    name: "cafeteriaTables: add sectionId column",
    sql: `ALTER TABLE "cafeteriaTables" ADD COLUMN IF NOT EXISTS "sectionId" text`,
  },
  {
    name: "cafeteriaTables: add tableNumber column",
    sql: `ALTER TABLE "cafeteriaTables" ADD COLUMN IF NOT EXISTS "tableNumber" integer NOT NULL DEFAULT 0`,
  },
  {
    name: "cafeteriaTables: add capacity column",
    sql: `ALTER TABLE "cafeteriaTables" ADD COLUMN IF NOT EXISTS "capacity" integer`,
  },
  {
    name: "cafeteriaTables: add tableToken column",
    sql: `ALTER TABLE "cafeteriaTables" ADD COLUMN IF NOT EXISTS "tableToken" varchar(64)`,
  },
  {
    name: "cafeteriaTables: add createdAt column",
    sql: `ALTER TABLE "cafeteriaTables" ADD COLUMN IF NOT EXISTS "createdAt" timestamp DEFAULT now() NOT NULL`,
  },
  {
    name: "cafeterias: add subscriptionPlan column",
    sql: `ALTER TABLE "cafeterias" ADD COLUMN IF NOT EXISTS "subscriptionPlan" varchar(50) DEFAULT 'starter'`,
  },
  {
    name: "cafeterias: add subscriptionStatus column",
    sql: `ALTER TABLE "cafeterias" ADD COLUMN IF NOT EXISTS "subscriptionStatus" varchar(50) DEFAULT 'active'`,
  },
  {
    name: "sections: create table if not exists",
    sql: `
      CREATE TABLE IF NOT EXISTS "sections" (
        "id" text PRIMARY KEY NOT NULL,
        "cafeteriaId" text NOT NULL DEFAULT '',
        "name" varchar(255) NOT NULL DEFAULT '',
        "displayOrder" integer DEFAULT 0,
        "createdAt" timestamp DEFAULT now() NOT NULL
      )
    `,
  },
  {
    name: "cafeteriaTables: create table if not exists",
    sql: `
      CREATE TABLE IF NOT EXISTS "cafeteriaTables" (
        "id" text PRIMARY KEY NOT NULL,
        "cafeteriaId" text NOT NULL DEFAULT '',
        "sectionId" text,
        "tableNumber" integer NOT NULL DEFAULT 0,
        "capacity" integer,
        "status" varchar(50) DEFAULT 'available',
        "tableToken" varchar(64),
        "createdAt" timestamp DEFAULT now() NOT NULL
      )
    `,
  },
  {
    name: "cafeteriaTables: normalize legacy free status values",
    sql: `
      UPDATE "cafeteriaTables"
      SET "status" = 'available'
      WHERE "status" = 'free'
    `,
  },
  {
    name: "postgres enum: allow available for table_status",
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type t
          WHERE t.typname = 'table_status'
        ) THEN
          ALTER TYPE "table_status" ADD VALUE IF NOT EXISTS 'available';
        END IF;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `,
  },
  {
    name: "postgres enum: rename free to available for table_status",
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'table_status'
            AND e.enumlabel = 'free'
        ) THEN
          ALTER TYPE "table_status" RENAME VALUE 'free' TO 'available';
        END IF;
      EXCEPTION
        WHEN invalid_parameter_value THEN NULL;
        WHEN duplicate_object THEN NULL;
      END $$;
    `,
  },
  {
    name: "postgres enum: ensure order_status has all required values",
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type t
          WHERE t.typname = 'order_status'
        ) THEN
          ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'pending';
          ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'created';
          ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'sent_to_kitchen';
          ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'preparing';
          ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'ready';
          ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'served';
          ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'paid';
        END IF;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `,
  },
  {
    name: "postgres enum: ensure order_item_status has all required values",
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type t
          WHERE t.typname = 'order_item_status'
        ) THEN
          ALTER TYPE "order_item_status" ADD VALUE IF NOT EXISTS 'pending';
          ALTER TYPE "order_item_status" ADD VALUE IF NOT EXISTS 'created';
          ALTER TYPE "order_item_status" ADD VALUE IF NOT EXISTS 'preparing';
          ALTER TYPE "order_item_status" ADD VALUE IF NOT EXISTS 'paid';
        END IF;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `,
  },
  {
    name: "postgres enum: allow occupied for table_status",
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type t
          WHERE t.typname = 'table_status'
        ) THEN
          ALTER TYPE "table_status" ADD VALUE IF NOT EXISTS 'occupied';
        END IF;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `,
  },
  {
    name: "serviceRequests: create service_request_status enum if not exists",
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'service_request_status'
        ) THEN
          CREATE TYPE "service_request_status" AS ENUM('pending', 'completed');
        END IF;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `,
  },
  {
    name: "serviceRequests: create serviceRequests table if not exists",
    sql: `
      CREATE TABLE IF NOT EXISTS "serviceRequests" (
        "id" text PRIMARY KEY NOT NULL,
        "cafeteriaId" text NOT NULL,
        "tableId" text NOT NULL,
        "requestType" varchar(50) NOT NULL,
        "status" "service_request_status" NOT NULL DEFAULT 'pending',
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "completedAt" timestamp
      )
    `,
  },
  {
    name: "orders: ensure source column exists",
    sql: `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "source" varchar(50) DEFAULT 'staff'`,
  },
  {
    name: "orders: ensure pointsConsumed column exists",
    sql: `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "pointsConsumed" decimal(10,2) DEFAULT '0'`,
  },
  {
    name: "orders: ensure totalAmount column exists",
    sql: `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "totalAmount" decimal(10,2) DEFAULT '0'`,
  },
  {
    name: "orderItems: ensure notes column exists",
    sql: `ALTER TABLE "orderItems" ADD COLUMN IF NOT EXISTS "notes" text`,
  },
];

let migrationRan = false;

export async function runStartupMigrations(): Promise<void> {
  if (migrationRan) return;
  migrationRan = true;

  let db: any;
  try {
    db = await getDb();
  } catch (err) {
    console.error("[StartupMigration] Could not get DB — skipping migrations:", err);
    return;
  }

  console.log("[StartupMigration] Running startup migrations...");

  for (const migration of MIGRATIONS) {
    try {
      await db.execute(sql.raw(migration.sql));
      console.log(`[StartupMigration] ✓ ${migration.name}`);
    } catch (err: any) {
      const msg = err?.message ?? "";
      if (
        msg.includes("already exists") ||
        msg.includes("duplicate column") ||
        msg.includes("does not exist") ||
        msg.includes("cannot be cast automatically")
      ) {
        console.log(`[StartupMigration] ~ ${migration.name} (skipped: ${msg.split("\n")[0]})`);
      } else {
        console.error(`[StartupMigration] ✗ ${migration.name}:`, msg);
      }
    }
  }

  console.log("[StartupMigration] Startup migrations complete.");
}
