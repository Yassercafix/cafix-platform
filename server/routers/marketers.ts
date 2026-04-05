/**
 * Marketers Router
 * Handles marketer and cafeteria creation with hierarchical reference codes
 */

import { z } from "zod";
import { protectedProcedure, adminProcedure, marketerProcedure, router } from "../_core/trpc.js";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb, getMarketerBalance } from "../db.js";
import { marketers, cafeterias, systemConfigs, freeOperationPeriods } from "../../drizzle/schema.js";
import {
  generateInitialReferenceCode,
  generateChildReferenceCode,
  getParentCode,
  getMarketerDepth,
  EntityType,
} from "../utils/referenceCodeGenerator.js";

export const marketersRouter = router({
  /**
   * Create a new level 1 marketer (only for owner)
   */
  createLevel1Marketer: adminProcedure
    .input(
      z.object({
        name: z.string(),
        email: z.string().email().optional(),
        loginUsername: z.string().email(),
        passwordHash: z.string().min(8),
        country: z.string().optional(),
        currency: z.string().optional(),
        language: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Only the owner can create level 1 marketers
      if (ctx.user?.role !== "owner") {
        throw new Error("Only the owner can create level 1 marketers");
      }

      const referenceCode = await generateInitialReferenceCode(EntityType.MARKETER);

      const id = nanoid();

      await db.insert(marketers).values({
        id,
        name: input.name,
        email: input.email,
        loginUsername: input.loginUsername,
        passwordHash: input.passwordHash,
        referenceCode,
        country: input.country,
        currency: input.currency,
        language: input.language || "en",
        createdAt: new Date(),
      });

      return {
        id,
        name: input.name,
        referenceCode,
      };
    }),

  /**
   * Create a child marketer under an existing marketer
   */
  createChildMarketer: marketerProcedure
    .input(
      z.object({
        parentMarketerCode: z.string(),
        name: z.string(),
        email: z.string().email().optional(),
        loginUsername: z.string().email(),
        passwordHash: z.string().min(8),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check if parent marketer exists
      const parentMarketer = await db
        .select()
        .from(marketers)
        .where(eq(marketers.referenceCode, input.parentMarketerCode));

      if (parentMarketer.length === 0) {
        throw new Error(`Parent marketer not found: ${input.parentMarketerCode}`);
      }

      // Check if parent marketer can create children (max depth = 3)
      const parentDepth = getMarketerDepth(input.parentMarketerCode);
      if (parentDepth >= 3) {
        throw new Error(`Marketer at level ${parentDepth} cannot create child marketers (level 3 is the limit)`);
      }

      // Generate child reference code
      const childReferenceCode = await generateChildReferenceCode(
        input.parentMarketerCode,
        EntityType.MARKETER
      );

      const id = nanoid();

      // Enforce inheritance from parent
      const country = parentMarketer[0].country;
      const currency = parentMarketer[0].currency;
      const language = parentMarketer[0].language || "en";

      await db.insert(marketers).values({
        id,
        name: input.name,
        email: input.email,
        loginUsername: input.loginUsername,
        passwordHash: input.passwordHash,
        parentId: parentMarketer[0].id,
        referenceCode: childReferenceCode,
        country,
        currency,
        language,
        createdAt: new Date(),
      });

      return {
        id,
        name: input.name,
        referenceCode: childReferenceCode,
        parentReferenceCode: input.parentMarketerCode,
      };
    }),

  /**
   * Create a cafeteria under a marketer
   * Only son marketers can create cafeterias
   */
  createCafeteria: marketerProcedure
    .input(
      z.object({
        marketerCode: z.string(),
        name: z.string(),
        location: z.string().optional(),
        loginUsername: z.string().email(),
        passwordHash: z.string().min(8),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check if marketer exists
      const marketer = await db
        .select()
        .from(marketers)
        .where(eq(marketers.referenceCode, input.marketerCode));

      if (marketer.length === 0) {
        throw new Error(`Marketer not found: ${input.marketerCode}`);
      }

      // Any marketer (Level 1, 2, or 3) can create cafeterias.
      // Reference code engine handles parent validation via isMarketerCode check.
      // Depth is implicitly capped at 3 for marketers, and cafeterias are leaf nodes.

      // Generate cafeteria reference code
      const cafeteriaReferenceCode = await generateChildReferenceCode(
        input.marketerCode,
        EntityType.CAFETERIA
      );

      const id = nanoid();

      // Get global free period setting
      const globalFreeMonthsConfig = await db
        .select()
        .from(systemConfigs)
        .where(eq(systemConfigs.key, "global_free_months"))
        .limit(1);
      
      const freeMonths = globalFreeMonthsConfig.length > 0 ? parseInt(globalFreeMonthsConfig[0].value || "0") : 0;
      const now = new Date();
      let freeOperationEndDate = null;

      if (freeMonths > 0) {
        freeOperationEndDate = new Date(now);
        freeOperationEndDate.setMonth(freeOperationEndDate.getMonth() + freeMonths);
      }

      // Enforce inheritance from marketer
      const country = marketer[0].country;
      const currency = marketer[0].currency;
      const language = marketer[0].language || "en";

      await db.insert(cafeterias).values({
        id,
        marketerId: marketer[0].id,
        name: input.name,
        location: input.location,
        loginUsername: input.loginUsername,
        passwordHash: input.passwordHash,
        referenceCode: cafeteriaReferenceCode,
        pointsBalance: "0",
        graceMode: false,
        country,
        currency,
        language,
        freeOperationEndDate,
        subscriptionPlan: "starter", // Default value
        subscriptionStatus: "active", // Default value
        createdAt: now,
      });

      // If free period is active, also create a record in freeOperationPeriods for tracking
      if (freeOperationEndDate) {
        await db.insert(freeOperationPeriods).values({
          id: nanoid(),
          cafeteriaId: id,
          periodType: "global_first_time",
          startDate: now,
          endDate: freeOperationEndDate,
          reason: `Global first-time free period (${freeMonths} months)`,
          createdAt: now,
        });
      }

      return {
        id,
        name: input.name,
        referenceCode: cafeteriaReferenceCode,
        marketerCode: input.marketerCode,
      };
    }),

  /**
   * Get marketer hierarchy information
   */
  getMarketerHierarchy: marketerProcedure
    .input(z.object({ marketerCode: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const marketer = await db
        .select()
        .from(marketers)
        .where(eq(marketers.referenceCode, input.marketerCode));

      if (marketer.length === 0) {
        throw new Error(`Marketer not found: ${input.marketerCode}`);
      }

      const marketerData = marketer[0];

      // Get parent information
      let parentInfo = null;
      if (marketerData.parentId) {
        const parent = await db
          .select()
          .from(marketers)
          .where(eq(marketers.id, marketerData.parentId));
        if (parent.length > 0) {
          parentInfo = {
            id: parent[0].id,
            name: parent[0].name,
            referenceCode: parent[0].referenceCode,
          };
        }
      }

      // Get children marketers
      const children = await db
        .select()
        .from(marketers)
        .where(eq(marketers.parentId, marketerData.id));

      // Get cafeterias
      const cafeteriaList = await db
        .select()
        .from(cafeterias)
        .where(eq(cafeterias.marketerId, marketerData.id));

      return {
        id: marketerData.id,
        name: marketerData.name,
        referenceCode: marketerData.referenceCode,
        parent: parentInfo,
        childMarketerCount: children.length,
        childMarketers: children.map((c: any) => ({
          id: c.id,
          name: c.name,
          referenceCode: c.referenceCode,
        })),
        cafeteriaCount: cafeteriaList.length,
        cafeterias: cafeteriaList.map((c: any) => ({
          id: c.id,
          name: c.name,
          referenceCode: c.referenceCode,
        })),
      };
    }),

  /**
   * Get cafeteria information
   */
  getCafeteria: marketerProcedure
    .input(z.object({ cafeteriaCode: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const cafeteria = await db
        .select()
        .from(cafeterias)
        .where(eq(cafeterias.referenceCode, input.cafeteriaCode));

      if (cafeteria.length === 0) {
        throw new Error(`Cafeteria not found: ${input.cafeteriaCode}`);
      }

      const cafeteriaData = cafeteria[0];

      // Get marketer information
      const marketer = await db
        .select()
        .from(marketers)
        .where(eq(marketers.id, cafeteriaData.marketerId));

      return {
        id: cafeteriaData.id,
        name: cafeteriaData.name,
        referenceCode: cafeteriaData.referenceCode,
        location: cafeteriaData.location,
        pointsBalance: cafeteriaData.pointsBalance,
        graceMode: cafeteriaData.graceMode,
        marketer: marketer.length > 0 ? {
          id: marketer[0].id,
          name: marketer[0].name,
          referenceCode: marketer[0].referenceCode,
        } : null,
      };
    }),
  
  /**
   * Get marketer balance information
   */
  getMarketerBalance: protectedProcedure
    .input(z.object({ marketerId: z.string() }))
    .query(async ({ input }) => {
      const balance = await getMarketerBalance(input.marketerId);
      if (!balance) {
        return {
          pendingBalance: "0",
          availableBalance: "0",
          totalWithdrawn: "0",
        };
      }
      return balance;
    }),
  /**
   * Freeze a marketer (owner only)
   * Prevents commission distribution to this marketer and descendants
   */
  freezeMarketer: adminProcedure
    .input(z.object({ marketerId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      if (ctx.user?.role !== "owner") {
        throw new Error("Only the owner can freeze marketers");
      }

      const marketer = await db
        .select()
        .from(marketers)
        .where(eq(marketers.id, input.marketerId))
        .limit(1);

      if (marketer.length === 0) {
        throw new Error("Marketer not found");
      }

      await db
        .update(marketers)
        .set({ status: "frozen" })
        .where(eq(marketers.id, input.marketerId));

      return {
        success: true,
        marketerCode: marketer[0].referenceCode,
        status: "frozen",
      };
    }),

  /**
   * Unfreeze a marketer (owner only)
   */
  unfreezeMarketer: adminProcedure
    .input(z.object({ marketerId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      if (ctx.user?.role !== "owner") {
        throw new Error("Only the owner can unfreeze marketers");
      }

      const marketer = await db
        .select()
        .from(marketers)
        .where(eq(marketers.id, input.marketerId))
        .limit(1);

      if (marketer.length === 0) {
        throw new Error("Marketer not found");
      }

      await db
        .update(marketers)
        .set({ status: "active" })
        .where(eq(marketers.id, input.marketerId));

      return {
        success: true,
        marketerCode: marketer[0].referenceCode,
        status: "active",
      };
    }),
});
