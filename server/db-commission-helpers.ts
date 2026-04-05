/**
 * Commission Helpers
 *
 * COMMISSION RULES
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Commissions are created ONLY when a cafeteria recharge is APPROVED.
 * 2. New commissions are always created with status = "pending".
 * 3. When a SUBSEQUENT recharge is approved for the SAME cafeteria, the
 *    commissions from the PREVIOUS approved recharge become "available".
 *    (i.e., recharge N makes recharge N-1 commissions available)
 * 4. The FIRST recharge's commissions are NEVER made available immediately —
 *    they only become available when a second recharge is approved.
 * 5. Commission flows upward through the REAL ancestor chain:
 *       cafeteria → direct marketer → parent marketer → … → owner
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { eq, and, desc, ne } from "drizzle-orm";
import { getDb } from "./db.js";
import {
  marketers,
  commissionConfigs,
  rechargeRequests,
  commissionDistributions,
  freeOperationPeriods,
  marketerBalances,
  ledgerEntries,
} from "../drizzle/schema.js";
import { calculateCommissionDistributions } from "./utils/commissionEngine.js";
import { shouldGenerateCommissions } from "./utils/freeOperationEngine.js";
import { addPrecise, subtractPrecise, roundTo } from "./utils/precision.js";
import { nanoid } from "nanoid";

// Define a type for the transaction object
type Transaction = any;

// ─── Hierarchy ───────────────────────────────────────────────────────────────

/**
 * Walks the marketer parent chain starting from `cafeteriaMarketerId` all the
 * way up to the root, returning the full ancestor array ordered from the
 * direct parent to the root (owner-level marketer last).
 */
export async function getMarketerHierarchy(
  db: Transaction | Awaited<ReturnType<typeof getDb>>,
  cafeteriaMarketerIdOrId: string
): Promise<Array<{ id: string; parentId: string | null; referenceCode: string; status: string }>> {
  if (!db) throw new Error("Database not available");

  const hierarchy: Array<{ id: string; parentId: string | null; referenceCode: string; status: string }> = [];
  let currentMarketerId: string | null = cafeteriaMarketerIdOrId;

  while (currentMarketerId) {
    const result = await (db as any)
      .select()
      .from(marketers)
      .where(eq(marketers.id, currentMarketerId))
      .limit(1);

    if (result.length === 0) break;

    const marketer = result[0] as any;
    hierarchy.push({
      id: marketer.id,
      parentId: marketer.parentId,
      referenceCode: marketer.referenceCode || "",
      status: marketer.status || "active",
    });

    currentMarketerId = marketer.parentId;
  }

  return hierarchy;
}

// ─── Commission rates ────────────────────────────────────────────────────────

export async function getCommissionRatesForMarketers(
  db: Transaction | Awaited<ReturnType<typeof getDb>>,
  marketerIds: string[]
): Promise<Map<string, number>> {
  if (!db) throw new Error("Database not available");

  const rates = new Map<string, number>();
  for (const marketerId of marketerIds) {
    const result = await (db as any)
      .select()
      .from(commissionConfigs)
      .where(eq(commissionConfigs.marketerId, marketerId))
      .limit(1);

    rates.set(marketerId, result.length > 0 ? Number(result[0].rate) || 0 : 0);
  }
  return rates;
}

// ─── Free period check ───────────────────────────────────────────────────────

export async function isCafeteriaInFreePeriod(
  db: Transaction | Awaited<ReturnType<typeof getDb>>,
  cafeteriaId: string
): Promise<boolean> {
  if (!db) throw new Error("Database not available");

  const now = new Date();
  const result = await (db as any)
    .select()
    .from(freeOperationPeriods)
    .where(eq(freeOperationPeriods.cafeteriaId, cafeteriaId));

  return result.some((period: any) => now >= period.startDate && now <= period.endDate);
}

// ─── Release previous recharge commissions ───────────────────────────────────

/**
 * Moves all PENDING commissions for `previousRechargeId` to AVAILABLE status,
 * and updates marketer balances accordingly.
 *
 * This is called when a NEW recharge is approved for the same cafeteria.
 */
async function releaseCommissionsForPreviousRecharge(
  tx: Transaction,
  previousRechargeId: string
): Promise<void> {
  const commissionsToRelease = await tx
    .select()
    .from(commissionDistributions)
    .where(
      and(
        eq(commissionDistributions.rechargeRequestId, previousRechargeId),
        eq(commissionDistributions.status, "pending")
      )
    );

  if (commissionsToRelease.length === 0) {
    // No pending commissions for the previous recharge — nothing to do.
    return;
  }

  for (const commission of commissionsToRelease) {
    // 1. Mark commission as available
    await tx.update(commissionDistributions).set({ status: "available", releasedAt: new Date() })
      .where(eq(commissionDistributions.id, commission.id));

    // 2. Move amount from pendingBalance → availableBalance
    const marketerId = commission.marketerId;
    const amount = Number(commission.commissionAmount);

    // Check if marketer is frozen before releasing
    const marketer = await tx.select({ status: marketers.status }).from(marketers).where(eq(marketers.id, marketerId)).limit(1);
    if (marketer.length > 0 && marketer[0].status === 'frozen') {
      console.log(`[Commission Release] Skipping frozen marketer ${marketerId}`);
      continue;
    }

    const balanceRows = await (tx as any)
      .select()
      .from(marketerBalances)
      .where(eq(marketerBalances.marketerId, marketerId))
      .limit(1);

    const balance = balanceRows[0];

    if (balance) {
      const newPending = subtractPrecise(Number(balance.pendingBalance), amount);
      const newAvailable = addPrecise(Number(balance.availableBalance), amount);

      await tx
        .update(marketerBalances)
        .set({
          pendingBalance: String(Math.max(0, newPending)),
          availableBalance: String(newAvailable),
          lastUpdated: new Date(),
        })
        .where(eq(marketerBalances.marketerId, marketerId));

      // 3. Ledger entry
      await tx.insert(ledgerEntries).values({
        id: nanoid(),
        type: "commission_released",
        ledgerType: "commission_available",
        description: `Commission for recharge ${previousRechargeId} released to marketer ${marketerId}`,
        marketerId,
        amount: String(amount),
        balanceBefore: String(balance.availableBalance ?? "0"),
        balanceAfter: String(newAvailable),
        refId: commission.id,
        createdAt: new Date(),
      });
    } else {
      console.warn(
        `[Commission Release] Marketer balance not found for marketer ${marketerId} during commission release.`
      );
    }
  }
}

// ─── Main entry point ────────────────────────────────────────────────────────

/**
 * Called inside the recharge-approval transaction.
 *
 * Steps:
 *  1. Find the most recently approved recharge for this cafeteria (excluding
 *     the current one).
 *  2. If one exists, release its PENDING commissions → AVAILABLE.
 *  3. Create new PENDING commissions for the current recharge, distributed
 *     up the full ancestor chain.
 */
export async function processCommissionsForRecharge(
  tx: Transaction,
  currentRechargeRequestId: string,
  cafeteriaMarketerId: string,
  rechargeAmount: number,
  cafeteriaId: string
): Promise<void> {
  // ── Step 1: Find the previous approved recharge for this cafeteria ──────
  const previousRecharges = await (tx as any)
    .select()
    .from(rechargeRequests)
    .where(
      and(
        eq(rechargeRequests.cafeteriaId, cafeteriaId),
        eq(rechargeRequests.status, "approved"),
        ne(rechargeRequests.id, currentRechargeRequestId)
      )
    )
    .orderBy(desc(rechargeRequests.createdAt))
    .limit(1);

  const previousRecharge = previousRecharges[0];

  // ── Step 2: Release previous recharge's commissions (if any) ────────────
  if (previousRecharge) {
    await releaseCommissionsForPreviousRecharge(tx, previousRecharge.id);
  }
  // NOTE: If there is no previous recharge (this is the first one), we do NOT
  // make any commissions available immediately — they stay PENDING until the
  // next recharge is approved.

  // ── Step 3: Create new PENDING commissions for the current recharge ──────
  try {
    const inFreePeriod = await isCafeteriaInFreePeriod(tx, cafeteriaId);
    const shouldGenerate = shouldGenerateCommissions(inFreePeriod);

    if (!shouldGenerate) {
      // Cafeteria is in free period — no commissions generated.
      await (tx as any)
        .update(rechargeRequests)
        .set({ commissionCalculated: true })
        .where(eq(rechargeRequests.id, currentRechargeRequestId));
      return;
    }

    // Build the full ancestor chain (direct marketer → … → root)
    const hierarchy = await getMarketerHierarchy(tx, cafeteriaMarketerId);

    if (hierarchy.length === 0) {
      throw new Error("No marketer hierarchy found for cafeteria");
    }

    const marketerIds = hierarchy.map((m) => m.id);
    const commissionRates = await getCommissionRatesForMarketers(tx, marketerIds);

    const distributions = calculateCommissionDistributions(
      rechargeAmount,
      hierarchy,
      commissionRates
    );

    let totalNewCommissions = 0;

    for (const distribution of distributions) {
      // Check if marketer is frozen before creating commission
      const marketer = hierarchy.find(m => m.id === distribution.marketerId);
      if (marketer && marketer.status === 'frozen') {
        console.log(`[Commission Creation] Skipping frozen marketer ${distribution.marketerId}`);
        continue;
      }

      // Insert commission record — always PENDING
      await (tx as any).insert(commissionDistributions).values({
        id: nanoid(),
        rechargeRequestId: currentRechargeRequestId,
        marketerId: distribution.marketerId,
        level: distribution.level,
        commissionAmount: String(roundTo(distribution.commissionAmount)),
        status: "pending",   // ← ALWAYS pending; never available on creation
        createdAt: new Date(),
      });

      // Update marketer pending balance
      const balanceRows = await (tx as any)
        .select()
        .from(marketerBalances)
        .where(eq(marketerBalances.marketerId, distribution.marketerId))
        .limit(1);

      const balance = balanceRows[0];
      const newPending = addPrecise(
        balance?.pendingBalance ?? "0",
        distribution.commissionAmount
      );

      if (balance) {
        await (tx as any)
          .update(marketerBalances)
          .set({
            pendingBalance: String(Math.max(0, newPending)),
            lastUpdated: new Date(),
          })
          .where(eq(marketerBalances.marketerId, distribution.marketerId));
      } else {
        await (tx as any).insert(marketerBalances).values({
          id: nanoid(),
          marketerId: distribution.marketerId,
          pendingBalance: String(Math.max(0, newPending)),
          availableBalance: "0",
          totalWithdrawn: "0",
        });
      }

      totalNewCommissions = addPrecise(totalNewCommissions, distribution.commissionAmount);
    }

    await (tx as any)
      .update(rechargeRequests)
      .set({ commissionCalculated: true })
      .where(eq(rechargeRequests.id, currentRechargeRequestId));

    console.log(
      `[Commission Processing] Recharge ${currentRechargeRequestId}: ` +
        `${distributions.length} distributions created (all PENDING), total: $${totalNewCommissions}`
    );
  } catch (error) {
    console.error(
      `[Commission Processing] Error processing commissions for recharge ${currentRechargeRequestId}:`,
      error
    );
    throw error;
  }
}
