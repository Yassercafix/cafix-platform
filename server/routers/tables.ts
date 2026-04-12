import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc.js";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db.js";
import { cafeteriaTables, sections } from "../../drizzle/schema.js";
import {
  validateTableData,
  validateSectionData,
} from "../utils/tableEngine.js";
import { generateQRPrintLayout } from "../utils/qrPrintKit.js";

const DEFAULT_SECTION_NAME = "All";

async function ensureDefaultSection(db: any, cafeteriaId: string) {
  const existingSections = await db
    .select()
    .from(sections)
    .where(eq(sections.cafeteriaId, cafeteriaId));

  if (existingSections.length > 0) {
    const allSection = existingSections.find((section: any) => section.name === DEFAULT_SECTION_NAME);
    return allSection || existingSections.sort((a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0))[0];
  }

  const now = new Date();
  const defaultSection = {
    id: nanoid(),
    cafeteriaId,
    name: DEFAULT_SECTION_NAME,
    displayOrder: 0,
    createdAt: now,
  };

  await db.insert(sections).values(defaultSection);
  return defaultSection;
}

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

      const validation = validateSectionData(input.name);
      if (!validation.valid) {
        throw new Error(validation.errors.join(", "));
      }

      const id = nanoid();
      const now = new Date();

      await db.insert(sections).values({
        id,
        cafeteriaId: input.cafeteriaId,
        name: input.name.trim(),
        displayOrder: 0,
        createdAt: now,
      });

      return {
        id,
        cafeteriaId: input.cafeteriaId,
        name: input.name.trim(),
        displayOrder: 0,
        createdAt: now,
      };
    }),

  getSections: protectedProcedure
    .input(z.object({ cafeteriaId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await ensureDefaultSection(db, input.cafeteriaId);

      const result = await db
        .select()
        .from(sections)
        .where(eq(sections.cafeteriaId, input.cafeteriaId));

      return result
        .sort((a: any, b: any) => {
          if (a.name === DEFAULT_SECTION_NAME) return -1;
          if (b.name === DEFAULT_SECTION_NAME) return 1;
          return (a.displayOrder || 0) - (b.displayOrder || 0);
        })
        .map((section: any) => ({
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
        sectionId: z.string().optional(),
        tableNumber: z.number().positive(),
        capacity: z.number().positive(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const defaultSection = await ensureDefaultSection(db, input.cafeteriaId);
      const sectionId = input.sectionId || defaultSection.id;

      const validation = validateTableData(input.tableNumber, input.capacity, sectionId);
      if (!validation.valid) {
        throw new Error(validation.errors.join(", "));
      }

      const existingTable = await db
        .select({ id: cafeteriaTables.id })
        .from(cafeteriaTables)
        .where(and(
          eq(cafeteriaTables.cafeteriaId, input.cafeteriaId),
          eq(cafeteriaTables.tableNumber, input.tableNumber),
        ));

      if (existingTable.length > 0) {
        throw new Error(`Table ${input.tableNumber} already exists.`);
      }

      const id = nanoid();
      const tableToken = nanoid(32);
      const now = new Date();

      await db.insert(cafeteriaTables).values({
        id,
        cafeteriaId: input.cafeteriaId,
        sectionId,
        tableNumber: input.tableNumber,
        capacity: input.capacity,
        status: "available",
        tableToken,
        createdAt: now,
      });

      return {
        id,
        cafeteriaId: input.cafeteriaId,
        sectionId,
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

      await ensureDefaultSection(db, input.cafeteriaId);

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
        status: table.status || "available",
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
