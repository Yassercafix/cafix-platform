/**
 * Commission Management Router
 * Handles marketer commission calculations, tracking, and management
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc.js";
import { eq, and, desc, sum } from "drizzle-orm";
import { getDb } from "../db.js";
import {
  commissionRecords,
  commissionConfigs,
  conversionRates,
  marketers,
  orders,
  withdrawalRequests,
} from "../../drizzle/schema.js";
import { logger } from "../utils/logger.js";

/**
 * Set commission percentage for a marketer (Owner only)
 */
export const setMarketerCommission = protectedProcedure
  .input(
    z.object({
      ownerId: z.string(),
      marketerId: z.string(),
      commissionPercentage: z.number().min(0).max(100),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Verify owner
    if (ctx.user?.id !== input.ownerId) {
      throw new Error("Unauthorized: Only owner can set commission rates");
    }

    return await db.transaction(async (tx: any) => {
      // Check if config exists
      const existing = await tx
        .select()
        .from(commissionConfigs)
        .where(
          and(
            eq(commissionConfigs.ownerId, input.ownerId),
            eq(commissionConfigs.marketerId, input.marketerId)
          )
        );

      if (existing.length > 0) {
        // Update
        await tx
          .update(commissionConfigs)
          .set({
            commissionPercentage: input.commissionPercentage.toString(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(commissionConfigs.ownerId, input.ownerId),
              eq(commissionConfigs.marketerId, input.marketerId)
            )
          );
      } else {
        // Create
        await tx.insert(commissionConfigs).values({
          ownerId: input.ownerId,
          marketerId: input.marketerId,
          commissionPercentage: input.commissionPercentage.toString(),
        });
      }

      console.log(`[COMMISSION_RATE_SET] Marketer ${input.marketerId}: ${input.commissionPercentage}%`);
      logger.info("COMMISSION_RATE_SET", `Commission rate updated`, {
        marketerId: input.marketerId,
        commissionPercentage: input.commissionPercentage,
      });

      return {
        success: true,
        marketerId: input.marketerId,
        commissionPercentage: input.commissionPercentage,
      };
    });
  });

/**
 * Get commission percentage for a marketer
 */
export const getMarketerCommission = protectedProcedure
  .input(z.object({ marketerId: z.string() }))
  .query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const config = await db
      .select()
      .from(commissionConfigs)
      .where(eq(commissionConfigs.marketerId, input.marketerId));

    if (config.length === 0) {
      // Default: 5%
      return {
        marketerId: input.marketerId,
        commissionPercentage: 5,
      };
    }

    return {
      marketerId: input.marketerId,
      commissionPercentage: Number(config[0].commissionPercentage),
    };
  });

/**
 * Calculate and record commission for a paid order
 * Called automatically when an order is marked as paid
 */
export const recordOrderCommission = protectedProcedure
  .input(
    z.object({
      orderId: z.string(),
      cafeteriaId: z.string(),
      orderAmount: z.number(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    return await db.transaction(async (tx: any) => {
      // Get cafeteria to find marketer
      const cafeteria = await tx
        .select()
        .from(cafeterias)
        .where(eq(cafeterias.id, input.cafeteriaId));

      if (cafeteria.length === 0) {
        throw new Error("Cafeteria not found");
      }

      const marketerId = cafeteria[0].marketerId;

      // Get commission percentage
      const config = await tx
        .select()
        .from(commissionConfigs)
        .where(eq(commissionConfigs.marketerId, marketerId));

      const commissionPercentage = config.length > 0 ? Number(config[0].commissionPercentage) : 5;

      // Calculate commission in USD
      const commissionUsd = (input.orderAmount * commissionPercentage) / 100;

      // Get conversion rate
      const rate = await tx
        .select()
        .from(conversionRates)
        .where(eq(conversionRates.ownerId, cafeteria[0].marketerId));

      const usdToPoints = rate.length > 0 ? Number(rate[0].usdToPoints) : 10;
      const commissionPoints = commissionUsd * usdToPoints;

      // Record commission
      await tx.insert(commissionRecords).values({
        marketerId,
        orderId: input.orderId,
        cafeteriaId: input.cafeteriaId,
        commissionPercentage: commissionPercentage.toString(),
        orderAmount: input.orderAmount.toString(),
        commissionAmount: commissionUsd.toString(),
        commissionPoints: commissionPoints.toString(),
        status: "pending",
      });

      console.log(`[COMMISSION_RECORDED] Order ${input.orderId}: ${commissionPercentage}% = $${commissionUsd} USD = ${commissionPoints} points`);
      logger.info("COMMISSION_RECORDED", `Commission recorded for order`, {
        orderId: input.orderId,
        marketerId,
        commissionAmount: commissionUsd,
      });

      return {
        success: true,
        orderId: input.orderId,
        marketerId,
        commissionAmount: commissionUsd,
        commissionPoints,
      };
    });
  });

/**
 * Get commission history for a marketer
 */
export const getMarketerCommissionHistory = protectedProcedure
  .input(
    z.object({
      marketerId: z.string(),
      limit: z.number().default(100),
    })
  )
  .query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const history = await db
      .select()
      .from(commissionRecords)
      .where(eq(commissionRecords.marketerId, input.marketerId))
      .orderBy(desc(commissionRecords.createdAt))
      .limit(input.limit);

    // Calculate totals by status
    const totals = {
      pending: 0,
      available: 0,
      withdrawn: 0,
    };

    history.forEach((record) => {
      const amount = Number(record.commissionPoints);
      if (record.status === "pending") totals.pending += amount;
      else if (record.status === "available") totals.available += amount;
      else if (record.status === "withdrawn") totals.withdrawn += amount;
    });

    return {
      marketerId: input.marketerId,
      records: history.map((record) => ({
        id: record.id,
        orderId: record.orderId,
        commissionPercentage: Number(record.commissionPercentage),
        orderAmount: Number(record.orderAmount),
        commissionAmount: Number(record.commissionAmount),
        commissionPoints: Number(record.commissionPoints),
        status: record.status,
        createdAt: record.createdAt,
      })),
      totals,
    };
  });

/**
 * Get marketer balance summary
 */
export const getMarketerBalance = protectedProcedure
  .input(z.object({ marketerId: z.string() }))
  .query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get all commission records
    const records = await db
      .select()
      .from(commissionRecords)
      .where(eq(commissionRecords.marketerId, input.marketerId));

    // Calculate balances
    let pendingPoints = 0;
    let availablePoints = 0;
    let withdrawnPoints = 0;

    records.forEach((record) => {
      const points = Number(record.commissionPoints);
      if (record.status === "pending") pendingPoints += points;
      else if (record.status === "available") availablePoints += points;
      else if (record.status === "withdrawn") withdrawnPoints += points;
    });

    // Get withdrawal requests
    const withdrawals = await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.marketerId, input.marketerId));

    const pendingWithdrawals = withdrawals.filter((w) => w.status === "pending").length;
    const approvedWithdrawals = withdrawals.filter((w) => w.status === "approved").length;

    return {
      marketerId: input.marketerId,
      pendingPoints,
      availablePoints,
      withdrawnPoints,
      totalPoints: pendingPoints + availablePoints + withdrawnPoints,
      pendingWithdrawals,
      approvedWithdrawals,
    };
  });

/**
 * Approve pending commissions to available (Owner only)
 */
export const approvePendingCommissions = protectedProcedure
  .input(
    z.object({
      ownerId: z.string(),
      marketerId: z.string(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Verify owner
    if (ctx.user?.id !== input.ownerId) {
      throw new Error("Unauthorized: Only owner can approve commissions");
    }

    // Get pending commissions
    const pending = await db
      .select()
      .from(commissionRecords)
      .where(
        and(
          eq(commissionRecords.marketerId, input.marketerId),
          eq(commissionRecords.status, "pending")
        )
      );

    if (pending.length === 0) {
      return {
        success: true,
        count: 0,
        message: "No pending commissions to approve",
      };
    }

    // Update all pending to available
    await db
      .update(commissionRecords)
      .set({ status: "available" })
      .where(
        and(
          eq(commissionRecords.marketerId, input.marketerId),
          eq(commissionRecords.status, "pending")
        )
      );

    const totalPoints = pending.reduce((sum, record) => sum + Number(record.commissionPoints), 0);

    console.log(`[COMMISSIONS_APPROVED] Marketer ${input.marketerId}: ${pending.length} commissions = ${totalPoints} points`);
    logger.info("COMMISSIONS_APPROVED", `Pending commissions approved`, {
      marketerId: input.marketerId,
      count: pending.length,
      totalPoints,
    });

    return {
      success: true,
      count: pending.length,
      totalPoints,
    };
  });

export const commissionManagementRouter = router({
  setMarketerCommission,
  getMarketerCommission,
  recordOrderCommission,
  getMarketerCommissionHistory,
  getMarketerBalance,
  approvePendingCommissions,
});
