import { protectedProcedure, router } from "../_core/trpc.js";
import { z } from "zod";
import { getDb } from "../db.js";
import { cafeterias } from "../../drizzle/schema.js";
import { eq } from "drizzle-orm";
import { getPlanContext } from "../utils/planGuard.js";

export const cafeteriasRouter = router({
  getCafeteriaDetails: protectedProcedure
    .input(z.object({ cafeteriaId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const cafeteria = await (db.query as any).cafeterias.findFirst({
        where: eq(cafeterias.id, input.cafeteriaId),
      });

      if (!cafeteria) {
        throw new Error("Cafeteria not found");
      }
      return cafeteria;
    }),

  /**
   * Returns the subscription plan and feature limits for a cafeteria.
   * Used by the frontend to enforce plan-based UI restrictions.
   */
  getPlanContext: protectedProcedure
    .input(z.object({ cafeteriaId: z.string() }))
    .query(async ({ input }) => {
      return getPlanContext(input.cafeteriaId);
    }),

  /**
   * Update cafeteria settings including name, phone, location, tax, and service charges
   */
  updateSettings: protectedProcedure
    .input(
      z.object({
        cafeteriaId: z.string(),
        name: z.string().optional(),
        phone: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        taxRate: z.number().optional(),
        serviceCharge: z.number().optional(),
        autoLogoutMinutes: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const updateData: any = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.phone !== undefined) updateData.phone = input.phone;
      if (input.latitude !== undefined) updateData.latitude = input.latitude;
      if (input.longitude !== undefined) updateData.longitude = input.longitude;
      if (input.taxRate !== undefined) updateData.taxRate = input.taxRate;
      if (input.serviceCharge !== undefined) updateData.serviceCharge = input.serviceCharge;
      if (input.autoLogoutMinutes !== undefined) updateData.autoLogoutMinutes = input.autoLogoutMinutes;

      const result = await db
        .update(cafeterias)
        .set(updateData)
        .where(eq(cafeterias.id, input.cafeteriaId))
        .returning();

      if (result.length === 0) {
        throw new Error("Cafeteria not found");
      }

      return result[0];
    }),
  /**
   * Freeze a cafeteria (owner/marketer only)
   */
  freezeCafeteria: protectedProcedure
    .input(z.object({ cafeteriaId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const cafeteria = await db
        .select()
        .from(cafeterias)
        .where(eq(cafeterias.id, input.cafeteriaId))
        .limit(1);

      if (cafeteria.length === 0) {
        throw new Error("Cafeteria not found");
      }

      // Check permissions: only owner or the marketer who owns this cafeteria
      if (ctx.user?.role === "owner" || (ctx.user as any)?.marketerId === cafeteria[0].marketerId) {
        await db
          .update(cafeterias)
          .set({ status: "frozen" })
          .where(eq(cafeterias.id, input.cafeteriaId));

        return {
          success: true,
          cafeteriaCode: cafeteria[0].referenceCode,
          status: "frozen",
        };
      }

      throw new Error("You do not have permission to freeze this cafeteria");
    }),

  /**
   * Unfreeze a cafeteria (owner/marketer only)
   */
  unfreezeCafeteria: protectedProcedure
    .input(z.object({ cafeteriaId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const cafeteria = await db
        .select()
        .from(cafeterias)
        .where(eq(cafeterias.id, input.cafeteriaId))
        .limit(1);

      if (cafeteria.length === 0) {
        throw new Error("Cafeteria not found");
      }

      // Check permissions: only owner or the marketer who owns this cafeteria
      if (ctx.user?.role === "owner" || (ctx.user as any)?.marketerId === cafeteria[0].marketerId) {
        await db
          .update(cafeterias)
          .set({ status: "active" })
          .where(eq(cafeterias.id, input.cafeteriaId));

        return {
          success: true,
          cafeteriaCode: cafeteria[0].referenceCode,
          status: "active",
        };
      }

      throw new Error("You do not have permission to unfreeze this cafeteria");
    }),
});
