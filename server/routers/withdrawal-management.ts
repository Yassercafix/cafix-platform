/**
 * Withdrawal Management Router
 * Handles marketer withdrawal requests and owner approval
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc.js";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db.js";
import {
  withdrawalRequests,
  commissionRecords,
  conversionRates,
  marketers,
} from "../../drizzle/schema.js";
import { logger } from "../utils/logger.js";

/**
 * Request withdrawal (Marketer only)
 */
export const requestWithdrawal = protectedProcedure
  .input(
    z.object({
      marketerId: z.string(),
      pointsAmount: z.number().positive(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Verify marketer
    if (ctx.user?.id !== input.marketerId) {
      throw new Error("Unauthorized: Can only request withdrawal for yourself");
    }

    return await db.transaction(async (tx: any) => {
      // Get marketer to find owner
      const marketer = await tx
        .select()
        .from(marketers)
        .where(eq(marketers.id, input.marketerId));

      if (marketer.length === 0) {
        throw new Error("Marketer not found");
      }

      // Get available commissions
      const available = await tx
        .select()
        .from(commissionRecords)
        .where(
          and(
            eq(commissionRecords.marketerId, input.marketerId),
            eq(commissionRecords.status, "available")
          )
        );

      const availablePoints = available.reduce(
        (sum, record) => sum + Number(record.commissionPoints),
        0
      );

      if (availablePoints < input.pointsAmount) {
        throw new Error(`Insufficient available points. Available: ${availablePoints}, Requested: ${input.pointsAmount}`);
      }

      // Get conversion rate (from marketer's parent owner)
      const ownerId = marketer[0].parentId || marketer[0].id;
      const rate = await tx
        .select()
        .from(conversionRates)
        .where(eq(conversionRates.ownerId, ownerId));

      const pointsToUsd = rate.length > 0 ? Number(rate[0].pointsToUsd) : 0.1;
      const usdAmount = input.pointsAmount * pointsToUsd;

      // Create withdrawal request
      const request = await tx.insert(withdrawalRequests).values({
        marketerId: input.marketerId,
        pointsAmount: input.pointsAmount.toString(),
        usdAmount: usdAmount.toString(),
        status: "pending",
      });

      console.log(`[WITHDRAWAL_REQUESTED] Marketer ${input.marketerId}: ${input.pointsAmount} points = $${usdAmount} USD`);
      logger.info("WITHDRAWAL_REQUESTED", `Withdrawal request submitted`, {
        marketerId: input.marketerId,
        pointsAmount: input.pointsAmount,
        usdAmount,
      });

      return {
        success: true,
        requestId: request[0]?.id || "created",
        pointsAmount: input.pointsAmount,
        usdAmount,
      };
    });
  });

/**
 * Approve withdrawal request (Owner only)
 */
export const approveWithdrawal = protectedProcedure
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
      throw new Error("Unauthorized: Only owner can approve withdrawals");
    }

    return await db.transaction(async (tx: any) => {
      // Get withdrawal request
      const request = await tx
        .select()
        .from(withdrawalRequests)
        .where(eq(withdrawalRequests.id, input.requestId))
        .for("update");

      if (request.length === 0) {
        throw new Error("Withdrawal request not found");
      }

      const req = request[0];

      if (req.status !== "pending") {
        throw new Error(`Cannot approve request with status: ${req.status}`);
      }

      // Update request to approved
      await tx
        .update(withdrawalRequests)
        .set({
          status: "approved",
          approvedByOwnerId: input.ownerId,
          approvedAt: new Date(),
        })
        .where(eq(withdrawalRequests.id, input.requestId));

      // Mark the withdrawn commissions as withdrawn
      const pointsToWithdraw = Number(req.pointsAmount);
      const available = await tx
        .select()
        .from(commissionRecords)
        .where(
          and(
            eq(commissionRecords.marketerId, req.marketerId),
            eq(commissionRecords.status, "available")
          )
        )
        .orderBy(desc(commissionRecords.createdAt));

      let remaining = pointsToWithdraw;
      for (const record of available) {
        if (remaining <= 0) break;

        const recordPoints = Number(record.commissionPoints);
        if (recordPoints <= remaining) {
          // Mark entire record as withdrawn
          await tx
            .update(commissionRecords)
            .set({ status: "withdrawn" })
            .where(eq(commissionRecords.id, record.id));
          remaining -= recordPoints;
        } else {
          // Partial withdrawal - this would require splitting the record
          // For simplicity, we'll mark the entire record as withdrawn
          await tx
            .update(commissionRecords)
            .set({ status: "withdrawn" })
            .where(eq(commissionRecords.id, record.id));
          remaining = 0;
        }
      }

      console.log(`[WITHDRAWAL_APPROVED] Request ${input.requestId}: ${req.pointsAmount} points approved`);
      logger.info("WITHDRAWAL_APPROVED", `Withdrawal request approved`, {
        requestId: input.requestId,
        marketerId: req.marketerId,
        pointsAmount: req.pointsAmount,
      });

      return {
        success: true,
        requestId: input.requestId,
        status: "approved",
      };
    });
  });

/**
 * Reject withdrawal request (Owner only)
 */
export const rejectWithdrawal = protectedProcedure
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
      throw new Error("Unauthorized: Only owner can reject withdrawals");
    }

    // Get request
    const request = await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.id, input.requestId));

    if (request.length === 0) {
      throw new Error("Withdrawal request not found");
    }

    if (request[0].status !== "pending") {
      throw new Error(`Cannot reject request with status: ${request[0].status}`);
    }

    // Update request
    await db
      .update(withdrawalRequests)
      .set({
        status: "rejected",
        approvedByOwnerId: input.ownerId,
        rejectionReason: input.reason || "No reason provided",
        approvedAt: new Date(),
      })
      .where(eq(withdrawalRequests.id, input.requestId));

    console.log(`[WITHDRAWAL_REJECTED] Request ${input.requestId}: ${input.reason}`);
    logger.info("WITHDRAWAL_REJECTED", `Withdrawal request rejected`, {
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
 * Mark withdrawal as paid (Owner only)
 */
export const markWithdrawalAsPaid = protectedProcedure
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
      throw new Error("Unauthorized: Only owner can mark withdrawals as paid");
    }

    // Get request
    const request = await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.id, input.requestId));

    if (request.length === 0) {
      throw new Error("Withdrawal request not found");
    }

    if (request[0].status !== "approved") {
      throw new Error(`Cannot mark as paid. Current status: ${request[0].status}`);
    }

    // Update request
    await db
      .update(withdrawalRequests)
      .set({
        markedAsPaidAt: new Date(),
      })
      .where(eq(withdrawalRequests.id, input.requestId));

    console.log(`[WITHDRAWAL_PAID] Request ${input.requestId}: marked as paid`);
    logger.info("WITHDRAWAL_PAID", `Withdrawal marked as paid`, {
      requestId: input.requestId,
      marketerId: request[0].marketerId,
    });

    return {
      success: true,
      requestId: input.requestId,
      markedAsPaidAt: new Date(),
    };
  });

/**
 * Get withdrawal history for a marketer
 */
export const getWithdrawalHistory = protectedProcedure
  .input(
    z.object({
      marketerId: z.string(),
      limit: z.number().default(50),
    })
  )
  .query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const history = await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.marketerId, input.marketerId))
      .orderBy(desc(withdrawalRequests.createdAt))
      .limit(input.limit);

    return {
      marketerId: input.marketerId,
      requests: history.map((req) => ({
        id: req.id,
        pointsAmount: Number(req.pointsAmount),
        usdAmount: Number(req.usdAmount),
        status: req.status,
        createdAt: req.createdAt,
        approvedAt: req.approvedAt,
        markedAsPaidAt: req.markedAsPaidAt,
      })),
    };
  });

/**
 * Get all pending withdrawals (Owner only)
 */
export const getPendingWithdrawals = protectedProcedure
  .input(z.object({ ownerId: z.string() }))
  .query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Verify owner
    if (ctx.user?.id !== input.ownerId) {
      throw new Error("Unauthorized: Only owner can view pending withdrawals");
    }

    // Get all pending withdrawals
    const pending = await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.status, "pending"))
      .orderBy(desc(withdrawalRequests.createdAt));

    return {
      ownerId: input.ownerId,
      count: pending.length,
      requests: pending.map((req) => ({
        id: req.id,
        marketerId: req.marketerId,
        pointsAmount: Number(req.pointsAmount),
        usdAmount: Number(req.usdAmount),
        createdAt: req.createdAt,
      })),
    };
  });

export const withdrawalManagementRouter = router({
  requestWithdrawal,
  approveWithdrawal,
  rejectWithdrawal,
  markWithdrawalAsPaid,
  getWithdrawalHistory,
  getPendingWithdrawals,
});
