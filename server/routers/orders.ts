import { z } from "zod";
import { protectedProcedure, staffProcedure, router } from "../_core/trpc.js";
import { nanoid } from "nanoid";
import { eq, and, asc, desc } from "drizzle-orm";
import { getDb } from "../db.js";
import {
  orders,
  orderItems,
  cafeterias,
  shiftSales,
  ledgerEntries,
  freeOperationPeriods,
} from "../../drizzle/schema.js";
import { logger } from "../utils/logger.js";
import {
  convertBillToPoints,
  canTransitionItemStatus,
} from "../utils/orderEngine.js";
import { isInFreeOperationPeriod } from "../utils/freeOperationEngine.js";

export const ordersRouter = router({
  createOrder: staffProcedure
    .input(
      z.object({
        cafeteriaId: z.string(),
        tableId: z.string().optional(),
        waiterId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const id = nanoid();
      const now = new Date();

      await db.insert(orders).values({
        id,
        cafeteriaId: input.cafeteriaId,
        tableId: input.tableId,
        waiterId: input.waiterId,
        status: "created",
        totalAmount: "0",
        pointsConsumed: "0",
        createdAt: now,
      });

      return {
        id,
        status: "created",
        createdAt: now,
      };
    }),

  addItem: staffProcedure
    .input(
      z.object({
        orderId: z.string(),
        menuItemId: z.string(),
        quantity: z.number().positive(),
        unitPrice: z.number().positive(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      return await db.transaction(async (tx: any) => {
        // DATA SAFETY: Ensure order is still open before adding items
        const orderResult = await tx
          .select({ status: orders.status })
          .from(orders)
          .where(eq(orders.id, input.orderId))
          .for("update");

        if (orderResult.length === 0) {
          throw new Error("Order not found");
        }

        if (orderResult[0].status !== "created") {
          throw new Error(`Cannot add items to an order with status '${orderResult[0].status}'`);
        }

        const id = nanoid();
        const totalPrice = input.quantity * input.unitPrice;

        await tx.insert(orderItems).values({
          id,
          orderId: input.orderId,
          menuItemId: input.menuItemId,
          quantity: input.quantity,
          unitPrice: String(input.unitPrice),
          totalPrice: String(totalPrice),
          status: "created",
          notes: input.notes,
          createdAt: new Date(),
        });

        return {
          id,
          status: "created",
          totalPrice,
        };
      });
    }),

  getOrders: protectedProcedure
    .input(z.object({ cafeteriaId: z.string(), status: z.enum(["created", "sent_to_kitchen", "preparing", "ready", "served", "paid", "cancelled"]).optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const ordersResult = await (db.query as any).orders.findMany({
        where: and(
          eq(orders.cafeteriaId, input.cafeteriaId),
          input.status ? eq(orders.status, input.status) : undefined
        ),
        with: {
          table: true,
          waiter: true,
          orderItems: {
            with: {
              menuItem: true,
            },
          },
        },
        orderBy: asc(orders.createdAt),
      });

      return (ordersResult as any[]).map(order => ({
        ...order,
        totalAmount: Number(order.totalAmount),
        pointsConsumed: Number(order.pointsConsumed),
        items: (order.orderItems as any[]).map(item => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
          menuItem: item.menuItem ? { ...item.menuItem, price: Number(item.menuItem.price) } : undefined,
        })),
      }));
    }),

  getOrderDetails: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const orderResult = await db
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId));

      if (orderResult.length === 0) {
        throw new Error("Order not found");
      }

      const order = orderResult[0];
      const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, input.orderId));

      return {
        id: order.id,
        cafeteriaId: order.cafeteriaId,
        tableId: order.tableId,
        waiterId: order.waiterId,
        totalAmount: Number(order.totalAmount) || 0,
        status: order.status,
        pointsConsumed: Number(order.pointsConsumed) || 0,
        items: items.map((item: any) => ({
          id: item.id,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice) || 0,
          totalPrice: Number(item.totalPrice) || 0,
          status: item.status,
          notes: item.notes,
        })),
        createdAt: order.createdAt,
        closedAt: order.paidAt,
      };
    }),

  sendToKitchen: staffProcedure
    .input(z.object({ orderItemId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const itemResult = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.id, input.orderItemId))
        .limit(1);

      if (itemResult.length === 0) {
        throw new Error("Order item not found");
      }

      const item = itemResult[0];
      const lockedStatuses = ["sent_to_kitchen", "preparing", "ready", "served", "paid", "cancelled"];
      if (lockedStatuses.includes(item.status || "")) {
        throw new Error(
          `Cannot send item to kitchen: current status is '${item.status}'. Item is already locked in kitchen.`
        );
      }

      const now = new Date();

      await db
        .update(orderItems)
        .set({
          status: "sent_to_kitchen",
          sentToKitchenAt: now,
        })
        .where(eq(orderItems.id, input.orderItemId));

      return {
        success: true,
        itemId: input.orderItemId,
        status: "sent_to_kitchen",
      };
    }),

  updateItemStatus: staffProcedure
    .input(
      z.object({
        orderItemId: z.string(),
        newStatus: z.enum(["preparing", "ready", "served", "cancelled"]),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const itemResult = await db
          .select()
          .from(orderItems)
          .where(eq(orderItems.id, input.orderItemId));

        if (itemResult.length === 0) {
          throw new Error("Order item not found");
        }

        const item = itemResult[0];

        // For simplicity in legacy router, we allow these transitions
        const updateData: Record<string, any> = { status: input.newStatus };

        if (input.newStatus === "preparing") {
          updateData.preparingAt = new Date();
        } else if (input.newStatus === "ready") {
          updateData.readyAt = new Date();
        } else if (input.newStatus === "served") {
          updateData.servedAt = new Date();
        }

        await db
          .update(orderItems)
          .set(updateData)
          .where(eq(orderItems.id, input.orderItemId));

        return {
          success: true,
          itemId: input.orderItemId,
          newStatus: input.newStatus,
        };
      } catch (error: any) {
        logger.error("ORDER_UPDATE_ERROR", error.message, { input });
        throw new Error(error.message);
      }
    }),

  getKitchenOrders: staffProcedure
    .input(z.object({ chefId: z.string(), cafeteriaId: z.string() }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const cafeteriaOrders = await db
          .select({ id: orders.id })
          .from(orders)
          .where(eq(orders.cafeteriaId, input.cafeteriaId));

        const cafeteriaOrderIds = cafeteriaOrders.map((o: any) => o.id);

        if (cafeteriaOrderIds.length === 0) {
          return [];
        }

        const allKitchenItems = await db
          .select()
          .from(orderItems)
          .where(eq(orderItems.status, "sent_to_kitchen"))
          .orderBy(asc(orderItems.sentToKitchenAt));

        const items = allKitchenItems.filter((item: any) =>
          cafeteriaOrderIds.includes(item.orderId)
        );

        return items.map((item: any) => ({
          id: item.id,
          orderId: item.orderId,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
          status: item.status,
          notes: item.notes,
          sentToKitchenAt: item.sentToKitchenAt,
        }));
      } catch (error: any) {
        logger.error("KITCHEN_ORDERS_ERROR", error.message, { input });
        throw new Error(error.message);
      }
    }),

  cancelOrder: staffProcedure
    .input(z.object({ orderId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.transaction(async (tx: any) => {
        const orderResult = await tx
          .select()
          .from(orders)
          .where(eq(orders.id, input.orderId))
          .for("update");

        if (orderResult.length === 0) {
          throw new Error("Order not found");
        }

        if (orderResult[0].status === "paid" || orderResult[0].status === "cancelled") {
          throw new Error(`Cannot cancel order in status '${orderResult[0].status}'`);
        }

        await tx
          .update(orders)
          .set({ status: "cancelled", cancelledAt: new Date() })
          .where(eq(orders.id, input.orderId));

        await tx
          .update(orderItems)
          .set({ status: "cancelled" })
          .where(eq(orderItems.orderId, input.orderId));
      });

      return { success: true, orderId: input.orderId };
    }),

  updateOrderStatus: staffProcedure
    .input(z.object({ orderId: z.string(), newStatus: z.enum(["created", "sent_to_kitchen", "preparing", "ready", "served", "paid", "cancelled"]) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const updateData: Record<string, any> = { status: input.newStatus };
      if (input.newStatus === "paid") {
        updateData.paidAt = new Date();
      } else if (input.newStatus === "cancelled") {
        updateData.cancelledAt = new Date();
      }

      await db
        .update(orders)
        .set(updateData)
        .where(eq(orders.id, input.orderId));

      return { success: true, orderId: input.orderId, newStatus: input.newStatus };
    }),

  closeOrder: staffProcedure
    .input(z.object({ orderId: z.string(), cafeteriaId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      return await db.transaction(async (tx: any) => {
        const orderResult = await tx
          .select()
          .from(orders)
          .where(eq(orders.id, input.orderId))
          .for("update");

        if (orderResult.length === 0) {
          throw new Error("Order not found");
        }

        if (orderResult[0].status === "paid") {
          return { success: true, alreadyClosed: true };
        }

        const now = new Date();
        await tx
          .update(orders)
          .set({ status: "paid", paidAt: now })
          .where(eq(orders.id, input.orderId));

        return { success: true, orderId: input.orderId, closedAt: now };
      });
    }),
});
