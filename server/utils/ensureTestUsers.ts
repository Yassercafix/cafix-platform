/**
 * ensureTestUsers
 *
 * Idempotently creates required seed / test users on server startup.
 * Safe to call multiple times — skips insertion if the user already exists.
 */
import { getDb } from "../db.js";
import { users } from "../../drizzle/schema.js";
import bcryptjs from "bcryptjs";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";

const SALT_ROUNDS = 10;

async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, SALT_ROUNDS);
}

interface TestUser {
  email: string;
  password: string;
  name: string;
  role: "owner" | "marketer" | "cafeteria_admin" | "manager" | "waiter" | "chef";
}

const TEST_USERS: TestUser[] = [
  {
    email: "owner@cafeteria.com",
    password: "123456",
    name: "System Owner",
    role: "owner",
  },
  {
    email: "admin@cafeteria.com",
    password: "123456",
    name: "Cafeteria Admin",
    role: "cafeteria_admin",
  },
  {
    email: "manager@cafeteria.com",
    password: "123456",
    name: "Cafeteria Manager",
    role: "manager",
  },
  {
    email: "waiter@cafeteria.com",
    password: "123456",
    name: "Waiter Staff",
    role: "waiter",
  },
  {
    email: "chef@cafeteria.com",
    password: "123456",
    name: "Chef Staff",
    role: "chef",
  },
  {
    email: "marketer@cafeteria.com",
    password: "123456",
    name: "Marketing Manager",
    role: "marketer",
  },
];

export async function ensureTestUsers(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[ensureTestUsers] Database not available — skipping.");
    return;
  }

  console.log("[ensureTestUsers] Starting test user provisioning...");

  for (const testUser of TEST_USERS) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, testUser.email));

    if (existing.length === 0) {
      const passwordHash = await hashPassword(testUser.password);
      const userId = nanoid();
      const openId = `${testUser.role}_${userId}`;

      await db.insert(users).values({
        id: userId,
        openId: openId,
        name: testUser.name,
        email: testUser.email,
        loginUsername: testUser.email,
        passwordHash: passwordHash,
        loginMethod: "email",
        role: testUser.role,
        preferredLanguage: "en",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      });

      console.log(
        `[ensureTestUsers] ✅ Test user created: ${testUser.email} (${testUser.role})`
      );
    } else {
      console.log(
        `[ensureTestUsers] ℹ️  Test user already exists: ${testUser.email} — skipping.`
      );
    }
  }

  console.log("[ensureTestUsers] ✅ Test user provisioning completed.");
}
