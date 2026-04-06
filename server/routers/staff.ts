/**
 * Staff Router
 * Handles staff management, permissions, and assignments
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc.js";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { generateStaffReferenceCode } from "../utils/staffReferenceCodeGenerator.js";
import { getDb } from "../db.js";
import {
  users,
  marketers,
  cafeterias,
  cafeteriaStaff,
  sections,
  staffSectionAssignments,
  staffCategoryAssignments,
  menuCategories,
} from "../../drizzle/schema.js";
import {
  canGrantLoginPermission,
  canRevokeLoginPermission,
  getVisibleSections,
  getVisibleCategories,
  isValidStaffRole,
  getDefaultPermissionsForRole,
} from "../utils/staffPermissions.js";
import { getPlanContext, assertLimit } from "../utils/planGuard.js";
import {
  grantStaffLoginPermission,
  revokeStaffLoginPermission,
  canStaffLogin,
  assignStaffToSection,
  getStaffSectionAssignments,
  assignStaffToCategory,
  getStaffCategoryAssignments,
  createSection,
  getSectionsByCafeteria,
} from "../db.js";
import bcryptjs from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const SALT_ROUNDS = 10;

// Initialize Supabase admin client for creating auth accounts
const _supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const _supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
let supabaseAdmin: any = null;
if (_supabaseUrl && _supabaseServiceKey) {
  supabaseAdmin = createClient(_supabaseUrl, _supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Hash password using bcryptjs
 */
async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, SALT_ROUNDS);
}

export const staffRouter = router({
  /**
   * Create a new staff member
   */
  createStaff: protectedProcedure
    .input(
      z.object({
        cafeteriaId: z.string(),
        name: z.string().min(2, "Name must be at least 2 characters"),
        role: z.enum(["cafeteria_admin", "manager", "waiter", "chef"]),
        loginUsername: z.string().min(3, "Login username must be at least 3 characters"),
        password: z.string().min(6, "Password must be at least 6 characters"),
        phone: z.string().optional(),
        country: z.string().optional(),
        currency: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      if (!isValidStaffRole(input.role)) {
        throw new Error(`Invalid staff role: ${input.role}`);
      }

      // Enforce plan limits
      const planContext = await getPlanContext(input.cafeteriaId);
      const currentStaff = await db
        .select()
        .from(cafeteriaStaff)
        .where(eq(cafeteriaStaff.cafeteriaId, input.cafeteriaId));
      
      assertLimit(
        planContext, 
        "maxStaff", 
        currentStaff.length, 
        `Your current ${planContext.plan} plan only allows up to ${planContext.limits.maxStaff} staff members.`
      );

      // Check if loginUsername already exists across all account tables (system-wide uniqueness)
      const existingInStaff = await db
        .select()
        .from(cafeteriaStaff)
        .where(eq(cafeteriaStaff.loginUsername, input.loginUsername));

      if (existingInStaff.length > 0) {
        throw new Error("Login username already exists");
      }

      // Check in users table
      const existingInUsers = await db
        .select()
        .from(users)
        .where(eq(users.loginUsername, input.loginUsername));

      if (existingInUsers.length > 0) {
        throw new Error("Login username already exists in system");
      }

      // Check in marketers table
      const existingInMarketers = await db
        .select()
        .from(marketers)
        .where(eq(marketers.loginUsername, input.loginUsername));

      if (existingInMarketers.length > 0) {
        throw new Error("Login username already exists in system");
      }

      // Check in cafeterias table
      const existingInCafeterias = await db
        .select()
        .from(cafeterias)
        .where(eq(cafeterias.loginUsername, input.loginUsername));

      if (existingInCafeterias.length > 0) {
        throw new Error("Login username already exists in system");
      }

      const passwordHash = await hashPassword(input.password);

      return await db.transaction(async (tx: any) => {
        // Generate a deterministic reference code derived from the cafeteria's referenceCode.
        // Format: {cafeteriaReferenceCode}{roleLetter}{nn}
        // e.g., 1001P01W03  (3rd waiter in cafeteria whose code is 1001P01)
        // RACE CONDITION PROTECTION: generateStaffReferenceCode uses SELECT ... FOR UPDATE
        const referenceCode = await generateStaffReferenceCode(tx, input.cafeteriaId, input.role);
        
        const id = nanoid();

        await tx.insert(cafeteriaStaff).values({
          id,
          cafeteriaId: input.cafeteriaId,
          name: input.name,
          role: input.role,
          loginUsername: input.loginUsername,
          passwordHash,
          phone: input.phone || null,
          referenceCode,
          status: "active",
          canLogin: true, // Automatically enable login for newly created staff
          country: input.country,
          currency: input.currency,
          createdAt: new Date(),
        });

        return {
          id,
          name: input.name,
          role: input.role,
          loginUsername: input.loginUsername,
          canLogin: true,
          referenceCode,
          permissions: getDefaultPermissionsForRole(input.role),
        };
      });

      // Create Supabase Auth account so the staff member can login
      // This runs OUTSIDE the transaction so a Supabase failure doesn't roll back the DB record
      if (supabaseAdmin) {
        try {
          const { error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: input.loginUsername,
            password: input.password,
            email_confirm: true,
            user_metadata: {
              name: input.name,
              role: input.role,
              cafeteriaId: input.cafeteriaId,
            },
          });
          if (authError) {
            if (
              authError.message?.includes("already been registered") ||
              authError.message?.includes("already exists")
            ) {
              console.log(`[createStaff] Supabase Auth user already exists for ${input.loginUsername}`);
            } else {
              console.error(`[createStaff] Failed to create Supabase Auth user:`, authError.message);
            }
          } else {
            console.log(`[createStaff] Created Supabase Auth user for ${input.loginUsername}`);
          }
        } catch (authErr: any) {
          console.error(`[createStaff] Supabase Auth error:`, authErr.message);
        }
      }
    }),

  /**
   * Get staff members for a cafeteria
   */
  getStaff: protectedProcedure
    .input(z.object({ cafeteriaId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const staff = await db
        .select()
        .from(cafeteriaStaff)
        .where(eq(cafeteriaStaff.cafeteriaId, input.cafeteriaId));

      // Get assignments for each staff member
      const staffWithDetails = await Promise.all(staff.map(async (s: any) => {
        let assignment = "";
        if (s.role === "waiter") {
          const sections = await getStaffSectionAssignments(s.id);
          assignment = sections.map((as: any) => as.sectionId).join(", ");
        } else if (s.role === "chef") {
          const categories = await getStaffCategoryAssignments(s.id);
          assignment = categories.map((as: any) => as.categoryId).join(", ");
        }

        return {
          id: s.id,
          name: s.name,
          loginUsername: s.loginUsername,
          phone: s.phone,
          role: s.role,
          status: s.status,
          canLogin: s.canLogin,
          cafeteriaId: s.cafeteriaId,
          assignment,
          referenceCode: s.referenceCode,
          loginPermissionGrantedAt: s.loginPermissionGrantedAt,
          loginPermissionGrantedBy: s.loginPermissionGrantedBy,
          lastLoginAt: s.lastLoginAt,
          country: s.country,
          currency: s.currency,
          createdAt: s.createdAt,
        };
      }));

      return staffWithDetails;
    }),

  /**
   * Grant login permission to staff
   */
  grantLoginPermission: protectedProcedure
    .input(z.object({ staffId: z.string(), targetRole: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check if user can grant permission
      const userRole = ctx.user?.role || "user";
      if (!canGrantLoginPermission(userRole, input.targetRole)) {
        throw new Error("You do not have permission to grant login access");
      }

      await grantStaffLoginPermission(input.staffId, ctx.user?.name || "admin");

      return {
        success: true,
        staffId: input.staffId,
        canLogin: true,
      };
    }),

  /**
   * Revoke login permission from staff
   */
  revokeLoginPermission: protectedProcedure
    .input(z.object({ staffId: z.string(), targetRole: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check if user can revoke permission
      const userRole = ctx.user?.role || "user";
      if (!canRevokeLoginPermission(userRole, input.targetRole)) {
        throw new Error("You do not have permission to revoke login access");
      }

      await revokeStaffLoginPermission(input.staffId);

      return {
        success: true,
        staffId: input.staffId,
        canLogin: false,
      };
    }),

  /**
   * Check if staff can log in
   */
  canLogin: protectedProcedure
    .input(z.object({ staffId: z.string() }))
    .query(async ({ input }) => {
      const hasPermission = await canStaffLogin(input.staffId);
      return {
        canLogin: hasPermission,
      };
    }),

  /**
   * Assign staff to section (for waiters)
   */
  assignToSection: protectedProcedure
    .input(z.object({ staffId: z.string(), sectionId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Remove existing assignments first
      await db
        .delete(staffSectionAssignments)
        .where(eq(staffSectionAssignments.staffId, input.staffId));

      // Add new assignment
      await assignStaffToSection(input.staffId, input.sectionId);

      return {
        success: true,
        staffId: input.staffId,
        sectionId: input.sectionId,
      };
    }),

  /**
   * Get sections assigned to staff
   */
  getAssignedSections: protectedProcedure
    .input(z.object({ staffId: z.string() }))
    .query(async ({ input }) => {
      const sectionAssignments = await getStaffSectionAssignments(input.staffId);
      return { sectionIds: sectionAssignments.map((s: any) => ({ id: s.sectionId })) };
    }),

  /**
   * Assign staff to category (for chefs)
   */
  assignToCategory: protectedProcedure
    .input(z.object({ staffId: z.string(), categoryId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Remove existing assignments first
      await db
        .delete(staffCategoryAssignments)
        .where(eq(staffCategoryAssignments.staffId, input.staffId));

      // Add new assignment
      await assignStaffToCategory(input.staffId, input.categoryId);

      return {
        success: true,
        staffId: input.staffId,
        categoryId: input.categoryId,
      };
    }),

  /**
   * Get categories assigned to staff
   */
  getAssignedCategories: protectedProcedure
    .input(z.object({ staffId: z.string() }))
    .query(async ({ input }) => {
      const categoryAssignments = await getStaffCategoryAssignments(input.staffId);
      return { categoryIds: categoryAssignments.map((c: any) => ({ id: c.categoryId })) };
    }),

  /**
   * Create a section in cafeteria
   */
  createSection: protectedProcedure
    .input(
      z.object({
        cafeteriaId: z.string(),
        name: z.string(),
        displayOrder: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = await createSection(input.cafeteriaId, input.name, input.displayOrder || 0);

      return {
        id,
        name: input.name,
        displayOrder: input.displayOrder || 0,
      };
    }),

  /**
   * Get sections for a cafeteria
   */
  getSections: protectedProcedure
    .input(z.object({ cafeteriaId: z.string() }))
    .query(async ({ input }) => {
      const sections_list = await getSectionsByCafeteria(input.cafeteriaId);

      return sections_list.map((s: any) => ({
        id: s.id,
        name: s.name,
        displayOrder: s.displayOrder,
        createdAt: s.createdAt,
      }));
    }),

  /**
   * Get visible sections for a staff member
   */
  getVisibleSectionsForStaff: protectedProcedure
    .input(z.object({ staffId: z.string(), cafeteriaId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get staff details
      const staff_result = await db
        .select()
        .from(cafeteriaStaff)
        .where(eq(cafeteriaStaff.id, input.staffId));

      if (staff_result.length === 0) {
        throw new Error("Staff not found");
      }

      const staff = staff_result[0];

      // Get all sections
      const all_sections = await getSectionsByCafeteria(input.cafeteriaId);
      const allSectionIds = all_sections.map((s: any) => s.id);

        // Get assigned sections
      const assignedSectionRaw = await getStaffSectionAssignments(input.staffId);
      const assignedSectionIds = assignedSectionRaw.map((s: any) => s.sectionId);
      // Get visible sections based on role
      const visibleSectionIds = getVisibleSections(staff.role || "waiter", assignedSectionIds, allSectionIds);
      return {
        visibleSectionIds,
        allSectionIds,
        assignedSectionIds,
      };
    }),

  /**
   * Get visible categories for a staff member
   */
  getVisibleCategoriesForStaff: protectedProcedure
    .input(z.object({ staffId: z.string(), cafeteriaId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get staff details
      const staff_result = await db
        .select()
        .from(cafeteriaStaff)
        .where(eq(cafeteriaStaff.id, input.staffId));

      if (staff_result.length === 0) {
        throw new Error("Staff not found");
      }

      const staff = staff_result[0];

      // Get assigned categories
      const assignedCategoryRaw = await getStaffCategoryAssignments(input.staffId);
      const assignedCategoryIds = assignedCategoryRaw.map((c: any) => c.categoryId);

      // Get all categories for cafeteria
      const allCategoriesResult = await db
        .select({ id: menuCategories.id })
        .from(menuCategories)
        .where(eq(menuCategories.cafeteriaId, input.cafeteriaId));
      const allCategoryIds: string[] = allCategoriesResult.map((c: any) => c.id);

      // Get visible categories based on role
      const visibleCategoryIds = getVisibleCategories(
        staff.role || "chef",
        assignedCategoryIds as string[],
        allCategoryIds
      );

      return {
        visibleCategoryIds,
        allCategoryIds,
        assignedCategoryIds,
      };
    }),

  /**
   * Update staff details
   */
  updateStaff: protectedProcedure
    .input(
      z.object({
        staffId: z.string(),
        name: z.string().optional(),
        status: z.enum(["active", "inactive"]).optional(),
        country: z.string().optional(),
        currency: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const updates: Record<string, any> = {};

      if (input.name) updates.name = input.name;
      if (input.status) updates.status = input.status;
      if (input.country) updates.country = input.country;
      if (input.currency) updates.currency = input.currency;

      if (Object.keys(updates).length === 0) {
        throw new Error("No updates provided");
      }

      await db.update(cafeteriaStaff).set(updates).where(eq(cafeteriaStaff.id, input.staffId));

      return {
        success: true,
        staffId: input.staffId,
        updates,
      };
    }),

  /**
   * Get staff permissions
   */
  getPermissions: protectedProcedure
    .input(z.object({ staffId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const staff_result = await db
        .select()
        .from(cafeteriaStaff)
        .where(eq(cafeteriaStaff.id, input.staffId));

      if (staff_result.length === 0) {
        throw new Error("Staff not found");
      }

      const staff = staff_result[0];
      const permissions = getDefaultPermissionsForRole(staff.role || "waiter");

      return {
        staffId: input.staffId,
        role: staff.role,
        canLogin: staff.canLogin,
        permissions,
      };
    }),

  /**
   * Update staff role
   */
  updateStaffRole: protectedProcedure
    .input(
      z.object({
        staffId: z.string(),
        newRole: z.enum(["cafeteria_admin", "manager", "waiter", "chef"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      if (!isValidStaffRole(input.newRole)) {
        throw new Error(`Invalid staff role: ${input.newRole}`);
      }

      const permissions = getDefaultPermissionsForRole(input.newRole);

      await db
        .update(cafeteriaStaff)
        .set({
          role: input.newRole,
          permissions: JSON.stringify(permissions),
        })
        .where(eq(cafeteriaStaff.id, input.staffId));

      return {
        success: true,
        staffId: input.staffId,
        newRole: input.newRole,
        permissions,
      };
    }),

  /**
   * Delete a staff member
   */
  deleteStaff: protectedProcedure
    .input(z.object({ staffId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Fetch staff record before deletion to get loginUsername for Supabase Auth cleanup
      const staffRecord = await db
        .select()
        .from(cafeteriaStaff)
        .where(eq(cafeteriaStaff.id, input.staffId))
        .limit(1);

      // Remove section assignments first
      await db
        .delete(staffSectionAssignments)
        .where(eq(staffSectionAssignments.staffId, input.staffId));
      // Remove category assignments
      await db
        .delete(staffCategoryAssignments)
        .where(eq(staffCategoryAssignments.staffId, input.staffId));
      // Delete the staff member
      await db
        .delete(cafeteriaStaff)
        .where(eq(cafeteriaStaff.id, input.staffId));

      // Delete Supabase Auth account if it exists
      if (supabaseAdmin && staffRecord.length > 0) {
        const loginUsername = staffRecord[0].loginUsername;
        if (loginUsername) {
          try {
            // Find the Supabase Auth user by email
            const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
            const authUser = authUsers?.users?.find((u: any) => u.email === loginUsername);
            if (authUser) {
              await supabaseAdmin.auth.admin.deleteUser(authUser.id);
              console.log(`[deleteStaff] Deleted Supabase Auth user for ${loginUsername}`);
            }
          } catch (authErr: any) {
            console.error(`[deleteStaff] Failed to delete Supabase Auth user:`, authErr.message);
          }
        }
      }

      return {
        success: true,
        staffId: input.staffId,
      };
    }),

  /**
   * Toggle staff login permission
   */
  toggleStaffLogin: protectedProcedure
    .input(
      z.object({
        staffId: z.string(),
        enable: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const staffResult = await db
        .select()
        .from(cafeteriaStaff)
        .where(eq(cafeteriaStaff.id, input.staffId));

      if (staffResult.length === 0) {
        throw new Error("Staff not found");
      }

      const now = new Date();
      const updates: Record<string, any> = {
        canLogin: input.enable,
      };

      if (input.enable) {
        updates.loginPermissionGrantedAt = now;
        updates.loginPermissionGrantedBy = ctx.user?.name || "admin";
      }

      await db
        .update(cafeteriaStaff)
        .set(updates)
        .where(eq(cafeteriaStaff.id, input.staffId));

      return {
        success: true,
        staffId: input.staffId,
        canLogin: input.enable,
        updatedAt: now,
      };
    }),
});
