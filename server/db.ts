import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, and } from "drizzle-orm";
import * as schema from "../drizzle/schema.js";
import {
  users,
  marketers,
  cafeterias,
  rechargeRequests,
  ledgerEntries,
  marketerBalances,
  commissionDistributions,
  withdrawalRequests,
  sections,
  cafeteriaTables,
  cafeteriaStaff,
  staffSectionAssignments,
  staffCategoryAssignments,
  menuCategories,
  menuItems,
  orders,
  type MarketerBalance,
  type CommissionDistribution,
  type WithdrawalRequest,
} from "../drizzle/schema.js";
import { addPrecise, subtractPrecise } from "./utils/precision.js";

import { nanoid } from "nanoid";

const { Pool } = pg;

// Connection string handling
const connectionString =
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL ||
  "";

if (!connectionString) {
  console.error(
    "[DB] WARNING: Missing database connection string. Set DIRECT_URL or DATABASE_URL."
  );
}

/**
 * IMPORTANT:
 * - Production must ALWAYS use PostgreSQL.
 * - No SQLite fallback here.
 * - This fixes Vercel runtime issues like:
 *   'unable to open database file'
 */
const pool = new Pool({
  connectionString: connectionString || undefined,
  max: 10,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 15000,
  ssl: connectionString
    ? { rejectUnauthorized: false }
    : undefined,
});

export const db = drizzle(pool, {
  schema,
  logger: false,
});

export async function getDb() {
  try {
    return db;
  } catch (err) {
    console.error("[DB] Connection failed:", err);
    throw err;
  }
}

export default db;

// ============================================================================
// Legacy helper functions — required by routers that import them from db.js
// ============================================================================

export async function upsertUser(user: any): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  try {
    const values: any = {
      id: nanoid(),
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    for (const field of textFields) {
      const value = user[field];
      if (value === undefined) continue;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    }

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }

    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  if (result.length === 0) return undefined;

  const user = result[0];

  if (!user.cafeteriaId) {
    const staff = await db
      .select()
      .from(cafeteriaStaff)
      .where(eq(cafeteriaStaff.userId, user.id))
      .limit(1);

    if (staff.length > 0) {
      (user as any).cafeteriaId = staff[0].cafeteriaId;
    }
  }

  return user;
}

export async function getOrCreateMarketerBalance(
  marketerId: string
): Promise<MarketerBalance> {
  const existing = await db
    .select()
    .from(marketerBalances)
    .where(eq(marketerBalances.marketerId, marketerId))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const id = nanoid();
  await db.insert(marketerBalances).values({
    id,
    marketerId,
    pendingBalance: "0",
    availableBalance: "0",
    totalWithdrawn: "0",
  });

  return {
    id,
    marketerId,
    pendingBalance: "0",
    availableBalance: "0",
    totalWithdrawn: "0",
    lastUpdated: new Date(),
  } as MarketerBalance;
}

export async function getMarketerBalance(
  marketerId: string
): Promise<MarketerBalance | null> {
  const marketer = await db
    .select({ status: marketers.status })
    .from(marketers)
    .where(eq(marketers.id, marketerId))
    .limit(1);

  const isFrozen =
    marketer.length > 0 && marketer[0].status === "frozen";

  const result = await db
    .select()
    .from(marketerBalances)
    .where(eq(marketerBalances.marketerId, marketerId))
    .limit(1);

  if (result.length === 0) return null;

  const balance = result[0];

  if (isFrozen) {
    return { ...balance, availableBalance: "0" };
  }

  return balance;
}

export async function transitionCommissionsToAvailable(
  marketerId: string
): Promise<void> {
  await db.transaction(async (tx: any) => {
    const pendingCommissions = await tx
      .select()
      .from(commissionDistributions)
      .where(
        and(
          eq(commissionDistributions.marketerId, marketerId),
          eq(commissionDistributions.status, "pending")
        )
      );

    if (pendingCommissions.length === 0) return;

    const totalPending = pendingCommissions.reduce(
      (sum: any, c: any) => addPrecise(sum, c.commissionAmount),
      0
    );

    if (totalPending > 0) {
      await tx
        .update(commissionDistributions)
        .set({ status: "available" })
        .where(
          and(
            eq(commissionDistributions.marketerId, marketerId),
            eq(commissionDistributions.status, "pending")
          )
        );

      const balanceRows = await tx
        .select()
        .from(marketerBalances)
        .where(eq(marketerBalances.marketerId, marketerId))
        .limit(1);

      const balance = balanceRows[0];

      if (!balance) {
        await tx.insert(marketerBalances).values({
          id: nanoid(),
          marketerId,
          pendingBalance: "0",
          availableBalance: String(totalPending),
          totalWithdrawn: "0",
          lastUpdated: new Date(),
        });
      } else {
        const newPending = subtractPrecise(
          balance.pendingBalance ?? "0",
          totalPending
        );
        const newAvailable = addPrecise(
          balance.availableBalance ?? "0",
          totalPending
        );

        await tx
          .update(marketerBalances)
          .set({
            pendingBalance: String(Math.max(0, newPending)),
            availableBalance: String(newAvailable),
            lastUpdated: new Date(),
          })
          .where(eq(marketerBalances.marketerId, marketerId));
      }
    }
  });
}

export async function createWithdrawalRequest(
  marketerId: string,
  amount: number
): Promise<WithdrawalRequest> {
  const balance = await getMarketerBalance(marketerId);
  if (!balance || Number(balance.availableBalance) < amount) {
    throw new Error("Insufficient available balance");
  }

  const id = nanoid();
  const now = new Date();

  await db.insert(withdrawalRequests).values({
    id,
    marketerId,
    amount: String(amount),
    status: "pending",
    requestedAt: now,
  } as any);

  return {
    id,
    marketerId,
    amount: String(amount),
    status: "pending" as const,
    requestedAt: now,
  } as unknown as WithdrawalRequest;
}

export async function grantStaffLoginPermission(
  staffId: string,
  grantedBy?: string
) {
  return db
    .update(cafeteriaStaff)
    .set({
      canLogin: true,
      loginPermissionGrantedAt: new Date(),
      loginPermissionGrantedBy: grantedBy || null,
    })
    .where(eq(cafeteriaStaff.id, staffId));
}

export async function revokeStaffLoginPermission(staffId: string) {
  return db
    .update(cafeteriaStaff)
    .set({ canLogin: false })
    .where(eq(cafeteriaStaff.id, staffId));
}

export async function canStaffLogin(staffId: string) {
  const result = await db
    .select({ canLogin: cafeteriaStaff.canLogin })
    .from(cafeteriaStaff)
    .where(eq(cafeteriaStaff.id, staffId))
    .limit(1);
  return result[0]?.canLogin ?? false;
}

export async function assignStaffToSection(
  staffId: string,
  sectionId: string
) {
  return db.insert(staffSectionAssignments).values({
    id: nanoid(),
    staffId,
    sectionId,
  });
}

export async function getStaffSectionAssignments(staffId: string) {
  return db
    .select()
    .from(staffSectionAssignments)
    .where(eq(staffSectionAssignments.staffId, staffId));
}

export async function assignStaffToCategory(
  staffId: string,
  categoryId: string
) {
  return db.insert(staffCategoryAssignments).values({
    id: nanoid(),
    staffId,
    categoryId,
  });
}

export async function getStaffCategoryAssignments(staffId: string) {
  return db
    .select()
    .from(staffCategoryAssignments)
    .where(eq(staffCategoryAssignments.staffId, staffId));
}

export async function createSection(
  cafeteriaId: string,
  name: string,
  displayOrder?: number
) {
  const id = nanoid();
  await db.insert(sections).values({
    id,
    cafeteriaId,
    name,
    displayOrder: displayOrder || 0,
  });
  return id;
}

export async function getSectionsByCafeteria(cafeteriaId: string) {
  return db
    .select()
    .from(sections)
    .where(eq(sections.cafeteriaId, cafeteriaId));
}

export async function getCommissionDistributions(
  rechargeRequestId: string
): Promise<CommissionDistribution[]> {
  return db
    .select()
    .from(commissionDistributions)
    .where(
      eq(commissionDistributions.rechargeRequestId, rechargeRequestId)
    );
}
