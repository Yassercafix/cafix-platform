import { drizzle } from "drizzle-orm/better-sqlite3";
// @ts-ignore - better-sqlite3 may not be installed in all environments
import Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import * as schema from "../drizzle/schema-sqlite.js";
import { nanoid } from "nanoid";
import { ENV } from './_core/env.js';

let _db: any = null;
let _sqlite: any = null;

export async function getDb() {
  if (!_db) {
    _sqlite = new Database("cafeteria.db");
    _db = drizzle(_sqlite, { schema });
    
    // Create tables if they don't exist
    // This is a simplified way for testing
    _sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        openId TEXT NOT NULL UNIQUE,
        name TEXT,
        email TEXT,
        loginUsername TEXT UNIQUE,
        passwordHash TEXT,
        loginMethod TEXT DEFAULT 'email',
        role TEXT DEFAULT 'cafeteria_admin' NOT NULL,
        preferred_language TEXT DEFAULT 'en',
        createdAt INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
        lastSignedIn INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
        cafeteriaId TEXT,
        referenceCode TEXT,
        marketerId TEXT
      );
      CREATE TABLE IF NOT EXISTS marketers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        loginUsername TEXT UNIQUE,
        passwordHash TEXT,
        parentId TEXT,
        referenceCode TEXT UNIQUE,
        isAdminFrozen INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        country TEXT,
        currency TEXT,
        currencyOverrideBy TEXT,
        language TEXT DEFAULT 'en',
        createdAt INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS cafeterias (
        id TEXT PRIMARY KEY,
        marketerId TEXT NOT NULL,
        name TEXT NOT NULL,
        location TEXT,
        loginUsername TEXT UNIQUE,
        passwordHash TEXT,
        pointsBalance TEXT DEFAULT '0',
        graceMode INTEGER DEFAULT 0,
        referenceCode TEXT UNIQUE,
        country TEXT,
        currency TEXT,
        currencyOverrideBy TEXT,
        language TEXT DEFAULT 'en',
        freeOperationEndDate INTEGER,
        subscriptionPlan TEXT DEFAULT 'starter',
        subscriptionStatus TEXT DEFAULT 'active',
        phone TEXT,
        latitude REAL,
        longitude REAL,
        tax_rate TEXT DEFAULT '0.00',
        service_charge TEXT DEFAULT '0.00',
        auto_logout_minutes INTEGER DEFAULT 120,
        isAdminFrozen INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        createdAt INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS rechargeRequests (
        id TEXT PRIMARY KEY,
        cafeteriaId TEXT NOT NULL,
        amount TEXT NOT NULL,
        imageUrl TEXT,
        status TEXT DEFAULT 'pending',
        processedAt INTEGER,
        processedBy TEXT,
        notes TEXT,
        payment_method TEXT,
        commissionCalculated INTEGER DEFAULT 0,
        commissionDistributionId TEXT,
        pointsAddedToBalance TEXT DEFAULT '0',
        paidAmount TEXT,
        paidCurrency TEXT,
        exchangeRateToUsd TEXT,
        pointsMultiplier TEXT,
        country TEXT,
        currency TEXT,
        language TEXT,
        attachmentUrls TEXT,
        createdAt INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS menuCategories (
        id TEXT PRIMARY KEY,
        cafeteriaId TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        displayOrder INTEGER DEFAULT 0,
        isActive INTEGER DEFAULT 1,
        createdAt INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS menuItems (
        id TEXT PRIMARY KEY,
        categoryId TEXT NOT NULL,
        cafeteriaId TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        price TEXT NOT NULL,
        imageUrl TEXT,
        isAvailable INTEGER DEFAULT 1,
        displayOrder INTEGER DEFAULT 0,
        createdAt INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        cafeteriaId TEXT NOT NULL,
        tableId TEXT,
        waiterId TEXT,
        status TEXT DEFAULT 'created' NOT NULL,
        totalAmount TEXT NOT NULL,
        pointsDeducted TEXT DEFAULT '0',
        paidAt INTEGER,
        createdAt INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS orderItems (
        id TEXT PRIMARY KEY,
        orderId TEXT NOT NULL,
        menuItemId TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unitPrice TEXT NOT NULL,
        totalPrice TEXT NOT NULL,
        status TEXT DEFAULT 'created' NOT NULL,
        createdAt INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS cafeteriaTables (
        id TEXT PRIMARY KEY,
        cafeteriaId TEXT NOT NULL,
        sectionId TEXT,
        name TEXT NOT NULL,
        referenceCode TEXT UNIQUE,
        status TEXT DEFAULT 'free',
        capacity INTEGER DEFAULT 4,
        qrCodeUrl TEXT,
        createdAt INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS cafeteriaStaff (
        id TEXT PRIMARY KEY,
        cafeteriaId TEXT NOT NULL,
        userId TEXT,
        name TEXT NOT NULL,
        email TEXT,
        loginUsername TEXT UNIQUE,
        passwordHash TEXT,
        role TEXT NOT NULL,
        referenceCode TEXT UNIQUE,
        status TEXT DEFAULT 'active',
        canLogin INTEGER DEFAULT 1,
        loginPermissionGrantedAt INTEGER,
        loginPermissionGrantedBy TEXT,
        createdAt INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS sections (
        id TEXT PRIMARY KEY,
        cafeteriaId TEXT NOT NULL,
        name TEXT NOT NULL,
        displayOrder INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS ledgerEntries (
        id TEXT PRIMARY KEY,
        entityId TEXT NOT NULL,
        entityType TEXT NOT NULL,
        type TEXT NOT NULL,
        amount TEXT NOT NULL,
        description TEXT,
        createdAt INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS marketerBalances (
        id TEXT PRIMARY KEY,
        marketerId TEXT NOT NULL UNIQUE,
        pendingBalance TEXT DEFAULT '0',
        availableBalance TEXT DEFAULT '0',
        totalWithdrawn TEXT DEFAULT '0',
        lastUpdated INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS commissionDistributions (
        id TEXT PRIMARY KEY,
        rechargeRequestId TEXT NOT NULL,
        marketerId TEXT NOT NULL,
        commissionAmount TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        createdAt INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS withdrawalRequests (
        id TEXT PRIMARY KEY,
        marketerId TEXT NOT NULL,
        amount TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        requestedAt INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS systemConfigs (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS staffSectionAssignments (
        id TEXT PRIMARY KEY,
        staffId TEXT NOT NULL,
        sectionId TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS staffCategoryAssignments (
        id TEXT PRIMARY KEY,
        staffId TEXT NOT NULL,
        categoryId TEXT NOT NULL
      );
    `);
  }
  return _db;
}

// Re-implement necessary helpers using SQLite
export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  const result = db.select().from(schema.users).where(sql`openId = ${openId}`).limit(1).all();
  return result[0];
}

export async function upsertUser(user: any): Promise<void> {
  const db = await getDb();
  const existing = db.select().from(schema.users).where(sql`openId = ${user.openId}`).limit(1).all();
  
  if (existing.length > 0) {
    db.update(schema.users).set(user).where(sql`openId = ${user.openId}`).run();
  } else {
    db.insert(schema.users).values({
      id: nanoid(),
      ...user,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }).run();
  }
}
