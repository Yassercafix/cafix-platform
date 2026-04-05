import { router, staffProcedure, publicProcedure } from "../_core/trpc.js";
import { z } from "zod";

/**
 * Real-time Updates Router
 */

// In-memory event store
const eventSubscribers = new Map<string, Set<(event: any) => void>>();
const recentEvents: any[] = [];
const MAX_RECENT_EVENTS = 100;

export const realtimeUpdatesRouter = router({
  /**
   * Subscribe to real-time updates
   */
  subscribeToUpdates: publicProcedure
    .input(
      z.object({
        cafeteriaId: z.string(),
        eventTypes: z.array(z.string()).optional(),
      })
    )
    .subscription(async function* ({ input }) {
      const cafeteriaEvents = recentEvents.filter(
        (e) =>
          e.cafeteriaId === input.cafeteriaId &&
          (!input.eventTypes || input.eventTypes.includes(e.eventType))
      );

      for (const event of cafeteriaEvents) {
        yield event;
      }

      // Real implementation would use an Observable or EventEmitter
      // This is a placeholder for the subscription logic
    }),

  /**
   * Emit a real-time event
   */
  emitEvent: staffProcedure
    .input(
      z.object({
        cafeteriaId: z.string(),
        eventType: z.string(),
        orderId: z.string().optional(),
        orderItemId: z.string().optional(),
        payload: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await emitRealtimeEvent({
          cafeteriaId: input.cafeteriaId,
          eventType: input.eventType,
          orderId: input.orderId,
          orderItemId: input.orderItemId,
          payload: input.payload || {},
          emittedBy: ctx.user?.id,
        });
      } catch (error: any) {
        throw new Error(`Failed to emit event: ${error.message}`);
      }
    }),

  /**
   * Get recent events
   */
  getRecentEvents: publicProcedure
    .input(
      z.object({
        cafeteriaId: z.string(),
        eventTypes: z.array(z.string()).optional(),
        limit: z.number().default(20),
      })
    )
    .query(async ({ input }) => {
      try {
        let events = recentEvents.filter((e) => e.cafeteriaId === input.cafeteriaId);

        if (input.eventTypes && input.eventTypes.length > 0) {
          events = events.filter((e) => input.eventTypes!.includes(e.eventType));
        }

        return {
          events: events.slice(-input.limit),
          total: events.length,
        };
      } catch (error: any) {
        throw new Error(`Failed to get events: ${error.message}`);
      }
    }),

  /**
   * Broadcast order created event
   */
  broadcastOrderCreated: staffProcedure
    .input(
      z.object({
        cafeteriaId: z.string(),
        orderId: z.string(),
        tableId: z.string().optional(),
        itemCount: z.number(),
        totalAmount: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await emitRealtimeEvent({
          cafeteriaId: input.cafeteriaId,
          eventType: "order_created",
          orderId: input.orderId,
          payload: {
            tableId: input.tableId,
            itemCount: input.itemCount,
            totalAmount: input.totalAmount,
            createdBy: ctx.user?.id,
          },
        });
      } catch (error: any) {
        throw new Error(`Failed to broadcast order created: ${error.message}`);
      }
    }),

  /**
   * Broadcast kitchen update event
   */
  broadcastKitchenUpdate: staffProcedure
    .input(
      z.object({
        cafeteriaId: z.string(),
        orderId: z.string(),
        itemId: z.string(),
        status: z.string(),
        message: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await emitRealtimeEvent({
          cafeteriaId: input.cafeteriaId,
          eventType: "kitchen_update",
          orderId: input.orderId,
          orderItemId: input.itemId,
          payload: {
            status: input.status,
            message: input.message,
            updatedBy: ctx.user?.id,
          },
        });
      } catch (error: any) {
        throw new Error(`Failed to broadcast kitchen update: ${error.message}`);
      }
    }),

  /**
   * Broadcast waiter notification
   */
  broadcastWaiterNotification: staffProcedure
    .input(
      z.object({
        cafeteriaId: z.string(),
        waiterId: z.string().optional(),
        orderId: z.string(),
        message: z.string(),
        priority: z.enum(["low", "medium", "high"]).default("medium"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await emitRealtimeEvent({
          cafeteriaId: input.cafeteriaId,
          eventType: "waiter_notification",
          orderId: input.orderId,
          payload: {
            waiterId: input.waiterId,
            message: input.message,
            priority: input.priority,
            notifiedBy: ctx.user?.id,
          },
        });
      } catch (error: any) {
        throw new Error(`Failed to broadcast notification: ${error.message}`);
      }
    }),
});

/**
 * Internal helper to emit real-time events
 */
async function emitRealtimeEvent(eventData: any) {
  try {
    const event = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      ...eventData,
      emittedAt: new Date(),
    };

    recentEvents.push(event);
    if (recentEvents.length > MAX_RECENT_EVENTS) {
      recentEvents.shift();
    }

    const channel = `cafeteria:${eventData.cafeteriaId}`;
    const subscribers = eventSubscribers.get(channel);
    if (subscribers) {
      subscribers.forEach((listener) => listener(event));
    }

    return {
      success: true,
      eventId: event.id,
    };
  } catch (error) {
    console.error("Error emitting real-time event:", error);
    throw error;
  }
}
