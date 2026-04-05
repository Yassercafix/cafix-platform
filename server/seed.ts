/**
 * Database Seed Script
 * Creates initial owner user and test admin user with login credentials.
 * Safe to run multiple times — uses INSERT ... ON CONFLICT DO NOTHING.
 */
import "dotenv/config";
import { getDb } from "./db.js";
import { users } from "../drizzle/schema.js";
import bcryptjs from "bcryptjs";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";

const SALT_ROUNDS = 10;

async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, SALT_ROUNDS);
}

async function seed() {
  const db = await getDb();
  if (!db) {
    console.error("Failed to connect to database");
    process.exit(1);
  }

  try {
    console.log("🌱 Starting database seed...");

    // ── 1. Owner user ──────────────────────────────────────────────────────────
    const ownerEmail = "yaserras@gmail.com";
    const existingOwner = await db.select().from(users).where(eq(users.email, ownerEmail));

    if (existingOwner.length === 0) {
      const ownerPassword = "Kamel123321$";
      const ownerPasswordHash = await hashPassword(ownerPassword);
      const ownerId = nanoid();
      const ownerOpenId = `owner_${ownerId}`;

      await db.insert(users).values({
        id: ownerId,
        openId: ownerOpenId,
        name: "System Owner",
        email: ownerEmail,
        loginUsername: ownerEmail,
        passwordHash: ownerPasswordHash,
        loginMethod: "email",
        role: "owner",
        referenceCode: "10",
        preferredLanguage: "en",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      });

      console.log("✅ Owner user created successfully!");
      console.log(`   Username: ${ownerEmail}`);
      console.log(`   Password: ${ownerPassword}`);
    } else {
      console.log("ℹ️  Owner user already exists — skipping.");
    }

    // ── 2. Test admin user (admin@cafeteria.com / 123456) ─────────────────────
    const adminEmail = "admin@cafeteria.com";
    const existingAdmin = await db.select().from(users).where(eq(users.email, adminEmail));

    if (existingAdmin.length === 0) {
      const adminPassword = "123456";
      const adminPasswordHash = await hashPassword(adminPassword);
      const adminId = nanoid();
      const adminOpenId = `admin_${adminId}`;

      await db.insert(users).values({
        id: adminId,
        openId: adminOpenId,
        name: "Cafeteria Admin",
        email: adminEmail,
        loginUsername: adminEmail,
        passwordHash: adminPasswordHash,
        loginMethod: "email",
        role: "cafeteria_admin",
        preferredLanguage: "en",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      });

      console.log("✅ Test admin user created successfully!");
      console.log("📝 Test Login Credentials:");
      console.log(`   Email:    ${adminEmail}`);
      console.log(`   Password: ${adminPassword}`);
      console.log(`   Role:     admin (cafeteria_admin)`);
    } else {
      console.log("ℹ️  Test admin user (admin@cafeteria.com) already exists — skipping.");
    }

    console.log("🎉 Seed completed successfully!");

  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

seed();
