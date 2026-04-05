import { router, staffProcedure, protectedProcedure as waiterProcedure } from "../_core/trpc.js";
import { z } from "zod";
import { getDb } from "../db.js";
import { orders, orderItems, billSplits, billSplitStatusEnum } from "../../drizzle/schema.js";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * Split Bill Router
 * Handles bill splitting and partial payments
 */

export const splitBillRouter = router({
  /**
   * Create a split bill from an order
   * Allows dividing order items into multiple bills
   */
  createSplitBill: staffProcedure
    .input(
      z.object({
        orderId: z.string(),
        splits: z.array(
          z.object({
            items: z.array(z.string()), // orderItemIds
            customerId: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Verify order exists
        const order = await db
          .select()
          .from(orders)
          .where(eq(orders.id, input.orderId))
          .limit(1);

        if (!order.length) {
          throw new Error("Order not found");
        }

        // Get all order items for this order
        const allItems = await db
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, input.orderId));

        // Validate all items exist
        const itemIds = new Set(allItems.map((i: any) => i.id));
        for (const split of input.splits) {
          for (const itemId of split.items) {
            if (!itemIds.has(itemId)) {
              throw new Error(`Item ${itemId} not found in order`);
            }
          }
        }

        // Create split bills and persist to DB.
        const newBillSplits = [];
        for (const split of input.splits) {
          const splitItems = allItems.filter((i: any) => split.items.includes(i.id));
          const totalAmount = splitItems.reduce(
            (sum: number, item: any) => sum + parseFloat(item.totalPrice.toString()),
            0
          );

          const splitId = nanoid();
          const insertedSplit = await db.insert(billSplits).values({
            id: splitId,
            orderId: input.orderId,
            items: splitItems.map((item: any) => ({
              orderItemId: item.id,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              customerId: split.customerId,
            })),
            totalAmount: totalAmount.toString(),
            paidAmount: "0",
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date(),
          }).returning();
          newBillSplits.push(insertedSplit[0]);
        }

        return {
          success: true,
          billSplits: newBillSplits,
          message: `Created ${newBillSplits.length} bill splits`,
        };
      } catch (error: any) {
        throw new Error(`Failed to create split bill: ${error.message}`);
      }
    }),

  /**
   * Get split bills for an order
   * FIX: Query DB for splits filtered by orderId.
   */
  getSplitBills: waiterProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const splits = await db
          .select()
          .from(billSplits)
          .where(eq(billSplits.orderId, input.orderId));

        return {
          billSplits: splits,
          total: splits.length,
        };
      } catch (error: any) {
        throw new Error(`Failed to get split bills: ${error.message}`);
      }
    }),

  /**
   * Record partial payment for a split bill
   * FIX: Update billSplitStore with payment and recalculate paidAmount/status.
   */
  recordPartialPayment: waiterProcedure
    .input(
      z.object({
        billSplitId: z.string(),
        amount: z.string(),
        paymentMethod: z.string().default("cash"),
        customerId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const amount = parseFloat(input.amount);
        if (amount <= 0) {
          throw new Error("Payment amount must be greater than 0");
        }

        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const existingSplits = await db.select().from(billSplits).where(eq(billSplits.id, input.billSplitId));
        if (existingSplits.length === 0) {
          throw new Error(`Bill split ${input.billSplitId} not found`);
        }
        const split = existingSplits[0];

        if (split.status === "fully_paid" || split.status === "cancelled") {
          throw new Error(`Bill split is already ${split.status}`);
        }

        const currentPaidAmount = split.paidAmount ? parseFloat(split.paidAmount) : 0;
        const newPaidAmount = (currentPaidAmount + amount).toString();
        const newStatus = parseFloat(newPaidAmount) >= parseFloat(split.totalAmount) ? "fully_paid" : "partially_paid";

        await db.update(billSplits).set({
          paidAmount: newPaidAmount,
          status: newStatus,
          updatedAt: new Date(),
        }).where(eq(billSplits.id, input.billSplitId));

        return {
          success: true,
          paymentId: nanoid(), // Generate a new payment ID for the response
          amount: input.amount,
          newPaidAmount: newPaidAmount,
          status: newStatus,
          message: "Partial payment recorded",
        };
      } catch (error: any) {
        throw new Error(`Failed to record payment: ${error.message}`);
      }
    }),

  /**
   * Complete a split bill (mark as fully paid)
   * FIX: Update DB status.
   */
  completeSplitBill: waiterProcedure
    .input(z.object({ billSplitId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const existingSplits = await db.select().from(billSplits).where(eq(billSplits.id, input.billSplitId));
        if (existingSplits.length === 0) {
          throw new Error(`Bill split ${input.billSplitId} not found`);
        }

        await db.update(billSplits).set({
          status: "fully_paid",
          updatedAt: new Date(),
        }).where(eq(billSplits.id, input.billSplitId));

        return {
          success: true,
          billSplitId: input.billSplitId,
          status: "fully_paid",
          message: "Bill split marked as fully paid",
        };
      } catch (error: any) {
        throw new Error(`Failed to complete bill: ${error.message}`);
      }
    }),

  /**
   * Cancel a split bill
   * FIX: Update DB status.
   */
  cancelSplitBill: waiterProcedure
    .input(z.object({ billSplitId: z.string(), reason: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const existingSplits = await db.select().from(billSplits).where(eq(billSplits.id, input.billSplitId));
        if (existingSplits.length === 0) {
          throw new Error(`Bill split ${input.billSplitId} not found`);
        }

        await db.update(billSplits).set({
          status: "cancelled",
          updatedAt: new Date(),
        }).where(eq(billSplits.id, input.billSplitId));

        return {
          success: true,
          billSplitId: input.billSplitId,
          status: "cancelled",
          reason: input.reason,
          message: "Bill split cancelled",
        };
      } catch (error: any) {
        throw new Error(`Failed to cancel bill: ${error.message}`);
      }
    }),
});
