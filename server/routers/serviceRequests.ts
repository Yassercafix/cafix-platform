import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc.js";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db.js";
import { serviceRequests } from "../../drizzle/schema.js";

export const serviceRequestsRouter = router({
  /**
   * Create a new service request (call_waiter or clean_table)
   * Prevents duplicate pending requests for the same table + type
   */
  createServiceRequest: publicProcedure
    .input(
      z.object({
        cafeteriaId: z.string().min(1),
        tableId: z.string().min(1),
        requestType: z.enum(["call_waiter", "clean_table"]),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });
        }

        // Check for duplicate pending request
        const existingRequest = await db
          .select()
          .from(serviceRequests)
          .where(
            and(
              eq(serviceRequests.tableId, input.tableId),
              eq(serviceRequests.requestType, input.requestType),
              eq(serviceRequests.status, "pending")
            )
          );

        if (existingRequest.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `A pending ${input.requestType} request already exists for this table`,
          });
        }

        // Create new service request
        const newRequest = await db
          .insert(serviceRequests)
          .values({
            cafeteriaId: input.cafeteriaId,
            tableId: input.tableId,
            requestType: input.requestType,
            status: "pending",
          })
          .returning();

        return {
          success: true,
          request: newRequest[0],
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error("[serviceRequests.createServiceRequest ERROR]:", error);

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create service request",
        });
      }
    }),

  /**
   * List all service requests for a cafeteria (optionally filtered by status)
   */
  listServiceRequests: protectedProcedure
    .input(
      z.object({
        cafeteriaId: z.string().min(1),
        status: z.enum(["pending", "completed"]).optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });
        }

        let query = db
          .select()
          .from(serviceRequests)
          .where(eq(serviceRequests.cafeteriaId, input.cafeteriaId));

        if (input.status) {
          query = query.where(eq(serviceRequests.status, input.status));
        }

        const requests = await query;

        return {
          success: true,
          requests,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error("[serviceRequests.listServiceRequests ERROR]:", error);

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list service requests",
        });
      }
    }),

  /**
   * Mark a service request as completed
   */
  completeServiceRequest: protectedProcedure
    .input(
      z.object({
        requestId: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });
        }

        // Update the request to completed
        const updated = await db
          .update(serviceRequests)
          .set({
            status: "completed",
            completedAt: new Date(),
          })
          .where(eq(serviceRequests.id, input.requestId))
          .returning();

        if (updated.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Service request not found",
          });
        }

        return {
          success: true,
          request: updated[0],
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error("[serviceRequests.completeServiceRequest ERROR]:", error);

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to complete service request",
        });
      }
    }),

  /**
   * Get pending service requests for a specific table
   */
  getPendingRequestsForTable: publicProcedure
    .input(
      z.object({
        tableId: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });
        }

        const requests = await db
          .select()
          .from(serviceRequests)
          .where(
            and(
              eq(serviceRequests.tableId, input.tableId),
              eq(serviceRequests.status, "pending")
            )
          );

        return {
          success: true,
          requests,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error("[serviceRequests.getPendingRequestsForTable ERROR]:", error);

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get pending requests",
        });
      }
    }),
});
