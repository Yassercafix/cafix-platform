/**
 * Split Bill Phase 2 Router
 * Enhanced backend-safe split bill model with:
 * - Item-level payment tracking
 * - Partial payment support
 * - Double-payment prevention
 * - Transaction safety
 */

import { router, staffProcedure, protectedProcedure } from "../_core/trpc.js";
import { z } from "zod";
import { getDb } from "../db.js";
import { orders, orderItems, billSplits, billSplitItems, billSplitPayments } from "../../drizzle/schema.js";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { logger } from "../utils/logger.js";
import { roundTo, addPrecise } from "../utils/precision.js";

/**
 * Create a split bill from an order
 * Divides order items into multiple payment groups
 */
export const createSplitBill = staffProcedure
  .input(
    z.object({
      orderId: z.string(),
      splits: z.array(
        z.object({
          items: z.array(z.string()), // orderItemIds
          customerId: z.string().optional(),
          description: z.string().optional(),
        })
      ),
    })
  )
  .mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    return await db.transaction(async (tx: any) => {
      // Verify order exists and is in served state (ready for payment)
      const order = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1)
        .for("update");

      if (!order.length) {
        throw new Error("Order not found");
      }

      if (order[0].status !== "served") {
        throw new Error(`Cannot create split bill for order in state '${order[0].status}'. Order must be served.`);
      }

      // Get all order items for this order
      const allItems = await tx.select().from(orderItems).where(eq(orderItems.orderId, input.orderId));

      // Validate all items exist and are in served state
      const itemIds = new Set(allItems.map((i: any) => i.id));
      for (const split of input.splits) {
        for (const itemId of split.items) {
          if (!itemIds.has(itemId)) {
            throw new Error(`Item ${itemId} not found in order`);
          }
          const item = allItems.find((i: any) => i.id === itemId);
          if (item?.status !== "served") {
            throw new Error(`Item ${itemId} must be in 'served' state to split bill`);
          }
        }
      }

      // Create split bills with item-level tracking
      const newBillSplits = [];
      for (const split of input.splits) {
        const splitItems = allItems.filter((i: any) => split.items.includes(i.id));
        const totalAmount = roundTo(
          splitItems.reduce((sum: number, item: any) => sum + Number(item.totalPrice), 0)
        );

        const splitId = nanoid();

        // Create main split record
        await tx.insert(billSplits).values({
          id: splitId,
          orderId: input.orderId,
          items: splitItems.map((item: any) => ({
            orderItemId: item.id,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
          totalAmount: String(totalAmount),
          paidAmount: "0",
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Create item-level tracking records
        for (const item of splitItems) {
          await tx.insert(billSplitItems).values({
            id: nanoid(),
            orderId: input.orderId,
            splitId,
            payerId: split.customerId || "unknown",
            orderItemId: item.id,
            amount: String(item.totalPrice),
            description: split.description,
            createdAt: new Date(),
          });
        }

        newBillSplits.push({
          id: splitId,
          totalAmount: String(totalAmount),
          paidAmount: "0",
          status: "pending",
          itemCount: splitItems.length,
        });
      }

      logger.info("SPLIT_BILL_CREATED", `Created ${newBillSplits.length} bill splits for order ${input.orderId}`, {
        orderId: input.orderId,
        splitCount: newBillSplits.length,
      });

      return {
        success: true,
        billSplits: newBillSplits,
        message: `Created ${newBillSplits.length} bill splits`,
      };
    });
  });

/**
 * Get split bills for an order
 */
export const getSplitBills = protectedProcedure
  .input(z.object({ orderId: z.string() }))
  .query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const splits = await db.select().from(billSplits).where(eq(billSplits.orderId, input.orderId));

    return {
      billSplits: splits.map((split: any) => ({
        id: split.id,
        orderId: split.orderId,
        totalAmount: Number(split.totalAmount),
        paidAmount: Number(split.paidAmount),
        status: split.status,
        items: split.items,
        createdAt: split.createdAt,
      })),
      total: splits.length,
    };
  });

/**
 * Get split bill items (detailed payment tracking)
 */
export const getSplitBillItems = protectedProcedure
  .input(z.object({ splitId: z.string() }))
  .query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const items = await db.select().from(billSplitItems).where(eq(billSplitItems.splitId, input.splitId));

    return {
      items: items.map((item: any) => ({
        id: item.id,
        orderItemId: item.orderItemId,
        payerId: item.payerId,
        amount: Number(item.amount),
        description: item.description,
        createdAt: item.createdAt,
      })),
      total: items.length,
    };
  });

/**
 * Record partial payment for a split bill
 * Transaction-safe with double-payment prevention
 */
export const recordPartialPayment = staffProcedure
  .input(
    z.object({
      billSplitId: z.string(),
      amount: z.string(),
      paymentMethod: z.string().default("cash"),
      customerId: z.string().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    return await db.transaction(async (tx: any) => {
      const amount = roundTo(Number(input.amount));
      if (amount <= 0) {
        throw new Error("Payment amount must be greater than 0");
      }

      // Lock split bill row
      const existingSplits = await tx
        .select()
        .from(billSplits)
        .where(eq(billSplits.id, input.billSplitId))
        .for("update");

      if (existingSplits.length === 0) {
        throw new Error(`Bill split ${input.billSplitId} not found`);
      }

      const split = existingSplits[0];

      // Prevent payment on already completed splits
      if (split.status === "fully_paid" || split.status === "cancelled") {
        throw new Error(`Bill split is already ${split.status}`);
      }

      const currentPaidAmount = roundTo(Number(split.paidAmount) || 0);
      const totalAmount = roundTo(Number(split.totalAmount));
      const newPaidAmount = roundTo(currentPaidAmount + amount);

      // Double-payment prevention: ensure we don't overpay
      if (newPaidAmount > totalAmount) {
        throw new Error(
          `Payment would exceed split total. Total: ${totalAmount}, Current paid: ${currentPaidAmount}, Attempting to add: ${amount}`
        );
      }

      const newStatus = newPaidAmount >= totalAmount ? "fully_paid" : "partially_paid";
      const paymentId = nanoid();

      // Record payment
      await tx.insert(billSplitPayments).values({
        id: paymentId,
        orderId: split.orderId,
        splitId: input.billSplitId,
        payerId: input.customerId || "staff",
        amount: String(amount),
        paymentMethod: input.paymentMethod,
        notes: input.notes,
        recordedBy: ctx.staffId,
        createdAt: new Date(),
      });

      // Update split bill status
      await tx
        .update(billSplits)
        .set({
          paidAmount: String(newPaidAmount),
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(billSplits.id, input.billSplitId));

      logger.info("SPLIT_PAYMENT_RECORDED", `Payment recorded for split ${input.billSplitId}`, {
        splitId: input.billSplitId,
        amount,
        newStatus,
      });

      return {
        success: true,
        paymentId,
        amount: String(amount),
        newPaidAmount: String(newPaidAmount),
        status: newStatus,
        message: newStatus === "fully_paid" ? "Bill split fully paid" : "Partial payment recorded",
      };
    });
  });

/**
 * Get payment history for a split bill
 */
export const getSplitBillPayments = protectedProcedure
  .input(z.object({ splitId: z.string() }))
  .query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const payments = await db
      .select()
      .from(billSplitPayments)
      .where(eq(billSplitPayments.splitId, input.splitId));

    return {
      payments: payments.map((p: any) => ({
        id: p.id,
        amount: Number(p.amount),
        paymentMethod: p.paymentMethod,
        payerId: p.payerId,
        notes: p.notes,
        recordedBy: p.recordedBy,
        createdAt: p.createdAt,
      })),
      total: payments.length,
    };
  });

/**
 * Complete a split bill (mark as fully paid)
 * Can be called manually to force completion
 */
export const completeSplitBill = staffProcedure
  .input(z.object({ billSplitId: z.string() }))
  .mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    return await db.transaction(async (tx: any) => {
      const existingSplits = await tx
        .select()
        .from(billSplits)
        .where(eq(billSplits.id, input.billSplitId))
        .for("update");

      if (existingSplits.length === 0) {
        throw new Error(`Bill split ${input.billSplitId} not found`);
      }

      const split = existingSplits[0];

      if (split.status === "cancelled") {
        throw new Error("Cannot complete a cancelled bill split");
      }

      await tx
        .update(billSplits)
        .set({
          status: "fully_paid",
          updatedAt: new Date(),
        })
        .where(eq(billSplits.id, input.billSplitId));

      logger.info("SPLIT_BILL_COMPLETED", `Bill split ${input.billSplitId} marked as fully paid`, {
        splitId: input.billSplitId,
      });

      return {
        success: true,
        billSplitId: input.billSplitId,
        status: "fully_paid",
        message: "Bill split marked as fully paid",
      };
    });
  });

/**
 * Cancel a split bill
 */
export const cancelSplitBill = staffProcedure
  .input(z.object({ billSplitId: z.string(), reason: z.string() }))
  .mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    return await db.transaction(async (tx: any) => {
      const existingSplits = await tx
        .select()
        .from(billSplits)
        .where(eq(billSplits.id, input.billSplitId))
        .for("update");

      if (existingSplits.length === 0) {
        throw new Error(`Bill split ${input.billSplitId} not found`);
      }

      await tx
        .update(billSplits)
        .set({
          status: "cancelled",
          updatedAt: new Date(),
        })
        .where(eq(billSplits.id, input.billSplitId));

      logger.info("SPLIT_BILL_CANCELLED", `Bill split ${input.billSplitId} cancelled`, {
        splitId: input.billSplitId,
        reason: input.reason,
      });

      return {
        success: true,
        billSplitId: input.billSplitId,
        status: "cancelled",
        reason: input.reason,
        message: "Bill split cancelled",
      };
    });
  });

export const splitBillPhase2Router = router({
  createSplitBill,
  getSplitBills,
  getSplitBillItems,
  recordPartialPayment,
  getSplitBillPayments,
  completeSplitBill,
  cancelSplitBill,
});
