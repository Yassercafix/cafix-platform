import { getDb } from "../db.js";
import { orders, cafeteriaTables } from "../../drizzle/schema.js";
import { eq, and, sql, notInArray } from "drizzle-orm";
import { logger } from "./logger.js";

/**
 * Daily Closing Utility
 * Handles end-of-day operations like closing open orders and resetting tables.
 */

export interface DailySummary {
  orderCount: number;
  totalRevenue: number;
  closedOrdersCount: number;
  resetTablesCount: number;
}

export async function closeDay(cafeteriaId: string): Promise<DailySummary> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();

  // 1. Get summary before closing
  const openOrders = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.cafeteriaId, cafeteriaId), 
        notInArray(orders.status, ["paid", "cancelled"])
      )
    );

  const totalRevenue = openOrders.reduce((sum: any, order: any) => sum + parseFloat(order.totalAmount || "0"), 0);

  // 2. Mark all non-final orders as paid (closed)
  await db
    .update(orders)
    .set({ 
      status: "paid",
      paidAt: now 
    })
    .where(
      and(
        eq(orders.cafeteriaId, cafeteriaId), 
        notInArray(orders.status, ["paid", "cancelled"])
      )
    );

  // 3. Reset all tables to free
  await db
    .update(cafeteriaTables)
    .set({ status: "free" })
    .where(eq(cafeteriaTables.cafeteriaId, cafeteriaId));

  logger.info("DAILY_CLOSE", `Day closed for cafeteria ${cafeteriaId}`, { 
    orderCount: openOrders.length, 
    revenue: totalRevenue 
  });

  return {
    orderCount: openOrders.length,
    totalRevenue,
    closedOrdersCount: openOrders.length,
    resetTablesCount: 0, // Drizzle update result doesn't return count easily in all drivers
  };
}
