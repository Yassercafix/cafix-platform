/**
 * Startup Migration Utility
 *
 * Applies safe, idempotent ALTER TABLE migrations at server startup.
 * Uses "ADD COLUMN IF NOT EXISTS" so it is safe to run multiple times.
 *
 * This resolves the production issue where the `sections` and
 * `cafeteriaTables` tables were created without the `cafeteriaId` column
 * (legacy SQLite-era schema) before the PostgreSQL migration was applied.
 */
import { getDb } from "../db.js";
import { sql } from "drizzle-orm";

const MIGRATIONS: { name: string; sql: string }[] = [
  // ── sections table ────────────────────────────────────────────────────────
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
  // ── cafeteriaTables table ─────────────────────────────────────────────────
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
  // ── cafeterias: ensure subscriptionPlan column exists ─────────────────────
  {
    name: "cafeterias: add subscriptionPlan column",
    sql: `ALTER TABLE "cafeterias" ADD COLUMN IF NOT EXISTS "subscriptionPlan" varchar(50) DEFAULT 'starter'`,
  },
  {
    name: "cafeterias: add subscriptionStatus column",
    sql: `ALTER TABLE "cafeterias" ADD COLUMN IF NOT EXISTS "subscriptionStatus" varchar(50) DEFAULT 'active'`,
  },
  // ── Create sections table if it does not exist at all ─────────────────────
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
  // ── Create cafeteriaTables if it does not exist at all ────────────────────
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
];

let _migrationRan = false;

export async function runStartupMigrations(): Promise<void> {
  if (_migrationRan) return;
  _migrationRan = true;

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
      // Ignore "already exists" or "does not exist" errors — these are expected
      // when the column already exists or the table doesn't exist yet.
      const msg = err?.message ?? "";
      if (
        msg.includes("already exists") ||
        msg.includes("duplicate column") ||
        msg.includes("does not exist")
      ) {
        console.log(`[StartupMigration] ~ ${migration.name} (skipped: ${msg.split("\n")[0]})`);
      } else {
        console.error(`[StartupMigration] ✗ ${migration.name}:`, msg);
      }
    }
  }

  console.log("[StartupMigration] Startup migrations complete.");
}
