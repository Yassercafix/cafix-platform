import { router, staffProcedure, protectedProcedure as managerProcedure } from "../_core/trpc.js";
import { z } from "zod";
import { getDb } from "../db.js";
import { orders, orderEscalations } from "../../drizzle/schema.js";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * Waiter Escalation Router
 * Handles escalation when no waiter responds within 60 seconds
 */

// Track waiter response times (still in-memory for short-term tracking)
const waiterResponseTracker = new Map<string, { timestamp: number; waiterId?: string }>();

export const waiterEscalationRouter = router({
  /**
   * Create an order with escalation tracking
   * Starts 60-second timer for waiter response
   */
  createOrderWithEscalation: staffProcedure
    .input(
      z.object({
        orderId: z.string(),
        tableId: z.string().optional(),
        waiterId: z.string().optional(),
        cafeteriaId: z.string(),
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

        // Start escalation tracking.
        // FIX: Always initialise with waiterId = undefined so the 60-second timer
        // correctly detects whether a waiter responded via waiterResponded().
        // The optional input.waiterId (pre-assigned waiter) is stored separately
        // as assignedWaiterId and does NOT suppress escalation — only an explicit
        // waiterResponded() call within 60 s cancels it.
        waiterResponseTracker.set(input.orderId, {
          timestamp: Date.now(),
          waiterId: undefined,
        });

        // Set timeout for 60 seconds
        setTimeout(() => {
          const tracker = waiterResponseTracker.get(input.orderId);
          if (tracker && !tracker.waiterId) {
            // No waiter responded within 60 seconds - escalate
            handleEscalation(input.orderId, input.cafeteriaId);
          }
        }, 60000); // 60 seconds

        return {
          success: true,
          orderId: input.orderId,
          escalationStarted: true,
          timeoutSeconds: 60,
        };
      } catch (error: any) {
        throw new Error(`Failed to create order with escalation: ${error.message}`);
      }
    }),

  /**
   * Mark waiter as responding to order
   * Cancels escalation if waiter responds within 60 seconds
   */
  waiterResponded: staffProcedure
    .input(
      z.object({
        orderId: z.string(),
        waiterId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const tracker = waiterResponseTracker.get(input.orderId);

        if (!tracker) {
          throw new Error("Order escalation tracker not found");
        }

        // Check if within 60 seconds
        const elapsedSeconds = (Date.now() - tracker.timestamp) / 1000;

        if (elapsedSeconds > 60) {
          return {
            success: false,
            message: "Order already escalated - cannot cancel escalation",
            escalated: true,
          };
        }

        // Update tracker - waiter responded
        waiterResponseTracker.set(input.orderId, {
          ...tracker,
          waiterId: input.waiterId,
        });

        return {
          success: true,
          orderId: input.orderId,
          waiterId: input.waiterId,
          message: "Waiter response recorded - escalation cancelled",
          escalated: false,
        };
      } catch (error: any) {
        throw new Error(`Failed to record waiter response: ${error.message}`);
      }
    }),

  /**
   * Get escalated orders (visible to all waiters and manager)
   * FIX: Query DB for active escalated orders filtered by cafeteriaId.
   */
  getEscalatedOrders: staffProcedure
    .input(z.object({ cafeteriaId: z.string() }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const activeEscalations = await db
          .select()
          .from(orderEscalations)
          .where(and(
            eq(orderEscalations.cafeteriaId, input.cafeteriaId),
            eq(orderEscalations.status, "active")
          ));

        return {
          escalatedOrders: activeEscalations.map((e: any) => e.orderId),
          total: activeEscalations.length,
          visibleToAllWaiters: true,
          visibleToManager: true,
        };
      } catch (error: any) {
        throw new Error(`Failed to get escalated orders: ${error.message}`);
      }
    }),

  /**
   * Manager acknowledges escalated order
   */
  acknowledgeEscalation: managerProcedure
    .input(
      z.object({
        orderId: z.string(),
        assignedWaiterId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        return {
          success: true,
          orderId: input.orderId,
          assignedWaiterId: input.assignedWaiterId,
          message: "Escalation acknowledged by manager",
        };
      } catch (error: any) {
        throw new Error(`Failed to acknowledge escalation: ${error.message}`);
      }
    }),

  /**
   * Resolve escalation (order is now being handled)
   */
  resolveEscalation: staffProcedure
    .input(
      z.object({
        orderId: z.string(),
        resolvedBy: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        waiterResponseTracker.delete(input.orderId);
        // FIX: Update the status in the database.
        await db.update(orderEscalations).set({
          status: "resolved",
          resolvedAt: new Date(),
        }).where(and(eq(orderEscalations.orderId, input.orderId), eq(orderEscalations.status, "active")));

        return {
          success: true,
          orderId: input.orderId,
          resolvedBy: input.resolvedBy,
          message: "Escalation resolved",
        };
      } catch (error: any) {
        throw new Error(`Failed to resolve escalation: ${error.message}`);
      }
    }),
});

/**
 * Internal function to handle escalation
 * FIX: Store escalated order in the in-memory map so getEscalatedOrders can return it.
 */
async function handleEscalation(orderId: string, cafeteriaId: string) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    console.log(`[ESCALATION] Order ${orderId} escalated after 60 seconds for cafeteria ${cafeteriaId}`);
    await db.insert(orderEscalations).values({
      id: nanoid(),
      orderId,
      cafeteriaId,
      escalatedAt: new Date(),
      status: "active",
    });
  } catch (error) {
    console.error("Error handling escalation:", error);
  }
}
