/**
 * PHASE 1 IDENTITY MODEL FIX
 * 
 * This script:
 * 1. Ensures owner has a Supabase Auth account (already exists: owner@cafeteria.com)
 * 2. Creates Supabase Auth accounts for all existing marketers that lack them
 * 3. Creates Supabase Auth accounts for all existing cafeterias that lack them
 * 4. Creates test staff in cafeteriaStaff table with Supabase Auth accounts
 * 5. Ensures all users in users table that are staff roles have Supabase Auth
 * 6. Fixes password hashing for any plaintext passwords
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { getDb } from "./db.js";
import { users, marketers, cafeterias, cafeteriaStaff } from "../drizzle/schema.js";
import bcryptjs from "bcryptjs";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";

const SALT_ROUNDS = 10;
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

interface FixResult {
  role: string;
  email: string;
  action: string;
  status: "ok" | "created" | "skipped" | "error";
  detail?: string;
}

const results: FixResult[] = [];

async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, SALT_ROUNDS);
}

async function isValidHash(str: string): Promise<boolean> {
  // bcrypt hashes start with $2a$ or $2b$
  return str.startsWith("$2a$") || str.startsWith("$2b$");
}

async function ensureSupabaseAuth(
  supabase: any,
  email: string,
  password: string,
  name: string,
  role: string,
  metadata: Record<string, any> = {}
): Promise<{ created: boolean; authId?: string; error?: string }> {
  try {
    // Try to create the user
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role, ...metadata },
    });

    if (error) {
      if (
        error.message?.includes("already been registered") ||
        error.message?.includes("already exists") ||
        error.message?.includes("duplicate")
      ) {
        // User already exists in Supabase Auth - that's fine
        return { created: false };
      }
      return { created: false, error: error.message };
    }

    return { created: true, authId: data.user?.id };
  } catch (err: any) {
    return { created: false, error: err.message };
  }
}

async function main() {
  console.log("=== PHASE 1 IDENTITY MODEL FIX ===\n");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const db = await getDb();
  if (!db) {
    console.error("FATAL: Database connection failed");
    process.exit(1);
  }
  console.log("✅ DB connected\n");

  // ── 1. OWNER ──────────────────────────────────────────────────────────────
  console.log("--- [1/5] OWNER ---");
  const ownerRows = await db.select().from(users).where(eq(users.role, "owner"));
  for (const owner of ownerRows) {
    const email = owner.email || owner.loginUsername || "";
    if (!email) {
      results.push({ role: "owner", email: "unknown", action: "skip - no email", status: "skipped" });
      continue;
    }
    // Ensure Supabase Auth exists
    const authResult = await ensureSupabaseAuth(supabase, email, "Kamel123321$", owner.name || "System Owner", "owner", {
      referenceCode: owner.referenceCode,
    });
    if (authResult.error) {
      console.log(`  ⚠️  Owner ${email}: Supabase Auth error: ${authResult.error}`);
      results.push({ role: "owner", email, action: "ensure_auth", status: "error", detail: authResult.error });
    } else if (authResult.created) {
      console.log(`  ✅ Owner ${email}: Supabase Auth account CREATED`);
      results.push({ role: "owner", email, action: "created_auth", status: "created" });
    } else {
      console.log(`  ✅ Owner ${email}: Supabase Auth account already exists`);
      results.push({ role: "owner", email, action: "auth_exists", status: "ok" });
    }

    // Ensure passwordHash in DB (for fallback auth.ts login)
    if (!owner.passwordHash) {
      const hash = await hashPassword("Kamel123321$");
      await db.update(users).set({ passwordHash: hash }).where(eq(users.id, owner.id));
      console.log(`  ✅ Owner ${email}: passwordHash added to DB`);
    } else {
      console.log(`  ✅ Owner ${email}: passwordHash already in DB`);
    }
  }

  // ── 2. USERS TABLE (staff roles: manager, waiter, chef, cafeteria_admin, marketer) ──
  console.log("\n--- [2/5] USERS TABLE (non-owner roles) ---");
  const nonOwnerUsers = await db.select().from(users);
  for (const u of nonOwnerUsers) {
    if (u.role === "owner") continue;
    const email = u.email || u.loginUsername || "";
    if (!email) continue;

    // Fix plaintext password if needed
    let password = "123456"; // default test password
    if (u.passwordHash && !(await isValidHash(u.passwordHash))) {
      // It's plaintext - hash it
      const plaintext = u.passwordHash;
      password = plaintext;
      const hash = await hashPassword(plaintext);
      await db.update(users).set({ passwordHash: hash }).where(eq(users.id, u.id));
      console.log(`  🔧 ${u.role} ${email}: Fixed plaintext password → hashed`);
    }

    // Ensure Supabase Auth
    const authResult = await ensureSupabaseAuth(supabase, email, password, u.name || email, u.role || "user", {
      referenceCode: u.referenceCode,
    });
    if (authResult.error) {
      console.log(`  ⚠️  ${u.role} ${email}: Supabase Auth error: ${authResult.error}`);
      results.push({ role: u.role || "user", email, action: "ensure_auth", status: "error", detail: authResult.error });
    } else if (authResult.created) {
      console.log(`  ✅ ${u.role} ${email}: Supabase Auth account CREATED`);
      results.push({ role: u.role || "user", email, action: "created_auth", status: "created" });
    } else {
      console.log(`  ✅ ${u.role} ${email}: Supabase Auth account already exists`);
      results.push({ role: u.role || "user", email, action: "auth_exists", status: "ok" });
    }
  }

  // ── 3. MARKETERS ──────────────────────────────────────────────────────────
  console.log("\n--- [3/5] MARKETERS ---");
  const allMarketers = await db.select().from(marketers);
  for (const m of allMarketers) {
    const email = m.email || m.loginUsername || "";
    if (!email) continue;

    // Fix plaintext password if needed
    let password = "Cafix2026!"; // default
    if (m.passwordHash) {
      if (!(await isValidHash(m.passwordHash))) {
        // Plaintext - hash it
        password = m.passwordHash;
        const hash = await hashPassword(m.passwordHash);
        await db.update(marketers).set({ passwordHash: hash }).where(eq(marketers.id, m.id));
        console.log(`  🔧 Marketer ${email}: Fixed plaintext password → hashed`);
      }
    }

    // Ensure Supabase Auth
    const authResult = await ensureSupabaseAuth(supabase, email, password, m.name, "marketer", {
      referenceCode: m.referenceCode,
    });
    if (authResult.error) {
      console.log(`  ⚠️  Marketer ${email}: Supabase Auth error: ${authResult.error}`);
      results.push({ role: "marketer", email, action: "ensure_auth", status: "error", detail: authResult.error });
    } else if (authResult.created) {
      console.log(`  ✅ Marketer ${email} (ref=${m.referenceCode}): Supabase Auth CREATED`);
      results.push({ role: "marketer", email, action: "created_auth", status: "created" });
    } else {
      console.log(`  ✅ Marketer ${email} (ref=${m.referenceCode}): Supabase Auth already exists`);
      results.push({ role: "marketer", email, action: "auth_exists", status: "ok" });
    }
  }

  // ── 4. CAFETERIAS ─────────────────────────────────────────────────────────
  console.log("\n--- [4/5] CAFETERIAS ---");
  const allCafeterias = await db.select().from(cafeterias);
  for (const c of allCafeterias) {
    const email = c.loginUsername || "";
    if (!email) continue;

    // Fix plaintext password if needed
    let password = "Cafix2026!"; // default
    if (c.passwordHash) {
      if (!(await isValidHash(c.passwordHash))) {
        password = c.passwordHash;
        const hash = await hashPassword(c.passwordHash);
        await db.update(cafeterias).set({ passwordHash: hash }).where(eq(cafeterias.id, c.id));
        console.log(`  🔧 Cafeteria ${email}: Fixed plaintext password → hashed`);
      }
    }

    // Ensure Supabase Auth
    const authResult = await ensureSupabaseAuth(supabase, email, password, c.name, "cafeteria_admin", {
      referenceCode: c.referenceCode,
      cafeteriaId: c.id,
    });
    if (authResult.error) {
      console.log(`  ⚠️  Cafeteria ${email}: Supabase Auth error: ${authResult.error}`);
      results.push({ role: "cafeteria_admin", email, action: "ensure_auth", status: "error", detail: authResult.error });
    } else if (authResult.created) {
      console.log(`  ✅ Cafeteria ${email} (ref=${c.referenceCode}): Supabase Auth CREATED`);
      results.push({ role: "cafeteria_admin", email, action: "created_auth", status: "created" });
    } else {
      console.log(`  ✅ Cafeteria ${email} (ref=${c.referenceCode}): Supabase Auth already exists`);
      results.push({ role: "cafeteria_admin", email, action: "auth_exists", status: "ok" });
    }
  }

  // ── 5. CAFETERIA STAFF (create test staff if none exist) ──────────────────
  console.log("\n--- [5/5] CAFETERIA STAFF ---");
  const allStaff = await db.select().from(cafeteriaStaff);
  
  if (allStaff.length === 0) {
    console.log("  ℹ️  No staff found. Creating test staff members...");
    
    // Find first cafeteria to attach staff to
    const firstCafeteria = allCafeterias[0];
    if (!firstCafeteria) {
      console.log("  ⚠️  No cafeterias found - cannot create test staff");
    } else {
      const testStaff = [
        { email: "waiter@cafix.com", name: "Test Waiter", role: "waiter" as const, password: "Cafix2026!" },
        { email: "chef@cafix.com", name: "Test Chef", role: "chef" as const, password: "Cafix2026!" },
        { email: "manager@cafix.com", name: "Test Manager", role: "manager" as const, password: "Cafix2026!" },
      ];

      for (const staff of testStaff) {
        // Check if already exists
        const existing = await db.select().from(cafeteriaStaff).where(eq(cafeteriaStaff.loginUsername, staff.email));
        if (existing.length > 0) {
          console.log(`  ✅ Staff ${staff.email}: already exists in DB`);
          // Still ensure Supabase Auth
          const authResult = await ensureSupabaseAuth(supabase, staff.email, staff.password, staff.name, staff.role, {
            cafeteriaId: firstCafeteria.id,
          });
          if (authResult.created) {
            console.log(`  ✅ Staff ${staff.email}: Supabase Auth CREATED`);
          }
          results.push({ role: staff.role, email: staff.email, action: "already_exists", status: "ok" });
          continue;
        }

        const passwordHash = await hashPassword(staff.password);
        const staffId = nanoid();
        
        await db.insert(cafeteriaStaff).values({
          id: staffId,
          cafeteriaId: firstCafeteria.id,
          name: staff.name,
          role: staff.role,
          loginUsername: staff.email,
          passwordHash,
          status: "active",
          canLogin: true,
          createdAt: new Date(),
        });

        // Create Supabase Auth account
        const authResult = await ensureSupabaseAuth(supabase, staff.email, staff.password, staff.name, staff.role, {
          cafeteriaId: firstCafeteria.id,
        });

        if (authResult.error) {
          console.log(`  ⚠️  Staff ${staff.email}: DB created but Supabase Auth error: ${authResult.error}`);
          results.push({ role: staff.role, email: staff.email, action: "db_only", status: "error", detail: authResult.error });
        } else if (authResult.created) {
          console.log(`  ✅ Staff ${staff.email} (${staff.role}): DB + Supabase Auth CREATED`);
          results.push({ role: staff.role, email: staff.email, action: "created_both", status: "created" });
        } else {
          console.log(`  ✅ Staff ${staff.email} (${staff.role}): DB created, Supabase Auth already exists`);
          results.push({ role: staff.role, email: staff.email, action: "created_db", status: "created" });
        }
      }
    }
  } else {
    // Fix existing staff
    for (const s of allStaff) {
      const email = s.loginUsername || "";
      if (!email) continue;

      let password = "Cafix2026!";
      if (s.passwordHash) {
        if (!(await isValidHash(s.passwordHash))) {
          password = s.passwordHash;
          const hash = await hashPassword(s.passwordHash);
          await db.update(cafeteriaStaff).set({ passwordHash: hash }).where(eq(cafeteriaStaff.id, s.id));
          console.log(`  🔧 Staff ${email}: Fixed plaintext password → hashed`);
        }
      }

      const authResult = await ensureSupabaseAuth(supabase, email, password, s.name, s.role || "waiter", {
        cafeteriaId: s.cafeteriaId,
      });
      if (authResult.error) {
        console.log(`  ⚠️  Staff ${email}: Supabase Auth error: ${authResult.error}`);
        results.push({ role: s.role || "waiter", email, action: "ensure_auth", status: "error", detail: authResult.error });
      } else if (authResult.created) {
        console.log(`  ✅ Staff ${email} (${s.role}): Supabase Auth CREATED`);
        results.push({ role: s.role || "waiter", email, action: "created_auth", status: "created" });
      } else {
        console.log(`  ✅ Staff ${email} (${s.role}): Supabase Auth already exists`);
        results.push({ role: s.role || "waiter", email, action: "auth_exists", status: "ok" });
      }
    }
  }

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  console.log("\n=== FIX SUMMARY ===");
  const created = results.filter(r => r.status === "created");
  const errors = results.filter(r => r.status === "error");
  const ok = results.filter(r => r.status === "ok");
  
  console.log(`  Created: ${created.length}`);
  console.log(`  Already OK: ${ok.length}`);
  console.log(`  Errors: ${errors.length}`);
  
  if (errors.length > 0) {
    console.log("\nErrors:");
    errors.forEach(e => console.log(`  - ${e.role} ${e.email}: ${e.detail}`));
  }

  console.log("\n✅ Identity model fix complete!");
  process.exit(0);
}

main().catch(err => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
