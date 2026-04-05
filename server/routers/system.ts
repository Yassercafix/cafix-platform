import { publicProcedure, protectedProcedure, adminProcedure, ownerProcedure, router } from "../_core/trpc.js";
import { getDb } from "../db.js";
import { cafeteriaTables, orders, systemConfigs, cafeterias, freeOperationPeriods } from "../../drizzle/schema.js";
import { eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { logger } from "../utils/logger.js";
import { closeDay } from "../utils/dailyClosing.js";
import { exportDailyBackup } from "../utils/backupExport.js";
import { z } from "zod";

const startTime = new Date();

/**
 * System Router
 * Provides health checks and system-level monitoring
 */
export const systemRouter = router({
  /**
   * TASK 5 — Production Health Endpoint
   * Returns database status, active tables, orders in progress, and server uptime
   */
  health: publicProcedure.query(async () => {
    let dbStatus = "healthy";
    let activeTables = 0;
    let ordersInProgress = 0;

    try {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      // Check database by performing simple queries
      const tablesResult = await db
        .select()
        .from(cafeteriaTables)
        .where(sql`${cafeteriaTables.status} != 'free'`);
      activeTables = tablesResult.length;

      const ordersResult = await db
        .select()
        .from(orders)
        .where(sql`${orders.status} NOT IN ('paid', 'cancelled')`);
      ordersInProgress = ordersResult.length;

    } catch (error: any) {
      dbStatus = "unhealthy";
      logger.error("SYSTEM_HEALTH_CHECK_FAILED", error.message);
    }

    const uptimeSeconds = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);

    return {
      status: dbStatus === "healthy" ? "ok" : "error",
      database: dbStatus,
      activeTables,
      ordersInProgress,
      uptime: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m ${uptimeSeconds % 60}s`,
      timestamp: new Date(),
    };
  }),

  /**
   * Get recent system logs (for owner monitoring)
   */
  getLogs: adminProcedure.query(async () => {
    return logger.getLogs(50);
  }),

  /**
   * TASK 4 — Daily Closing Tool
   * Closes all open orders and resets tables
   */
  closeDay: ownerProcedure
    .input(z.object({ cafeteriaId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const summary = await closeDay(input.cafeteriaId);
        return { success: true, summary };
      } catch (error: any) {
        logger.error("DAILY_CLOSE_FAILED", error.message);
        throw new Error("Failed to close day. Please try again.");
      }
    }),

  /**
   * TASK 5 — Backup Export Tool
   * Exports system data as JSON
   */
  exportBackup: ownerProcedure
    .input(z.object({ cafeteriaId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const backup = await exportDailyBackup(input.cafeteriaId);
        return { success: true, backup };
      } catch (error: any) {
        logger.error("BACKUP_EXPORT_FAILED", error.message);
        throw new Error("Failed to export backup. Please try again.");
      }
    }),

  /**
   * Set global free operation months for new cafeterias
   */
  setGlobalFreeMonths: ownerProcedure
    .input(z.object({ months: z.number().min(0) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .insert(systemConfigs)
        .values({
          id: nanoid(),
          key: "global_free_months",
          value: String(input.months),
          createdAt: new Date(),
        })
        .onConflictDoUpdate({
          target: systemConfigs.key,
          set: { value: String(input.months) },
        });

      return { success: true, months: input.months };
    }),

  /**
   * Get global free operation months setting
   */
  getGlobalFreeMonths: ownerProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const config = await db
      .select()
      .from(systemConfigs)
      .where(eq(systemConfigs.key, "global_free_months"))
      .limit(1);

    return { months: config.length > 0 ? parseInt(config[0].value || "0") : 0 };
  }),

  /**
   * Set owner payment instructions (owner only)
   */
  setPaymentInstructions: ownerProcedure
    .input(z.object({ instructions: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .insert(systemConfigs)
        .values({
          id: nanoid(),
          key: "payment_instructions",
          value: input.instructions,
          createdAt: new Date(),
        })
        .onConflictDoUpdate({
          target: systemConfigs.key,
          set: { value: input.instructions },
        });

      return { success: true };
    }),

  /**
   * Get owner payment instructions (protected)
   */
  getPaymentInstructions: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const config = await db
      .select()
      .from(systemConfigs)
      .where(eq(systemConfigs.key, "payment_instructions"))
      .limit(1);

    return { instructions: config.length > 0 ? config[0].value || "" : "" };
  }),

  /**
   * Grant special free period to cafeterias by reference codes
   */
  grantSpecialFreePeriod: ownerProcedure
    .input(
      z.object({
        referenceCodes: z.array(z.string()),
        days: z.number().positive(),
        startDate: z.date().optional(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Find cafeterias by reference codes
      const targetCafeterias = await db
        .select()
        .from(cafeterias)
        .where(inArray(cafeterias.referenceCode, input.referenceCodes));

      if (targetCafeterias.length === 0) {
        throw new Error("No cafeterias found with the provided reference codes");
      }

      const now = new Date();
      const start = input.startDate || now;
      const end = new Date(start);
      end.setDate(end.getDate() + input.days);

      const results = [];

      for (const cafeteria of targetCafeterias) {
        const periodId = nanoid();
        await db.insert(freeOperationPeriods).values({
          id: periodId,
          cafeteriaId: cafeteria.id,
          periodType: "special_grant",
          startDate: start,
          endDate: end,
          reason: input.reason || `Special grant: ${input.days} days`,
          createdBy: ctx.user?.name || "system",
          createdAt: now,
        });

        // Update cafeteria's freeOperationEndDate if this new period ends later
        const currentEndDate = cafeteria.freeOperationEndDate ? new Date(cafeteria.freeOperationEndDate) : null;
        if (!currentEndDate || end > currentEndDate) {
          await db
            .update(cafeterias)
            .set({ freeOperationEndDate: end })
            .where(eq(cafeterias.id, cafeteria.id));
        }

        results.push({ cafeteriaId: cafeteria.id, referenceCode: cafeteria.referenceCode, success: true });
      }

      return {
        success: true,
        processedCount: results.length,
        results,
        startDate: start,
        endDate: end,
      };
    }),
});
