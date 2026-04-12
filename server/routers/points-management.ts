/**
 * Points Management Router
 * Handles points recharge requests, conversion rates, and point transactions
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc.js";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db.js";
import {
  rechargeRequests,
  pointTransactions,
  conversionRates,
  cafeterias,
} from "../../drizzle/schema.js";
import { logger } from "../utils/logger.js";

/**
 * Set or update conversion rate (Owner only)
 */
export const setConversionRate = protectedProcedure
  .input(
    z.object({
      ownerId: z.string(),
      usdToPoints: z.number().positive(), // 1 USD = X points
    })
  )
  .mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Verify owner
    if (ctx.user?.id !== input.ownerId) {
      throw new Error("Unauthorized: Only owner can set conversion rates");
    }

    const pointsToUsd = 1 / input.usdToPoints; // Reverse calculation

    return await db.transaction(async (tx: any) => {
      // Check if rate exists
      const existing = await tx
        .select()
        .from(conversionRates)
        .where(eq(conversionRates.ownerId, input.ownerId));

      if (existing.length > 0) {
        // Update
        await tx
          .update(conversionRates)
          .set({
            usdToPoints: input.usdToPoints.toString(),
            pointsToUsd: pointsToUsd.toString(),
            updatedAt: new Date(),
          })
          .where(eq(conversionRates.ownerId, input.ownerId));
      } else {
        // Create
        await tx.insert(conversionRates).values({
          ownerId: input.ownerId,
          usdToPoints: input.usdToPoints.toString(),
          pointsToUsd: pointsToUsd.toString(),
        });
      }

      console.log(`[CONVERSION_RATE_SET] Owner ${input.ownerId}: 1 USD = ${input.usdToPoints} points`);
      logger.info("CONVERSION_RATE_SET", `Conversion rate updated`, {
        ownerId: input.ownerId,
        usdToPoints: input.usdToPoints,
      });

      return {
        success: true,
        usdToPoints: input.usdToPoints,
        pointsToUsd: pointsToUsd,
      };
    });
  });

/**
 * Get current conversion rate
 */
export const getConversionRate = protectedProcedure
  .input(z.object({ ownerId: z.string() }))
  .query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const rate = await db
      .select()
      .from(conversionRates)
      .where(eq(conversionRates.ownerId, input.ownerId));

    if (rate.length === 0) {
      // Default: 1 USD = 10 points
      return {
        usdToPoints: 10,
        pointsToUsd: 0.1,
      };
    }

    return {
      usdToPoints: Number(rate[0].usdToPoints),
      pointsToUsd: Number(rate[0].pointsToUsd),
    };
  });

/**
 * Request points recharge (Cafeteria Admin)
 */
export const requestPointsRecharge = protectedProcedure
  .input(
    z.object({
      cafeteriaId: z.string(),
      usdAmount: z.number().positive(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get conversion rate
    const cafeteria = await db
      .select()
      .from(cafeterias)
      .where(eq(cafeterias.id, input.cafeteriaId));

    if (cafeteria.length === 0) {
      throw new Error("Cafeteria not found");
    }

    const ownerId = cafeteria[0].marketerId; // Assuming marketerId is the owner reference
    const rateResult = await db
      .select()
      .from(conversionRates)
      .where(eq(conversionRates.ownerId, ownerId));

    const usdToPoints = rateResult.length > 0 ? Number(rateResult[0].usdToPoints) : 10;
    const pointsAmount = input.usdAmount * usdToPoints;

    // Create recharge request
    const request = await db.insert(rechargeRequests).values({
      cafeteriaId: input.cafeteriaId,
      requestedByStaffId: ctx.user?.id || "",
      usdAmount: input.usdAmount.toString(),
      pointsAmount: pointsAmount.toString(),
      status: "pending",
    });

    console.log(`[RECHARGE_REQUEST] Cafeteria ${input.cafeteriaId}: $${input.usdAmount} USD = ${pointsAmount} points`);
    logger.info("RECHARGE_REQUEST", `Points recharge requested`, {
      cafeteriaId: input.cafeteriaId,
      usdAmount: input.usdAmount,
      pointsAmount,
    });

    return {
      success: true,
      requestId: request[0]?.id || "created",
      usdAmount: input.usdAmount,
      pointsAmount,
    };
  });

/**
 * Approve recharge request (Owner only)
 */
export const approveRechargeRequest = protectedProcedure
  .input(
    z.object({
      requestId: z.string(),
      ownerId: z.string(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Verify owner
    if (ctx.user?.id !== input.ownerId) {
      throw new Error("Unauthorized: Only owner can approve recharge requests");
    }

    return await db.transaction(async (tx: any) => {
      // Get recharge request
      const request = await tx
        .select()
        .from(rechargeRequests)
        .where(eq(rechargeRequests.id, input.requestId))
        .for("update");

      if (request.length === 0) {
        throw new Error("Recharge request not found");
      }

      const req = request[0];

      if (req.status !== "pending") {
        throw new Error(`Cannot approve request with status: ${req.status}`);
      }

      // Update recharge request
      await tx
        .update(rechargeRequests)
        .set({
          status: "approved",
          approvedByOwnerId: input.ownerId,
          approvedAt: new Date(),
        })
        .where(eq(rechargeRequests.id, input.requestId));

      // Get current cafeteria balance
      const cafe = await tx
        .select()
        .from(cafeterias)
        .where(eq(cafeterias.id, req.cafeteriaId));

      const currentBalance = Number(cafe[0]?.pointsBalance || 0);
      const newBalance = currentBalance + Number(req.pointsAmount);

      // Update cafeteria points balance
      await tx
        .update(cafeterias)
        .set({ pointsBalance: newBalance.toString() })
        .where(eq(cafeterias.id, req.cafeteriaId));

      // Record transaction
      await tx.insert(pointTransactions).values({
        cafeteriaId: req.cafeteriaId,
        transactionType: "recharge",
        amount: req.pointsAmount,
        balanceBefore: currentBalance.toString(),
        balanceAfter: newBalance.toString(),
        relatedId: input.requestId,
        description: `Recharge approved: $${req.usdAmount} USD`,
      });

      console.log(`[RECHARGE_APPROVED] Request ${input.requestId}: +${req.pointsAmount} points`);
      logger.info("RECHARGE_APPROVED", `Recharge request approved`, {
        requestId: input.requestId,
        cafeteriaId: req.cafeteriaId,
        pointsAmount: req.pointsAmount,
      });

      return {
        success: true,
        requestId: input.requestId,
        newBalance,
      };
    });
  });

/**
 * Reject recharge request (Owner only)
 */
export const rejectRechargeRequest = protectedProcedure
  .input(
    z.object({
      requestId: z.string(),
      ownerId: z.string(),
      reason: z.string().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Verify owner
    if (ctx.user?.id !== input.ownerId) {
      throw new Error("Unauthorized: Only owner can reject recharge requests");
    }

    // Get recharge request
    const request = await db
      .select()
      .from(rechargeRequests)
      .where(eq(rechargeRequests.id, input.requestId));

    if (request.length === 0) {
      throw new Error("Recharge request not found");
    }

    if (request[0].status !== "pending") {
      throw new Error(`Cannot reject request with status: ${request[0].status}`);
    }

    // Update request
    await db
      .update(rechargeRequests)
      .set({
        status: "rejected",
        approvedByOwnerId: input.ownerId,
        rejectionReason: input.reason || "No reason provided",
        approvedAt: new Date(),
      })
      .where(eq(rechargeRequests.id, input.requestId));

    console.log(`[RECHARGE_REJECTED] Request ${input.requestId}: ${input.reason}`);
    logger.info("RECHARGE_REJECTED", `Recharge request rejected`, {
      requestId: input.requestId,
      reason: input.reason,
    });

    return {
      success: true,
      requestId: input.requestId,
      status: "rejected",
    };
  });

/**
 * Get recharge history for a cafeteria
 */
export const getRechargeHistory = protectedProcedure
  .input(
    z.object({
      cafeteriaId: z.string(),
      limit: z.number().default(50),
    })
  )
  .query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const history = await db
      .select()
      .from(rechargeRequests)
      .where(eq(rechargeRequests.cafeteriaId, input.cafeteriaId))
      .orderBy(desc(rechargeRequests.createdAt))
      .limit(input.limit);

    return {
      cafeteriaId: input.cafeteriaId,
      requests: history.map((req) => ({
        id: req.id,
        usdAmount: Number(req.usdAmount),
        pointsAmount: Number(req.pointsAmount),
        status: req.status,
        createdAt: req.createdAt,
        approvedAt: req.approvedAt,
      })),
    };
  });

/**
 * Get point transactions for a cafeteria
 */
export const getPointTransactions = protectedProcedure
  .input(
    z.object({
      cafeteriaId: z.string(),
      limit: z.number().default(100),
    })
  )
  .query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const transactions = await db
      .select()
      .from(pointTransactions)
      .where(eq(pointTransactions.cafeteriaId, input.cafeteriaId))
      .orderBy(desc(pointTransactions.createdAt))
      .limit(input.limit);

    return {
      cafeteriaId: input.cafeteriaId,
      transactions: transactions.map((tx) => ({
        id: tx.id,
        type: tx.transactionType,
        amount: Number(tx.amount),
        balanceBefore: Number(tx.balanceBefore),
        balanceAfter: Number(tx.balanceAfter),
        description: tx.description,
        createdAt: tx.createdAt,
      })),
    };
  });

export const pointsManagementRouter = router({
  setConversionRate,
  getConversionRate,
  requestPointsRecharge,
  approveRechargeRequest,
  rejectRechargeRequest,
  getRechargeHistory,
  getPointTransactions,
});
