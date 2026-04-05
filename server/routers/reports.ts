import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc.js";
import { eq, and, gte, lte, desc, sum } from "drizzle-orm";
import { getDb } from "../db.js";
import {
  marketers,
  rechargeRequests,
  commissionDistributions,
  orders,
  cafeterias,
  marketerBalances,
} from "../../drizzle/schema.js";

/**
 * Reports Router - MVP Implementation
 * Provides reporting endpoints for Marketers, Cafeterias, and Owners
 */

export const reportsRouter = router({
  /**
   * MARKETER REPORT
   * - Total earned commissions
   * - Total paid commissions
   * - Number of direct children
   * - Total recharges from direct children
   * - Filter by date range
   */
  getMarketerReport: protectedProcedure
    .input(
      z.object({
        marketerId: z.string(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify user is the marketer or owner
      if (ctx.user.role !== "owner" && ctx.user.id !== input.marketerId) {
        throw new Error("Unauthorized access to marketer report");
      }

      // Get marketer info
      const marketerResult = await db
        .select()
        .from(marketers)
        .where(eq(marketers.id, input.marketerId))
        .limit(1);

      if (!marketerResult.length) {
        throw new Error("Marketer not found");
      }

      const marketer = marketerResult[0];

      // Get direct children (downlines)
      const childrenResult = await db
        .select()
        .from(marketers)
        .where(eq(marketers.parentId, input.marketerId));

      const directChildrenCount = childrenResult.length;

      // Build date filter conditions
      const conditions = [];
      if (input.startDate) {
        conditions.push(gte(rechargeRequests.createdAt, input.startDate));
      }
      if (input.endDate) {
        const endDate = new Date(input.endDate);
        endDate.setHours(23, 59, 59, 999);
        conditions.push(lte(rechargeRequests.createdAt, endDate));
      }

      // Get cafeterias for this marketer
      const cafeteriaResult = await db
        .select({ id: cafeterias.id })
        .from(cafeterias)
        .where(eq(cafeterias.marketerId, input.marketerId));

      const cafeteriaIds = cafeteriaResult.map((c: any) => c.id);

      // Get total recharges from direct children's cafeterias
      let totalRechargesFromChildren = 0;
      if (cafeteriaIds.length > 0) {
        const rechargeConditions = [
          ...conditions,
          eq(rechargeRequests.status, "approved"),
        ];

        // Add cafeteria filter
        if (cafeteriaIds.length > 0) {
          // Use a raw query or fetch all and filter
          const rechargesResult = await db
            .select()
            .from(rechargeRequests)
            .where(
              and(
                eq(rechargeRequests.status, "approved"),
                ...conditions
              )
            );

          // Filter by cafeteria IDs
          const filteredRecharges = rechargesResult.filter((r: any) =>
            cafeteriaIds.includes(r.cafeteriaId)
          );

          totalRechargesFromChildren = filteredRecharges.reduce(
            (sum: any, r: any) => sum + parseFloat(r.amount.toString()),
            0
          );
        }
      }

      // Get commission distributions for this marketer
      const commissionsResult = await db
        .select()
        .from(commissionDistributions)
        .where(eq(commissionDistributions.marketerId, input.marketerId));

      const totalEarnedCommissions = commissionsResult.reduce(
        (sum: any, c: any) => sum + parseFloat(c.commissionAmount.toString()),
        0
      );

      const totalPaidCommissions = commissionsResult
        .filter((c: any) => c.status === "withdrawn")
        .reduce((sum: any, c: any) => sum + parseFloat(c.commissionAmount.toString()), 0);

      // Get marketer balance
      const balanceResult = await db
        .select()
        .from(marketerBalances)
        .where(eq(marketerBalances.marketerId, input.marketerId))
        .limit(1);

      const balance = balanceResult.length ? balanceResult[0] : null;

      return {
        marketerId: input.marketerId,
        marketerName: marketer.name,
        totalEarnedCommissions: parseFloat(totalEarnedCommissions.toFixed(2)),
        totalPaidCommissions: parseFloat(totalPaidCommissions.toFixed(2)),
        pendingCommissions: balance
          ? parseFloat(balance.pendingBalance?.toString() || "0")
          : 0,
        availableCommissions: balance
          ? parseFloat(balance.availableBalance?.toString() || "0")
          : 0,
        directChildrenCount,
        totalRechargesFromChildren: parseFloat(
          totalRechargesFromChildren.toFixed(2)
        ),
        reportDate: new Date(),
      };
    }),

  /**
   * CAFETERIA REPORT
   * - Total sales (from orders)
   * - Total points consumed
   * - Number of orders
   * - Filter by date range
   */
  getCafeteriaReport: protectedProcedure
    .input(
      z.object({
        cafeteriaId: z.string(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify user has access to cafeteria
      if (
        ctx.user.role !== "owner" &&
        (ctx.user as any).cafeteriaId !== input.cafeteriaId
      ) {
        throw new Error("Unauthorized access to cafeteria report");
      }

      // Get cafeteria info
      const cafeteriaResult = await db
        .select()
        .from(cafeterias)
        .where(eq(cafeterias.id, input.cafeteriaId))
        .limit(1);

      if (!cafeteriaResult.length) {
        throw new Error("Cafeteria not found");
      }

      const cafeteria = cafeteriaResult[0];

      // Build date filter conditions
      const conditions = [eq(orders.cafeteriaId, input.cafeteriaId)];

      if (input.startDate) {
        conditions.push(gte(orders.paidAt, input.startDate));
      }
      if (input.endDate) {
        const endDate = new Date(input.endDate);
        endDate.setHours(23, 59, 59, 999);
        conditions.push(lte(orders.paidAt, endDate));
      }

      // Get orders
      const ordersResult = await db
        .select()
        .from(orders)
        .where(and(...conditions));

      const totalOrders = ordersResult.length;
      const totalSales = ordersResult.reduce(
        (sum: any, order: any) => sum + parseFloat(order.totalAmount?.toString() || "0"),
        0
      );
      const totalPointsConsumed = ordersResult.reduce(
        (sum: any, order: any) => sum + parseFloat(order.pointsConsumed?.toString() || "0"),
        0
      );

      // Get recharge requests for this cafeteria
      const rechargeConditions = [eq(rechargeRequests.cafeteriaId, input.cafeteriaId)];
      if (input.startDate) {
        rechargeConditions.push(gte(rechargeRequests.createdAt, input.startDate));
      }
      if (input.endDate) {
        const endDate = new Date(input.endDate);
        endDate.setHours(23, 59, 59, 999);
        rechargeConditions.push(lte(rechargeRequests.createdAt, endDate));
      }

      const rechargesResult = await db
        .select()
        .from(rechargeRequests)
        .where(and(...rechargeConditions));

      const totalRecharges = rechargesResult
        .filter((r: any) => r.status === "approved")
        .reduce((sum: any, r: any) => sum + parseFloat(r.amount.toString()), 0);

      return {
        cafeteriaId: input.cafeteriaId,
        cafeteriaName: cafeteria.name,
        totalSales: parseFloat(totalSales.toFixed(2)),
        totalPointsConsumed: parseFloat(totalPointsConsumed.toFixed(2)),
        totalOrders,
        totalRecharges: parseFloat(totalRecharges.toFixed(2)),
        currentPointsBalance: parseFloat(
          cafeteria.pointsBalance?.toString() || "0"
        ),
        reportDate: new Date(),
      };
    }),

  /**
   * OWNER REPORT
   * - Total system recharges
   * - Total commissions distributed
   * - Total cafeterias count
   * - Total marketers count
   */
  getOwnerReport: protectedProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify user is owner
      if (ctx.user.role !== "owner") {
        throw new Error("Only owners can access owner reports");
      }

      // Build date filter conditions
      const conditions = [];
      if (input.startDate) {
        conditions.push(gte(rechargeRequests.createdAt, input.startDate));
      }
      if (input.endDate) {
        const endDate = new Date(input.endDate);
        endDate.setHours(23, 59, 59, 999);
        conditions.push(lte(rechargeRequests.createdAt, endDate));
      }

      // Get total recharges
      const rechargesResult = await db
        .select()
        .from(rechargeRequests)
        .where(
          conditions.length > 0
            ? and(eq(rechargeRequests.status, "approved"), ...conditions)
            : eq(rechargeRequests.status, "approved")
        );

      const totalRecharges = rechargesResult.reduce(
        (sum: any, r: any) => sum + parseFloat(r.amount.toString()),
        0
      );

      // Get total commissions distributed
      const commissionsResult = await db
        .select()
        .from(commissionDistributions)
        .where(
          conditions.length > 0
            ? and(eq(commissionDistributions.status, "available"), ...conditions)
            : eq(commissionDistributions.status, "available")
        );

      const totalCommissionsDistributed = commissionsResult.reduce(
        (sum: any, c: any) => sum + parseFloat(c.commissionAmount.toString()),
        0
      );

      // Get total cafeterias count
      const cafeteriasResult = await db.select().from(cafeterias);
      const totalCafeterias = cafeteriasResult.length;

      // Get total marketers count
      const marketersResult = await db.select().from(marketers);
      const totalMarketers = marketersResult.length;

      return {
        totalRecharges: parseFloat(totalRecharges.toFixed(2)),
        totalCommissionsDistributed: parseFloat(
          totalCommissionsDistributed.toFixed(2)
        ),
        totalCafeterias,
        totalMarketers,
        reportDate: new Date(),
      };
    }),
});
