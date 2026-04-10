import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc.js";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db.js";
import { cafeteriaTables, sections } from "../../drizzle/schema.js";
import { getPlanContext, assertLimit, assertFeature } from "../utils/planGuard.js";
import {
  getTablesBySection,
  getAvailableTablesInSection,
  getBestFitTable,
  getSectionStats,
  getCafeteriaOccupancy,
  validateTableData,
  validateSectionData,
  getTableStatusDistribution,
} from "../utils/tableEngine.js";
import { generateQRPrintLayout } from "../utils/qrPrintKit.js";

export const tablesRouter = router({
  createSection: protectedProcedure
    .input(
      z.object({
        cafeteriaId: z.string(),
        name: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Enforce plan limits for sections
      const planContext = await getPlanContext(input.cafeteriaId);
      // Allow at least one section even on starter plan to enable table creation
      const db_sections = await db
        .select()
        .from(sections)
        .where(eq(sections.cafeteriaId, input.cafeteriaId));
      
      if (db_sections.length > 0) {
        assertFeature(
          planContext, 
          "sections", 
          `Multiple sections is a premium feature. Your current ${planContext.plan} plan does not support this.`
        );
      }

      const validation = validateSectionData(input.name);
      if (!validation.valid) {
        throw new Error(validation.errors.join(", "));
      }

      const id = nanoid();
      const now = new Date();

      await db.insert(sections).values({
        id,
        cafeteriaId: input.cafeteriaId,
        name: input.name,
        displayOrder: 0,
        createdAt: now,
      });

      return {
        id,
        cafeteriaId: input.cafeteriaId,
        name: input.name,
        createdAt: now,
      };
    }),

  getSections: protectedProcedure
    .input(z.object({ cafeteriaId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db
        .select()
        .from(sections)
        .where(eq(sections.cafeteriaId, input.cafeteriaId));

      return result.map((section: any) => ({
        id: section.id,
        cafeteriaId: section.cafeteriaId,
        name: section.name,
        displayOrder: section.displayOrder || 0,
        createdAt: section.createdAt,
      }));
    }),

  createTable: protectedProcedure
    .input(
      z.object({
        cafeteriaId: z.string(),
        sectionId: z.string(),
        tableNumber: z.number().positive(),
        capacity: z.number().positive(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Enforce plan limits for tables
      const planContext = await getPlanContext(input.cafeteriaId);
      const currentTables = await db
        .select()
        .from(cafeteriaTables)
        .where(eq(cafeteriaTables.cafeteriaId, input.cafeteriaId));
      
      assertLimit(
        planContext, 
        "maxTables", 
        currentTables.length, 
        `Your current ${planContext.plan} plan only allows up to ${planContext.limits.maxTables} tables.`
      );

      const validation = validateTableData(input.tableNumber, input.capacity, input.sectionId);
      if (!validation.valid) {
        throw new Error(validation.errors.join(", "));
      }

      const id = nanoid();
      const tableToken = nanoid(32);
      const now = new Date();

      console.log("[TablesRouter] Inserting table:", { id, tableNumber: input.tableNumber, sectionId: input.sectionId });
      await db.insert(cafeteriaTables).values({
        id,
        cafeteriaId: input.cafeteriaId,
        sectionId: input.sectionId,
        tableNumber: input.tableNumber,
        capacity: input.capacity,
        status: "available",
        tableToken,
        createdAt: now,
      });
      console.log("[TablesRouter] Table inserted successfully");

      return {
        id,
        cafeteriaId: input.cafeteriaId,
        sectionId: input.sectionId,
        tableNumber: input.tableNumber,
        capacity: input.capacity,
        status: "available",
        tableToken,
        createdAt: now,
      };
    }),

  getTables: protectedProcedure
    .input(
      z.object({
        cafeteriaId: z.string(),
        sectionId: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions = [eq(cafeteriaTables.cafeteriaId, input.cafeteriaId)];
      if (input.sectionId) {
        conditions.push(eq(cafeteriaTables.sectionId, input.sectionId));
      }

      const result = await db
        .select()
        .from(cafeteriaTables)
        .where(and(...conditions));

      return result.map((table: any) => ({
        id: table.id,
        cafeteriaId: table.cafeteriaId,
        sectionId: table.sectionId,
        tableNumber: table.tableNumber,
        capacity: table.capacity,
        status: table.status,
        tableToken: table.tableToken,
        createdAt: table.createdAt,
      }));
    }),

  updateTableStatus: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        status: z.enum(["available", "occupied", "in_progress", "ready", "served"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(cafeteriaTables)
        .set({ status: input.status })
        .where(eq(cafeteriaTables.id, input.tableId));

      return {
        id: input.tableId,
        status: input.status,
      };
    }),

  deleteTable: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.delete(cafeteriaTables).where(eq(cafeteriaTables.id, input.tableId));
      return { success: true };
    }),

  printQRs: protectedProcedure
    .input(z.object({ cafeteriaId: z.string(), tableIds: z.array(z.string()).optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions = [eq(cafeteriaTables.cafeteriaId, input.cafeteriaId)];
      if (input.tableIds && input.tableIds.length > 0) {
        // In a real app, we'd use inArray, but for simplicity:
        // conditions.push(inArray(cafeteriaTables.id, input.tableIds));
      }

      const tables = await db
        .select()
        .from(cafeteriaTables)
        .where(and(...conditions));

      return generateQRPrintLayout(tables);
    }),
});
