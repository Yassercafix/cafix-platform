/**
 * Business Reporting Router
 * Provides analytics and reporting for orders, revenue, and menu items
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc.js";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { getDb } from "../db.js";
import { orders, orderItems, menuItems, cafeterias } from "../../drizzle/schema.js";
import { logger } from "../utils/logger.js";

/**
 * Get daily orders report for a cafeteria
 */
export const getDailyOrdersReport = protectedProcedure
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

    // Query all orders for the day
    const dailyOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.cafeteriaId, input.cafeteriaId),
          gte(orders.createdAt, targetDate),
          lte(orders.createdAt, nextDate)
        )
      );

    // Group by status
    const byStatus = {
      pending: dailyOrders.filter((o) => o.status === "pending").length,
      preparing: dailyOrders.filter((o) => o.status === "preparing").length,
      ready: dailyOrders.filter((o) => o.status === "ready").length,
      served: dailyOrders.filter((o) => o.status === "served").length,
    };

    // Calculate metrics
    const totalRevenue = dailyOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const avgOrderValue = dailyOrders.length > 0 ? totalRevenue / dailyOrders.length : 0;

    return {
      date: targetDate.toISOString().split("T")[0],
      cafeteriaId: input.cafeteriaId,
      totalOrders: dailyOrders.length,
      byStatus,
      totalRevenue,
      avgOrderValue,
      orders: dailyOrders,
    };
  });

/**
 * Get best selling menu items for a cafeteria
 */
export const getBestSellingItems = protectedProcedure
  .input(
    z.object({
      cafeteriaId: z.string(),
      limit: z.number().default(10),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    })
  )
  .query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    let query = db
      .select({
        menuItemId: orderItems.menuItemId,
        itemName: menuItems.name,
        totalQuantity: sql<number>`CAST(SUM(${orderItems.quantity}) AS INTEGER)`,
        totalRevenue: sql<number>`SUM(CAST(${orderItems.totalPrice} AS NUMERIC))`,
        avgPrice: sql<number>`AVG(CAST(${orderItems.unitPrice} AS NUMERIC))`,
      })
      .from(orderItems)
      .leftJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
      .leftJoin(orders, eq(orderItems.orderId, orders.id))
      .where(eq(orders.cafeteriaId, input.cafeteriaId));

    // Add date range if provided
    if (input.startDate && input.endDate) {
      const start = new Date(input.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(input.endDate);
      end.setHours(23, 59, 59, 999);

      query = query.where(
        and(
          gte(orders.createdAt, start),
          lte(orders.createdAt, end)
        )
      );
    }

    const results = await query
      .groupBy(orderItems.menuItemId, menuItems.name)
      .orderBy(desc(sql<number>`SUM(${orderItems.quantity})`))
      .limit(input.limit);

    return {
      cafeteriaId: input.cafeteriaId,
      period: input.startDate && input.endDate ? `${input.startDate} to ${input.endDate}` : "all-time",
      items: results.map((item) => ({
        menuItemId: item.menuItemId,
        name: item.itemName,
        totalQuantity: item.totalQuantity || 0,
        totalRevenue: Number(item.totalRevenue || 0),
        avgPrice: Number(item.avgPrice || 0),
      })),
    };
  });

/**
 * Get revenue report for a date range
 */
export const getRevenueReport = protectedProcedure
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

    // Query all orders in range
    const rangeOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.cafeteriaId, input.cafeteriaId),
          gte(orders.createdAt, start),
          lte(orders.createdAt, end)
        )
      );

    // Group by date
    const byDate: Record<string, any> = {};
    rangeOrders.forEach((order) => {
      const dateKey = new Date(order.createdAt).toISOString().split("T")[0];
      if (!byDate[dateKey]) {
        byDate[dateKey] = {
          date: dateKey,
          orders: 0,
          revenue: 0,
          served: 0,
        };
      }
      byDate[dateKey].orders += 1;
      byDate[dateKey].revenue += Number(order.totalAmount || 0);
      if (order.status === "served") {
        byDate[dateKey].served += 1;
      }
    });

    const totalRevenue = rangeOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const totalOrders = rangeOrders.length;
    const servedOrders = rangeOrders.filter((o) => o.status === "served").length;

    return {
      cafeteriaId: input.cafeteriaId,
      startDate: input.startDate,
      endDate: input.endDate,
      summary: {
        totalRevenue,
        totalOrders,
        servedOrders,
        avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        completionRate: totalOrders > 0 ? (servedOrders / totalOrders) * 100 : 0,
      },
      dailyBreakdown: Object.values(byDate).sort((a: any, b: any) => a.date.localeCompare(b.date)),
    };
  });

/**
 * Get payment method breakdown
 */
export const getPaymentMethodReport = protectedProcedure
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

    // Query paid orders
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

    // Group by payment method
    const byMethod = {
      cash: {
        count: 0,
        revenue: 0,
      },
      points: {
        count: 0,
        revenue: 0,
      },
      online: {
        count: 0,
        revenue: 0,
      },
    };

    paidOrders.forEach((order) => {
      const method = order.paymentMethod as keyof typeof byMethod;
      if (byMethod[method]) {
        byMethod[method].count += 1;
        byMethod[method].revenue += Number(order.totalAmount || 0);
      }
    });

    const totalRevenue = paidOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);

    return {
      cafeteriaId: input.cafeteriaId,
      startDate: input.startDate,
      endDate: input.endDate,
      totalRevenue,
      totalOrders: paidOrders.length,
      methods: byMethod,
      percentages: {
        cash: totalRevenue > 0 ? (byMethod.cash.revenue / totalRevenue) * 100 : 0,
        points: totalRevenue > 0 ? (byMethod.points.revenue / totalRevenue) * 100 : 0,
        online: totalRevenue > 0 ? (byMethod.online.revenue / totalRevenue) * 100 : 0,
      },
    };
  });

export const businessReportingRouter = router({
  getDailyOrdersReport,
  getBestSellingItems,
  getRevenueReport,
  getPaymentMethodReport,
});
