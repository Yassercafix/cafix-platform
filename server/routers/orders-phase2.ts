/**
 * Orders Phase 2 Router
 * Implements strict order state machine with role-based access control,
 * table state syncing, and points deduction at payment only.
 */

import { z } from "zod";
import { protectedProcedure, staffProcedure, router } from "../_core/trpc.js";
import { nanoid } from "nanoid";
import { eq, and, desc, inArray } from "drizzle-orm";
import { getDb } from "../db.js";
import {
  orders,
  orderItems,
  cafeterias,
  cafeteriaTables,
  ledgerEntries,
  shiftSales,
  billSplits,
  billSplitItems,
  billSplitPayments,
} from "../../drizzle/schema.js";
import { logger } from "../utils/logger.js";
import {
  isValidTransition,
  canUserPerformTransition,
  validateTransition,
  canBeCancelled,
} from "../utils/orderStateMachine.js";
import {
  canUserPerformAction,
  validateUserAction,
  OrderAction,
  canUserCancelOrder,
  canUserViewOrder,
  type UserContext,
} from "../utils/roleActionControl.js";
import {
  getTableStatusFromOrderStatus,
  getTableStatusFromMultipleOrders,
} from "../utils/tableStateEngine.js";
import { roundTo, addPrecise, subtractPrecise } from "../utils/precision.js";

/**
 * Create a new order in "created" state
 */
export const createOrder = staffProcedure
  .input(
    z.object({
      cafeteriaId: z.string(),
      tableId: z.string().optional(),
      waiterId: z.string().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Validate user can create orders
    const userContext: UserContext = {
      userId: ctx.user!.id,
      role: ctx.user!.role as any,
      cafeteriaId: input.cafeteriaId,
      staffId: (ctx as any).staffId,
    };
    validateUserAction(userContext, OrderAction.CREATE);

    const id = nanoid();
    const now = new Date();

    await db.insert(orders).values({
      id,
      cafeteriaId: input.cafeteriaId,
      tableId: input.tableId,
      waiterId: input.waiterId || (ctx as any).staffId,
      status: "created",
      totalAmount: "0",
      pointsConsumed: "0",
      createdAt: now,
    });

    logger.info("ORDER_CREATED", `Order ${id} created in state 'created'`, {
      orderId: id,
      cafeteriaId: input.cafeteriaId,
      tableId: input.tableId,
    });

    return {
      id,
      status: "created",
      createdAt: now,
    };
  });

/**
 * Add item to order (only in "created" state)
 */
export const addItem = staffProcedure
  .input(
    z.object({
      orderId: z.string(),
      menuItemId: z.string(),
      quantity: z.number().positive(),
      unitPrice: z.number().positive(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    return await db.transaction(async (tx: any) => {
      // Lock order row to ensure it's still in created state
      const orderResult = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .for("update");

      if (orderResult.length === 0) {
        throw new Error("Order not found");
      }

      const order = orderResult[0];

      // Can only add items to orders in "created" state
      if (order.status !== "created") {
        throw new Error(
          `Cannot add items to order in state '${order.status}'. Items can only be added in 'created' state.`
        );
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

      logger.info("ORDER_ITEM_ADDED", `Item added to order ${input.orderId}`, {
        itemId: id,
        orderId: input.orderId,
      });

      return {
        id,
        status: "created",
        totalPrice,
      };
    });
  });

/**
 * Confirm order: created -> sent_to_kitchen
 * Waiter confirms order and sends all items to kitchen
 */
export const confirmOrder = staffProcedure
  .input(z.object({ orderId: z.string() }))
  .mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    return await db.transaction(async (tx: any) => {
      const userContext: UserContext = {
        userId: ctx.user!.id,
        role: ctx.user!.role as any,
        staffId: (ctx as any).staffId,
      };
      validateUserAction(userContext, OrderAction.CONFIRM);

      // Lock order row
      const orderResult = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .for("update");

      if (orderResult.length === 0) {
        throw new Error("Order not found");
      }

      const order = orderResult[0];

      // Validate transition
      const validation = validateTransition(order.status as any, "sent_to_kitchen", ctx.user!.role as any);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Update order status
      const now = new Date();
      await tx
        .update(orders)
        .set({ status: "sent_to_kitchen" })
        .where(eq(orders.id, input.orderId));

      // Update all order items to sent_to_kitchen
      await tx
        .update(orderItems)
        .set({
          status: "sent_to_kitchen",
          sentToKitchenAt: now,
        })
        .where(eq(orderItems.orderId, input.orderId));

      // Sync table state if table is assigned
      if (order.tableId) {
        await syncTableState(tx, order.tableId);
      }

      logger.info("ORDER_CONFIRMED", `Order ${input.orderId} confirmed and sent to kitchen`, {
        orderId: input.orderId,
      });

      return {
        success: true,
        orderId: input.orderId,
        status: "sent_to_kitchen",
      };
    });
  });

/**
 * Mark order as preparing: sent_to_kitchen -> preparing
 * Chef marks order as being prepared
 */
export const markPreparing = staffProcedure
  .input(z.object({ orderId: z.string() }))
  .mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    return await db.transaction(async (tx: any) => {
      const userContext: UserContext = {
        userId: ctx.user!.id,
        role: ctx.user!.role as any,
        staffId: (ctx as any).staffId,
      };
      validateUserAction(userContext, OrderAction.MARK_PREPARING);

      const orderResult = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .for("update");

      if (orderResult.length === 0) {
        throw new Error("Order not found");
      }

      const order = orderResult[0];

      const validation = validateTransition(order.status as any, "preparing", ctx.user!.role as any);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const now = new Date();
      await tx
        .update(orders)
        .set({ status: "preparing" })
        .where(eq(orders.id, input.orderId));

      // Update all order items to preparing
      await tx
        .update(orderItems)
        .set({
          status: "preparing",
          preparingAt: now,
        })
        .where(eq(orderItems.orderId, input.orderId));

      if (order.tableId) {
        await syncTableState(tx, order.tableId);
      }

      logger.info("ORDER_PREPARING", `Order ${input.orderId} marked as preparing`, {
        orderId: input.orderId,
      });

      return {
        success: true,
        orderId: input.orderId,
        status: "preparing",
      };
    });
  });

/**
 * Mark order as ready: preparing -> ready
 * Chef marks order as ready for service
 */
export const markReady = staffProcedure
  .input(z.object({ orderId: z.string() }))
  .mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    return await db.transaction(async (tx: any) => {
      const userContext: UserContext = {
        userId: ctx.user!.id,
        role: ctx.user!.role as any,
        staffId: (ctx as any).staffId,
      };
      validateUserAction(userContext, OrderAction.MARK_READY);

      const orderResult = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .for("update");

      if (orderResult.length === 0) {
        throw new Error("Order not found");
      }

      const order = orderResult[0];

      const validation = validateTransition(order.status as any, "ready", ctx.user!.role as any);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const now = new Date();
      await tx
        .update(orders)
        .set({ status: "ready" })
        .where(eq(orders.id, input.orderId));

      // Update all order items to ready
      await tx
        .update(orderItems)
        .set({
          status: "ready",
          readyAt: now,
        })
        .where(eq(orderItems.orderId, input.orderId));

      if (order.tableId) {
        await syncTableState(tx, order.tableId);
      }

      logger.info("ORDER_READY", `Order ${input.orderId} marked as ready`, {
        orderId: input.orderId,
      });

      return {
        success: true,
        orderId: input.orderId,
        status: "ready",
      };
    });
  });

/**
 * Mark order as served: ready -> served
 * Waiter marks order as served to customer
 */
export const markServed = staffProcedure
  .input(z.object({ orderId: z.string() }))
  .mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    return await db.transaction(async (tx: any) => {
      const userContext: UserContext = {
        userId: ctx.user!.id,
        role: ctx.user!.role as any,
        staffId: (ctx as any).staffId,
      };
      validateUserAction(userContext, OrderAction.MARK_SERVED);

      const orderResult = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .for("update");

      if (orderResult.length === 0) {
        throw new Error("Order not found");
      }

      const order = orderResult[0];

      const validation = validateTransition(order.status as any, "served", ctx.user!.role as any);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const now = new Date();
      await tx
        .update(orders)
        .set({ status: "served" })
        .where(eq(orders.id, input.orderId));

      // Update all order items to served
      await tx
        .update(orderItems)
        .set({
          status: "served",
          servedAt: now,
        })
        .where(eq(orderItems.orderId, input.orderId));

      if (order.tableId) {
        await syncTableState(tx, order.tableId);
      }

      logger.info("ORDER_SERVED", `Order ${input.orderId} marked as served`, {
        orderId: input.orderId,
      });

      return {
        success: true,
        orderId: input.orderId,
        status: "served",
      };
    });
  });

/**
 * Mark order as paid: served -> paid
 * CRITICAL: Points deduction happens ONLY here
 * Transaction-safe with idempotency protection
 */
export const markPaid = staffProcedure
  .input(
    z.object({
      orderId: z.string(),
      exchangeRate: z.number().positive().default(1),
      shiftId: z.string().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    return await db.transaction(async (tx: any) => {
      const userContext: UserContext = {
        userId: ctx.user!.id,
        role: ctx.user!.role as any,
        staffId: (ctx as any).staffId,
      };
      validateUserAction(userContext, OrderAction.MARK_PAID);

      // Lock order row
      const orderResult = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .for("update");

      if (orderResult.length === 0) {
        throw new Error("Order not found");
      }

      const order = orderResult[0];

      // IDEMPOTENCY: Already paid
      if (order.status === "paid") {
        return {
          success: true,
          orderId: input.orderId,
          pointsDeducted: Number(order.pointsConsumed),
          alreadyPaid: true,
        };
      }

      const validation = validateTransition(order.status as any, "paid", ctx.user!.role as any);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const totalAmount = Number(order.totalAmount) || 0;

      // Lock cafeteria row to prevent balance race conditions
      const cafeteriaResult = await tx
        .select()
        .from(cafeterias)
        .where(eq(cafeterias.id, order.cafeteriaId))
        .for("update");

      if (cafeteriaResult.length === 0) {
        throw new Error("Cafeteria not found");
      }

      const cafeteria = cafeteriaResult[0];

      // Check if cafeteria is frozen
      if (cafeteria.status === "frozen") {
        throw new Error("Cafeteria is frozen and cannot process payments. Please contact your marketer.");
      }

      const currentBalance = Number(cafeteria.pointsBalance) || 0;
      const pointsDeduction = roundTo(totalAmount / input.exchangeRate);
      const now = new Date();

      // Check sufficient points
      if (currentBalance < pointsDeduction) {
        throw new Error(
          `Insufficient points balance. Required: ${pointsDeduction}, Available: ${currentBalance}`
        );
      }

      const newBalance = subtractPrecise(currentBalance, pointsDeduction);

      // Update order to paid state
      await tx
        .update(orders)
        .set({
          status: "paid",
          pointsConsumed: String(pointsDeduction),
          paidAt: now,
        })
        .where(eq(orders.id, input.orderId));

      // Update all order items to paid
      await tx
        .update(orderItems)
        .set({
          status: "paid",
          paidAt: now,
        })
        .where(eq(orderItems.orderId, input.orderId));

      // Deduct points from cafeteria wallet
      await tx
        .update(cafeterias)
        .set({ pointsBalance: String(newBalance) })
        .where(eq(cafeterias.id, order.cafeteriaId));

      // Create ledger entry for audit trail
      await tx.insert(ledgerEntries).values({
        id: nanoid(),
        type: "order_paid",
        ledgerType: "points_deduction",
        description: `Order ${input.orderId} paid: ${pointsDeduction} points deducted`,
        cafeteriaId: order.cafeteriaId,
        amount: String(pointsDeduction),
        balanceBefore: String(currentBalance),
        balanceAfter: String(newBalance),
        refId: input.orderId,
        createdAt: now,
      });

      // Record shift sale if shift is provided
      if (input.shiftId) {
        await tx.insert(shiftSales).values({
          id: nanoid(),
          shiftId: input.shiftId,
          orderId: input.orderId,
          amount: String(totalAmount),
          pointsDeducted: String(pointsDeduction),
          createdAt: now,
        });
      }

      // Sync table state to "free" since order is complete
      if (order.tableId) {
        await syncTableState(tx, order.tableId);
      }

      logger.info("ORDER_PAID", `Order ${input.orderId} marked as paid, ${pointsDeduction} points deducted`, {
        orderId: input.orderId,
        pointsDeducted: pointsDeduction,
        newBalance,
      });

      return {
        success: true,
        orderId: input.orderId,
        status: "paid",
        pointsDeducted: pointsDeduction,
        newBalance,
      };
    });
  });

/**
 * Cancel order
 * Rules:
 * - Can cancel before "ready" state
 * - Manager can cancel anytime
 * - No points deduction on cancellation
 */
export const cancelOrder = staffProcedure
  .input(z.object({ orderId: z.string(), reason: z.string().optional() }))
  .mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    return await db.transaction(async (tx: any) => {
      const userContext: UserContext = {
        userId: ctx.user!.id,
        role: ctx.user!.role as any,
        staffId: (ctx as any).staffId,
      };
      validateUserAction(userContext, OrderAction.CANCEL);

      // Lock order row
      const orderResult = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .for("update");

      if (orderResult.length === 0) {
        throw new Error("Order not found");
      }

      const order = orderResult[0];

      // IDEMPOTENCY: Already cancelled
      if (order.status === "cancelled") {
        return { success: true, orderId: input.orderId, alreadyCancelled: true };
      }

      // Check cancellation rules
      if (!canUserCancelOrder(userContext, order.status as any)) {
        throw new Error(
          `Cannot cancel order in state '${order.status}'. Only manager can cancel after 'ready' state.`
        );
      }

      const now = new Date();

      // Update order to cancelled
      await tx
        .update(orders)
        .set({
          status: "cancelled",
          cancelledAt: now,
        })
        .where(eq(orders.id, input.orderId));

      // Cancel all items
      await tx
        .update(orderItems)
        .set({ status: "cancelled" })
        .where(eq(orderItems.orderId, input.orderId));

      // Sync table state back to free
      if (order.tableId) {
        await syncTableState(tx, order.tableId);
      }

      logger.info("ORDER_CANCELLED", `Order ${input.orderId} cancelled`, {
        orderId: input.orderId,
        reason: input.reason,
      });

      return {
        success: true,
        orderId: input.orderId,
        status: "cancelled",
      };
    });
  });

/**
 * Get orders for a cafeteria with optional filtering
 */
export const getOrders = protectedProcedure
  .input(
    z.object({
      cafeteriaId: z.string(),
      status: z
        .enum(["created", "sent_to_kitchen", "preparing", "ready", "served", "paid", "cancelled"])
        .optional(),
      waiterId: z.string().optional(),
    })
  )
  .query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const conditions = [eq(orders.cafeteriaId, input.cafeteriaId)];
    if (input.status) {
      conditions.push(eq(orders.status, input.status));
    }
    if (input.waiterId) {
      conditions.push(eq(orders.waiterId, input.waiterId));
    }

    const result = await db
      .select()
      .from(orders)
      .where(and(...conditions))
      .orderBy(desc(orders.createdAt));

    return result.map((order: any) => ({
      id: order.id,
      cafeteriaId: order.cafeteriaId,
      tableId: order.tableId,
      waiterId: order.waiterId,
      totalAmount: Number(order.totalAmount),
      status: order.status,
      pointsConsumed: Number(order.pointsConsumed),
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      cancelledAt: order.cancelledAt,
    }));
  });

/**
 * Get order details with items
 */
export const getOrderDetails = protectedProcedure
  .input(z.object({ orderId: z.string() }))
  .query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const orderResult = await db.select().from(orders).where(eq(orders.id, input.orderId));

    if (orderResult.length === 0) {
      throw new Error("Order not found");
    }

    const order = orderResult[0];

    // Check view permission
    const userContext: UserContext = {
      userId: ctx.user!.id,
      role: ctx.user!.role as any,
      cafeteriaId: order.cafeteriaId || "",
      staffId: (ctx as any).staffId,
    };

    if (!canUserViewOrder(userContext, order.cafeteriaId || "", order.waiterId || undefined)) {
      throw new Error("You do not have permission to view this order");
    }

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, input.orderId));

    return {
      id: order.id,
      cafeteriaId: order.cafeteriaId,
      tableId: order.tableId,
      waiterId: order.waiterId,
      totalAmount: Number(order.totalAmount),
      status: order.status,
      pointsConsumed: Number(order.pointsConsumed),
      items: items.map((item: any) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        status: item.status,
        notes: item.notes,
      })),
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      cancelledAt: order.cancelledAt,
    };
  });

/**
 * Kitchen queue: Get all items in sent_to_kitchen or preparing state
 */
export const getKitchenQueue = staffProcedure
  .input(z.object({ cafeteriaId: z.string() }))
  .query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get all orders for this cafeteria
    const cafeteriaOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.cafeteriaId, input.cafeteriaId));

    const orderIds = cafeteriaOrders.map((o: any) => o.id);

    if (orderIds.length === 0) {
      return [];
    }

    // Get items in kitchen queue
    const items = await db
      .select()
      .from(orderItems)
      .where(
        and(
          inArray(orderItems.orderId, orderIds),
          inArray(orderItems.status, ["sent_to_kitchen", "preparing"])
        )
      )
      .orderBy(orderItems.createdAt);

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
      preparingAt: item.preparingAt,
    }));
  });

/**
 * Helper function to sync table state based on its active orders
 */
async function syncTableState(
  tx: any,
  tableId: string
): Promise<void> {
  // Get all non-final orders for this table
  const tableOrders = await tx
    .select({ status: orders.status })
    .from(orders)
    .where(eq(orders.tableId, tableId));

  const orderStatuses = tableOrders.map((o: any) => o.status);
  const newTableStatus = getTableStatusFromMultipleOrders(orderStatuses as any);

  await tx
    .update(cafeteriaTables)
    .set({ status: newTableStatus })
    .where(eq(cafeteriaTables.id, tableId));

  logger.info("TABLE_STATE_SYNCED", `Table ${tableId} synced to status ${newTableStatus}`, {
    tableId,
    status: newTableStatus,
  });
}

export const ordersPhase2Router = router({
  createOrder,
  addItem,
  confirmOrder,
  markPreparing,
  markReady,
  markServed,
  markPaid,
  cancelOrder,
  getOrders,
  getOrderDetails,
  getKitchenQueue,
});
