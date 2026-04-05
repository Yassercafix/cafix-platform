/**
 * Recharge Router
 * Handles recharge requests, approval workflow, and commission distribution
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc.js";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db.js";
import {
  rechargeRequests,
  cafeterias,
  ledgerEntries,
} from "../../drizzle/schema.js";
import { processCommissionsForRecharge } from "../db-commission-helpers.js";

export const rechargesRouter = router({
  /**
   * Create a recharge request with full field support
   * 
   * Updated to support Supabase Storage paths instead of base64 blobs.
   */
  createRequest: protectedProcedure
    .input(
      z.object({
        cafeteriaId: z.string(),
        amount: z.number().positive("Amount must be positive"),
        paymentMethod: z.string().optional(),
        paidCurrency: z.string().optional(),
        notes: z.string().optional(),
        attachmentUrls: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const id = nanoid();
      const now = new Date();

      // Get cafeteria details for country, currency, language
      const cafeteriaResult = await db
        .select()
        .from(cafeterias)
        .where(eq(cafeterias.id, input.cafeteriaId))
        .limit(1);
      
      if (cafeteriaResult.length === 0) {
        throw new Error("Cafeteria not found");
      }

      const cafeteria = cafeteriaResult[0];

      // Use provided currency or fallback to cafeteria currency
      const currency = input.paidCurrency || cafeteria.currency || "USD";

      await db.insert(rechargeRequests).values({
        id,
        cafeteriaId: input.cafeteriaId,
        amount: String(input.amount),
        imageUrl: input.attachmentUrls?.[0], // Store first attachment path as primary image
        attachmentUrls: input.attachmentUrls || [], // Store all paths in the array field
        status: "pending",
        paymentMethod: input.paymentMethod,
        commissionCalculated: false,
        country: cafeteria.country,
        currency: currency,
        language: cafeteria.language,
        notes: input.notes,
        paidCurrency: currency,
        createdAt: now,
      });

      // Create ledger entry for recharge request
      await db.insert(ledgerEntries).values({
        id: nanoid(),
        type: "recharge_requested",
        ledgerType: "points_credit",
        description: `Recharge requested: ${input.amount} ${currency} via ${input.paymentMethod || "unknown"} method. Notes: ${input.notes || "none"}`,
        cafeteriaId: input.cafeteriaId,
        amount: String(input.amount),
        refId: id,
        createdAt: now,
      });

      return {
        success: true,
        rechargeId: id,
        amount: input.amount,
        currency: currency,
        paymentMethod: input.paymentMethod,
      };
    }),

  /**
   * Get all recharge requests (with optional filtering)
   */
  getRequests: protectedProcedure
    .input(
      z.object({
        cafeteriaId: z.string().optional(),
        status: z.enum(["pending", "approved", "rejected"]).optional(),
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions = [];
      if (input.cafeteriaId) {
        conditions.push(eq(rechargeRequests.cafeteriaId, input.cafeteriaId));
      }
      if (input.status) {
        conditions.push(eq(rechargeRequests.status, input.status));
      }
      
      const requests = await db
        .select({
          recharge: rechargeRequests,
          cafeteria: cafeterias,
        })
        .from(rechargeRequests)
        .innerJoin(cafeterias, eq(rechargeRequests.cafeteriaId, cafeterias.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .limit(input.limit)
        .offset(input.offset);

      return {
        total: requests.length,
        requests: requests.map((r: any) => ({
          id: r.recharge.id,
          cafeteriaId: r.recharge.cafeteriaId,
          cafeteria: {
            id: r.cafeteria.id,
            name: r.cafeteria.name,
            country: r.cafeteria.country,
            currency: r.cafeteria.currency,
          },
          amount: Number(r.recharge.amount) || 0,
          status: r.recharge.status,
          paymentMethod: r.recharge.paymentMethod,
          paidCurrency: r.recharge.paidCurrency,
          notes: r.recharge.notes,
          commissionCalculated: r.recharge.commissionCalculated,
          createdAt: r.recharge.createdAt,
          processedAt: r.recharge.processedAt,
        })),
      };
    }),

  /**
   * Get a single recharge request
   */
  getRequest: protectedProcedure
    .input(z.object({ rechargeRequestId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const requests = await db
        .select({
          recharge: rechargeRequests,
          cafeteria: cafeterias,
        })
        .from(rechargeRequests)
        .innerJoin(cafeterias, eq(rechargeRequests.cafeteriaId, cafeterias.id))
        .where(eq(rechargeRequests.id, input.rechargeRequestId));

      if (requests.length === 0) {
        return null;
      }

      const r = requests[0];
      return {
        id: r.recharge.id,
        cafeteriaId: r.recharge.cafeteriaId,
        cafeteria: {
          id: r.cafeteria.id,
          name: r.cafeteria.name,
          country: r.cafeteria.country,
          currency: r.cafeteria.currency,
        },
        amount: Number(r.recharge.amount) || 0,
        status: r.recharge.status,
        paymentMethod: r.recharge.paymentMethod,
        paidCurrency: r.recharge.paidCurrency,
        notes: r.recharge.notes,
        commissionCalculated: r.recharge.commissionCalculated,
        createdAt: r.recharge.createdAt,
        processedAt: r.recharge.processedAt,
        processedBy: r.recharge.processedBy,
        paidAmount: r.recharge.paidAmount ? Number(r.recharge.paidAmount) : undefined,
        exchangeRateToUsd: r.recharge.exchangeRateToUsd ? Number(r.recharge.exchangeRateToUsd) : undefined,
        pointsMultiplier: r.recharge.pointsMultiplier ? Number(r.recharge.pointsMultiplier) : undefined,
        attachmentUrls: (r.recharge.attachmentUrls as string[]) || [],
        imageUrl: r.recharge.imageUrl,
      };
    }),

  /**
   * Delete a recharge request (only pending requests can be deleted)
   * 
   * SAFETY GUARANTEES:
   * - Uses database transaction for atomicity
   * - Locks row with FOR UPDATE to prevent race conditions
   * - Only deletes if status is "pending" (prevents deletion of processed requests)
   * - Creates ledger entry for audit trail (maintains ledger consistency)
   * - Does not affect commission history (commissions only created on approval)
   * - Does not affect recharge history (deletion is recorded in ledger)
   * - Idempotent: safe to retry on failure
   */
  deleteRequest: protectedProcedure
    .input(z.object({ rechargeRequestId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      return await db.transaction(async (tx: any) => {
        // Get the recharge request and LOCK the row to prevent race conditions
        const requests = await tx
          .select()
          .from(rechargeRequests)
          .where(eq(rechargeRequests.id, input.rechargeRequestId))
          .for("update");

        if (requests.length === 0) {
          throw new Error("Recharge request not found");
        }

        const request = requests[0];

        // Only allow deletion of pending requests
        // This ensures we don't delete requests that have been processed or are in progress
        if (request.status !== "pending") {
          throw new Error(`Cannot delete recharge request with status: ${request.status}. Only pending requests can be deleted.`);
        }

        // Delete the request
        await tx
          .delete(rechargeRequests)
          .where(eq(rechargeRequests.id, input.rechargeRequestId));

        // Create ledger entry for deletion to maintain audit trail
        // This ensures ledger consistency and allows tracking of deleted requests
        await tx.insert(ledgerEntries).values({
          id: nanoid(),
          type: "recharge_deleted",
          ledgerType: "points_cancelled",
          description: `Recharge request deleted: ${request.amount} ${request.currency}`,
          cafeteriaId: request.cafeteriaId,
          refId: input.rechargeRequestId,
          createdAt: new Date(),
        });

        return {
          success: true,
          rechargeId: input.rechargeRequestId,
        };
      });
    }),

  /**
   * Approve a recharge request
   */
  approveRequest: protectedProcedure
    .input(
      z.object({
        rechargeRequestId: z.string(),
        notes: z.string().optional(),
        approvedPoints: z.number().positive(),
        paidAmount: z.number().optional(),
        paidCurrency: z.string().optional(),
        exchangeRateToUsd: z.number().optional(),
        pointsMultiplier: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      return await db.transaction(async (tx: any) => {
        // Get the recharge request and LOCK the row (RACE CONDITION PROTECTION)
        const requests = await tx
          .select()
          .from(rechargeRequests)
          .where(eq(rechargeRequests.id, input.rechargeRequestId))
          .for("update");

        if (requests.length === 0) {
          throw new Error("Recharge request not found");
        }

        const request = requests[0];

        // Check if cafeteria is frozen before approving recharge
        const cafeteriaResult = await tx
          .select({ status: cafeterias.status })
          .from(cafeterias)
          .where(eq(cafeterias.id, request.cafeteriaId))
          .limit(1);
        
        if (cafeteriaResult.length > 0 && cafeteriaResult[0].status === 'frozen') {
          throw new Error("Cannot approve recharge for a frozen cafeteria. Unfreeze the cafeteria first.");
        }

        // Prevent double approval (IDEMPOTENCY)
        if (request.status === "approved") {
          return { success: true, rechargeId: input.rechargeRequestId, alreadyApproved: true };
        }

        if (request.status !== "pending") {
          throw new Error(`Recharge request has already been processed (status: ${request.status})`);
        }

        // Get cafeteria details
        const cafeterias_result = await tx
          .select()
          .from(cafeterias)
          .where(eq(cafeterias.id, request.cafeteriaId));

        if (cafeterias_result.length === 0) {
          throw new Error("Cafeteria not found");
        }

        const cafeteria = cafeterias_result[0] as any;

        // Update recharge request status
        const now = new Date();
        const approvedPoints = input.approvedPoints;
        
        await tx
          .update(rechargeRequests)
          .set({
            status: "approved",
            processedAt: now,
            processedBy: ctx.user?.name || "admin",
            notes: input.notes,
            pointsAddedToBalance: String(approvedPoints),
            paidAmount: input.paidAmount ? String(input.paidAmount) : undefined,
            paidCurrency: input.paidCurrency,
            exchangeRateToUsd: input.exchangeRateToUsd ? String(input.exchangeRateToUsd) : undefined,
            pointsMultiplier: input.pointsMultiplier ? String(input.pointsMultiplier) : undefined,
          })
          .where(eq(rechargeRequests.id, input.rechargeRequestId));

        // Update cafeteria points balance
        const currentBalance = Number(cafeteria.pointsBalance) || 0;
        await tx
          .update(cafeterias)
          .set({
            pointsBalance: String(currentBalance + approvedPoints),
          })
          .where(eq(cafeterias.id, request.cafeteriaId));

        // Create ledger entry for approval with balance tracking
        await tx.insert(ledgerEntries).values({
          id: nanoid(),
          type: "recharge_approved",
          ledgerType: "points_credit",
          description: `Recharge approved: ${approvedPoints} points added (Original request: ${request.amount})`,
          cafeteriaId: request.cafeteriaId,
          amount: String(approvedPoints),
          balanceBefore: String(currentBalance),
          balanceAfter: String(currentBalance + approvedPoints),
          refId: input.rechargeRequestId,
          createdAt: now,
        });

        // Commission processing
        try {
          const cafeteriaMarketerId = (cafeteria as any).marketerId || null;
          if (cafeteriaMarketerId) {
            await processCommissionsForRecharge(
              tx,
              input.rechargeRequestId,
              cafeteriaMarketerId,
              approvedPoints,
              request.cafeteriaId
            );
          } else {
            console.warn(
              `[Commission Processing] No marketer associated with cafeteria ${request.cafeteriaId}`
            );
            await tx
              .update(rechargeRequests)
              .set({ commissionCalculated: true })
              .where(eq(rechargeRequests.id, input.rechargeRequestId));
          }
        } catch (commissionError) {
          console.error(
            `[Commission Processing] Error processing commissions for recharge ${input.rechargeRequestId}:`,
            commissionError
          );
          // If commission processing fails, the transaction will be rolled back.
          throw new Error("Commission processing failed");
        }

        return {
          success: true,
          rechargeId: input.rechargeRequestId,
          pointsAdded: approvedPoints,
          newBalance: currentBalance + approvedPoints,
        };
      });
    }),

  /**
   * Reject a recharge request
   */
  rejectRequest: protectedProcedure
    .input(
      z.object({
        rechargeRequestId: z.string(),
        reason: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      return await db.transaction(async (tx: any) => {
        // IDEMPOTENCY: Check current status
        const requests = await tx
          .select()
          .from(rechargeRequests)
          .where(eq(rechargeRequests.id, input.rechargeRequestId))
          .for("update"); // Lock the row

        if (requests.length === 0) {
          throw new Error("Recharge request not found");
        }

        const request = requests[0];

        // If already processed, return safely (Idempotency)
        if (request.status === "rejected") {
          return { success: true, rechargeId: input.rechargeRequestId, alreadyProcessed: true };
        }

        if (request.status !== "pending") {
          throw new Error(`Recharge request has already been processed (status: ${request.status})`);
        }

        const now = new Date();
        await tx
          .update(rechargeRequests)
          .set({
            status: "rejected",
            processedAt: now,
            processedBy: ctx.user?.name || "admin",
            notes: input.reason,
          })
          .where(eq(rechargeRequests.id, input.rechargeRequestId));

        // Create ledger entry for rejection
        await tx.insert(ledgerEntries).values({
          id: nanoid(),
          type: "recharge_rejected",
          ledgerType: "points_cancelled",
          description: `Recharge rejected: ${input.reason}`,
          cafeteriaId: request.cafeteriaId,
          refId: input.rechargeRequestId,
          createdAt: now,
        });

        return {
          success: true,
          rechargeId: input.rechargeRequestId,
        };
      });
    }),
});
