/**
 * Marketers Router
 * Handles marketer and cafeteria creation with hierarchical reference codes
 */

import { z } from "zod";
import { protectedProcedure, adminProcedure, ownerOrMarketerProcedure, router } from "../_core/trpc.js";
import { eq } from "drizzle-orm";
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
import { createClient } from "@supabase/supabase-js";
import bcryptjs from "bcryptjs";

// Initialize Supabase admin client for creating auth accounts
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let supabaseAdmin: any = null;
if (supabaseUrl && supabaseServiceKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export const marketersRouter = router({
  /**
   * Create a new level 1 marketer (only for owner)
   * Also creates a Supabase Auth account so the marketer can login
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

      // Check if email already exists in marketers table
      const existingMarketer = await db
        .select()
        .from(marketers)
        .where(eq(marketers.loginUsername, input.loginUsername))
        .limit(1);

      if (existingMarketer.length > 0) {
        throw new Error(`A marketer with email ${input.loginUsername} already exists`);
      }

      // Hash the password for storage in our DB
      const salt = await bcryptjs.genSalt(10);
      const hashedPassword = await bcryptjs.hash(input.passwordHash, salt);

      const referenceCode = await generateInitialReferenceCode(EntityType.MARKETER);
      const id = nanoid();

      // Insert marketer into our database first
      await db.insert(marketers).values({
        id,
        name: input.name,
        email: input.email || input.loginUsername,
        loginUsername: input.loginUsername,
        passwordHash: hashedPassword,
        referenceCode,
        country: input.country,
        currency: input.currency,
        language: input.language || "en",
        createdAt: new Date(),
      });

      // Create Supabase Auth account so the marketer can login
      if (supabaseAdmin) {
        try {
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: input.loginUsername,
            password: input.passwordHash,
            email_confirm: true,
            user_metadata: {
              name: input.name,
              role: "marketer",
              referenceCode,
            },
          });

          if (authError) {
            // If Supabase Auth user already exists, that's OK - just log it
            if (authError.message?.includes("already been registered") || authError.message?.includes("already exists")) {
              console.log(`[createLevel1Marketer] Supabase Auth user already exists for ${input.loginUsername}, skipping auth creation`);
            } else {
              console.error(`[createLevel1Marketer] Failed to create Supabase Auth user:`, authError.message);
              // Don't fail the whole operation - the DB record was created
            }
          } else {
            console.log(`[createLevel1Marketer] Created Supabase Auth user for ${input.loginUsername}`);
          }
        } catch (authErr: any) {
          console.error(`[createLevel1Marketer] Supabase Auth error:`, authErr.message);
          // Don't fail - DB record was created
        }
      } else {
        console.warn("[createLevel1Marketer] Supabase admin client not available, skipping auth account creation");
      }

      return {
        id,
        name: input.name,
        referenceCode,
      };
    }),

  /**
   * Create a child marketer under an existing marketer
   * Also creates a Supabase Auth account so the child marketer can login
   */
  createChildMarketer: ownerOrMarketerProcedure
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

      // Check if email already exists
      const existingMarketer = await db
        .select()
        .from(marketers)
        .where(eq(marketers.loginUsername, input.loginUsername))
        .limit(1);

      if (existingMarketer.length > 0) {
        throw new Error(`A marketer with email ${input.loginUsername} already exists`);
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

      // Hash the password
      const salt = await bcryptjs.genSalt(10);
      const hashedPassword = await bcryptjs.hash(input.passwordHash, salt);

      await db.insert(marketers).values({
        id,
        name: input.name,
        email: input.email || input.loginUsername,
        loginUsername: input.loginUsername,
        passwordHash: hashedPassword,
        parentId: parentMarketer[0].id,
        referenceCode: childReferenceCode,
        country,
        currency,
        language,
        createdAt: new Date(),
      });

      // Create Supabase Auth account
      if (supabaseAdmin) {
        try {
          const { error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: input.loginUsername,
            password: input.passwordHash,
            email_confirm: true,
            user_metadata: {
              name: input.name,
              role: "marketer",
              referenceCode: childReferenceCode,
            },
          });

          if (authError && !authError.message?.includes("already been registered") && !authError.message?.includes("already exists")) {
            console.error(`[createChildMarketer] Failed to create Supabase Auth user:`, authError.message);
          }
        } catch (authErr: any) {
          console.error(`[createChildMarketer] Supabase Auth error:`, authErr.message);
        }
      }

      return {
        id,
        name: input.name,
        referenceCode: childReferenceCode,
        parentReferenceCode: input.parentMarketerCode,
      };
    }),

  /**
   * Create a cafeteria under a marketer
   * Owner can create cafeterias directly (under the first marketer or a specified marketer)
   * Marketers can also create cafeterias under themselves
   * Also creates a Supabase Auth account so the cafeteria can login
   */
  createCafeteria: ownerOrMarketerProcedure
    .input(
      z.object({
        marketerCode: z.string(),
        name: z.string(),
        location: z.string().optional().nullable(),
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

      // Check if cafeteria email already exists
      const existingCafeteria = await db
        .select()
        .from(cafeterias)
        .where(eq(cafeterias.loginUsername, input.loginUsername))
        .limit(1);

      if (existingCafeteria.length > 0) {
        throw new Error(`A cafeteria with email ${input.loginUsername} already exists`);
      }

      let marketerRecord: any = null;
      let effectiveMarketerCode = input.marketerCode;

      // If owner is creating a cafeteria, find or use the specified marketer
      if (ctx.user?.role === "owner") {
        // Owner can specify any marketer code
        const marketerRows = await db
          .select()
          .from(marketers)
          .where(eq(marketers.referenceCode, input.marketerCode))
          .limit(1);

        if (marketerRows.length === 0) {
          // If no marketer found with that code, try to find the first available marketer
          const allMarketers = await db
            .select()
            .from(marketers)
            .limit(1);

          if (allMarketers.length === 0) {
            throw new Error("No marketers found. Please create a marketer first before adding cafeterias.");
          }
          marketerRecord = allMarketers[0];
          effectiveMarketerCode = marketerRecord.referenceCode;
        } else {
          marketerRecord = marketerRows[0];
        }
      } else {
        // Marketer creating cafeteria - use their own reference code
        const marketerRows = await db
          .select()
          .from(marketers)
          .where(eq(marketers.referenceCode, input.marketerCode))
          .limit(1);

        if (marketerRows.length === 0) {
          throw new Error(`Marketer not found: ${input.marketerCode}`);
        }
        marketerRecord = marketerRows[0];
      }

      // Generate cafeteria reference code
      const cafeteriaReferenceCode = await generateChildReferenceCode(
        effectiveMarketerCode,
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

      // Use provided country/currency/language or inherit from marketer
      const country = input.country || marketerRecord.country;
      const currency = input.currency || marketerRecord.currency;
      const language = input.language || marketerRecord.language || "en";

      // Hash the password
      const salt = await bcryptjs.genSalt(10);
      const hashedPassword = await bcryptjs.hash(input.passwordHash, salt);

      await db.insert(cafeterias).values({
        id,
        marketerId: marketerRecord.id,
        name: input.name,
        location: input.location || null,
        loginUsername: input.loginUsername,
        passwordHash: hashedPassword,
        referenceCode: cafeteriaReferenceCode,
        pointsBalance: "0",
        graceMode: false,
        country,
        currency,
        language,
        freeOperationEndDate,
        subscriptionPlan: "starter",
        subscriptionStatus: "active",
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

      // Create Supabase Auth account so the cafeteria can login
      if (supabaseAdmin) {
        try {
          const { error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: input.loginUsername,
            password: input.passwordHash,
            email_confirm: true,
            user_metadata: {
              name: input.name,
              role: "cafeteria_admin",
              referenceCode: cafeteriaReferenceCode,
            },
          });

          if (authError && !authError.message?.includes("already been registered") && !authError.message?.includes("already exists")) {
            console.error(`[createCafeteria] Failed to create Supabase Auth user:`, authError.message);
          } else if (!authError) {
            console.log(`[createCafeteria] Created Supabase Auth user for ${input.loginUsername}`);
          }
        } catch (authErr: any) {
          console.error(`[createCafeteria] Supabase Auth error:`, authErr.message);
        }
      }

      return {
        id,
        name: input.name,
        referenceCode: cafeteriaReferenceCode,
        marketerCode: effectiveMarketerCode,
      };
    }),

  /**
   * Get marketer hierarchy information
   */
  /**
   * List all marketers (only for owner)
   */
  listMarketers: adminProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Only the owner can list all marketers
      if (ctx.user?.role !== "owner") {
        throw new Error("Only the owner can list all marketers");
      }

      const allMarketers = await db
        .select()
        .from(marketers)
        .order(marketers.createdAt, { ascending: false });

      return allMarketers;
    }),

  /**
   * List all cafeterias (only for owner)
   */
  listCafeterias: adminProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Only the owner can list all cafeterias
      if (ctx.user?.role !== "owner") {
        throw new Error("Only the owner can list all cafeterias");
      }

      const allCafeterias = await db
        .select()
        .from(cafeterias)
        .order(cafeterias.createdAt, { ascending: false });

      return allCafeterias;
    }),

  getMarketerHierarchy: ownerOrMarketerProcedure
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
  getCafeteria: ownerOrMarketerProcedure
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
