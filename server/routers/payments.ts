/**
 * Payments Router
 * Handles payment processing, revenue tracking, and payment status management
 */

import { z } from "zod";
import { protectedProcedure, staffProcedure, router } from "../_core/trpc.js";
import { eq, and, gte, lte } from "drizzle-orm";
import { getDb } from "../db.js";
import { orders, orderItems, cafeterias, shiftSales } from "../../drizzle/schema.js";
import { logger } from "../utils/logger.js";

/**
 * Process payment for an order (mark as paid)
 */
export const processPayment = staffProcedure
  .input(
    z.object({
      orderId: z.string(),
      paymentMethod: z.enum(["cash", "points", "online"]),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    return await db.transaction(async (tx: any) => {
      // Fetch order
      const orderResult = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .for("update");

      if (orderResult.length === 0) {
        throw new Error("Order not found");
      }

      const order = orderResult[0];

      // Validate order status (can only pay if served)
      if (order.status !== "served") {
        throw new Error(`Cannot process payment for order in status: ${order.status}`);
      }

      // Update order with payment info
      const now = new Date();
      await tx
        .update(orders)
        .set({
          paymentMethod: input.paymentMethod,
          paymentStatus: "paid",
          paidAt: now,
        })
        .where(eq(orders.id, input.orderId));

      console.log(`[PAYMENT_PROCESSED] Order ${input.orderId}: ${input.paymentMethod} - $${order.totalAmount}`);
      logger.info("PAYMENT_PROCESSED", `Payment processed for order ${input.orderId}`, {
        orderId: input.orderId,
        paymentMethod: input.paymentMethod,
        amount: order.totalAmount,
      });

      return {
        success: true,
        orderId: input.orderId,
        paymentMethod: input.paymentMethod,
        amount: order.totalAmount,
        paidAt: now,
      };
    });
  });

/**
 * Get daily revenue for a cafeteria
 */
export const getDailyRevenue = protectedProcedure
  .input(
    z.object({
      cafeteriaId: z.string(),
      date: z.string().optional(), // ISO date string (YYYY-MM-DD)
    })
  )
  .query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Parse date
    const targetDate = input.date ? new Date(input.date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    // Query paid orders for the day
    const paidOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.cafeteriaId, input.cafeteriaId),
          eq(orders.paymentStatus, "paid"),
          gte(orders.paidAt, targetDate),
          lte(orders.paidAt, nextDate)
        )
      );

    const totalRevenue = paidOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);

    return {
      date: targetDate.toISOString().split("T")[0],
      cafeteriaId: input.cafeteriaId,
      totalRevenue: totalRevenue,
      orderCount: paidOrders.length,
      orders: paidOrders,
    };
  });

/**
 * Get revenue summary for a cafeteria (date range)
 */
export const getRevenueSummary = protectedProcedure
  .input(
    z.object({
      cafeteriaId: z.string(),
      startDate: z.string(),
      endDate: z.string(),
    })
  )
  .query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const start = new Date(input.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(input.endDate);
    end.setHours(23, 59, 59, 999);

    // Query all paid orders in range
    const paidOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.cafeteriaId, input.cafeteriaId),
          eq(orders.paymentStatus, "paid"),
          gte(orders.paidAt, start),
          lte(orders.paidAt, end)
        )
      );

    const totalRevenue = paidOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;

    // Group by payment method
    const byMethod = {
      cash: paidOrders.filter((o) => o.paymentMethod === "cash").length,
      points: paidOrders.filter((o) => o.paymentMethod === "points").length,
      online: paidOrders.filter((o) => o.paymentMethod === "online").length,
    };

    return {
      startDate: input.startDate,
      endDate: input.endDate,
      cafeteriaId: input.cafeteriaId,
      totalRevenue: totalRevenue,
      orderCount: paidOrders.length,
      avgOrderValue: avgOrderValue,
      paymentMethods: byMethod,
    };
  });

/**
 * Get pending payments (orders that are served but not paid)
 */
export const getPendingPayments = staffProcedure
  .input(
    z.object({
      cafeteriaId: z.string(),
    })
  )
  .query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const pendingPayments = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.cafeteriaId, input.cafeteriaId),
          eq(orders.status, "served"),
          eq(orders.paymentStatus, "pending")
        )
      );

    return {
      cafeteriaId: input.cafeteriaId,
      count: pendingPayments.length,
      totalAmount: pendingPayments.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
      orders: pendingPayments,
    };
  });

export const paymentsRouter = router({
  processPayment,
  getDailyRevenue,
  getRevenueSummary,
  getPendingPayments,
});
