// New endpoints to add to orders router for waiter and chef flow
import { protectedProcedure } from "../_core/trpc.js";
import { z } from "zod";
import { getDb } from "../db.js";
import { orders, orderItems } from "../../drizzle/schema.js";
import { eq, and, sql } from "drizzle-orm";

export const waiterOrdersEndpoint = protectedProcedure
  .input(
    z.object({
      cafeteriaId: z.string(),
      waiterId: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const conditions = [
      eq(orders.cafeteriaId, input.cafeteriaId),
      sql`${orders.status} NOT IN ('paid', 'cancelled')`,
    ];

    if (input.waiterId) {
      conditions.push(eq(orders.waiterId, input.waiterId));
    }

    const result = await db
      .select()
      .from(orders)
      .where(and(...conditions));

    const ordersWithItems = await Promise.all(
      result.map(async (order: any) => {
        const items = await db
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, order.id));

        return {
          id: order.id,
          tableId: order.tableId,
          waiterId: order.waiterId,
          totalAmount: Number(order.totalAmount) || 0,
          status: order.status,
          source: order.source,
          items: items.map((item: any) => ({
            id: item.id,
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            status: item.status,
            notes: item.notes,
          })),
          createdAt: order.createdAt,
        };
      })
    );

    return ordersWithItems;
  });

export const chefOrdersEndpoint = protectedProcedure
  .input(
    z.object({
      cafeteriaId: z.string(),
    })
  )
  .query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const items = await db
      .select()
      .from(orderItems)
      .where(
        and(
          eq(orderItems.status, "sent_to_kitchen")
          // Join with orders to filter by cafeteriaId
        )
      );

    // Filter by cafeteria
    const ordersInCafeteria = await db
      .select()
      .from(orders)
      .where(eq(orders.cafeteriaId, input.cafeteriaId));

    const cafeteriaOrderIds = ordersInCafeteria.map((o: any) => o.id);

    const chefItems = items.filter((item: any) =>
      cafeteriaOrderIds.includes(item.orderId)
    );

    const itemsWithOrderDetails = await Promise.all(
      chefItems.map(async (item: any) => {
        const order = ordersInCafeteria.find((o: any) => o.id === item.orderId);
        return {
          id: item.id,
          orderId: item.orderId,
          tableId: order?.tableId,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          status: item.status,
          notes: item.notes,
          sentToKitchenAt: item.sentToKitchenAt,
        };
      })
    );

    return itemsWithOrderDetails;
  });
