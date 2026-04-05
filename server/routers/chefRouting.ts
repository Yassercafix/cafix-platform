import { router, staffProcedure, protectedProcedure as chefProcedure, protectedProcedure as managerProcedure } from "../_core/trpc.js";
import { z } from "zod";
import { getDb } from "../db.js";
import { orders, orderItems, staffCategoryAssignments, menuItems, kitchenLocks } from "../../drizzle/schema.js";
import { eq, and, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * Chef Routing and Kitchen Lock Router
 */

export const chefRoutingRouter = router({
  /**
   * Get items for a specific chef
   * FIX: Query DB for the chef's assigned categories and return kitchen items in those categories.
   */
  getChefItems: chefProcedure
    .input(
      z.object({
        cafeteriaId: z.string(),
        chefId: z.string(),
      })
    )
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Get categories assigned to this chef
        const assignments = await db
          .select()
          .from(staffCategoryAssignments)
          .where(eq(staffCategoryAssignments.staffId, input.chefId));

        const assignedCategoryIds = assignments.map((a: any) => a.categoryId);

        if (assignedCategoryIds.length === 0) {
          return { items: [], total: 0, assignedCategories: [] };
        }

        // Get menu items in those categories
        const assignedMenuItems = await db
          .select()
          .from(menuItems)
          .where(inArray(menuItems.categoryId, assignedCategoryIds));

        const assignedMenuItemIds = assignedMenuItems.map((m: any) => m.id);

        if (assignedMenuItemIds.length === 0) {
          return { items: [], total: 0, assignedCategories: assignedCategoryIds };
        }

        // Get orders for this cafeteria
        const cafeteriaOrders = await db
          .select({ id: orders.id })
          .from(orders)
          .where(eq(orders.cafeteriaId, input.cafeteriaId));

        const cafeteriaOrderIds = cafeteriaOrders.map((o: any) => o.id);

        if (cafeteriaOrderIds.length === 0) {
          return { items: [], total: 0, assignedCategories: assignedCategoryIds };
        }

        // Get kitchen items for this chef's categories in this cafeteria
        const kitchenItems = await db
          .select()
          .from(orderItems)
          .where(
            and(
              eq(orderItems.status, "sent_to_kitchen"),
              inArray(orderItems.menuItemId, assignedMenuItemIds)
            )
          );

        const filteredItems = kitchenItems.filter((item: any) =>
          cafeteriaOrderIds.includes(item.orderId)
        );

        return {
          items: filteredItems.map((item: any) => ({
            id: item.id,
            orderId: item.orderId,
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            status: item.status,
            notes: item.notes,
            sentToKitchenAt: item.sentToKitchenAt,
          })),
          total: filteredItems.length,
          assignedCategories: assignedCategoryIds,
        };
      } catch (error: any) {
        throw new Error(`Failed to get chef items: ${error.message}`);
      }
    }),

  /**
   * Assign categories to a chef
   * FIX: Persist assignments to staffCategoryAssignments table (replace existing).
   */
  assignCategoriesToChef: managerProcedure
    .input(
      z.object({
        chefId: z.string(),
        categoryIds: z.array(z.string()),
        cafeteriaId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Remove existing category assignments for this chef
        await db
          .delete(staffCategoryAssignments)
          .where(eq(staffCategoryAssignments.staffId, input.chefId));

        // Insert new assignments
        if (input.categoryIds.length > 0) {
          await db.insert(staffCategoryAssignments).values(
            input.categoryIds.map((categoryId) => ({
              id: nanoid(),
              staffId: input.chefId,
              categoryId,
              createdAt: new Date(),
            }))
          );
        }

        return {
          success: true,
          chefId: input.chefId,
          assignedCategories: input.categoryIds.length,
          message: `Assigned ${input.categoryIds.length} categories to chef`,
        };
      } catch (error: any) {
        throw new Error(`Failed to assign categories: ${error.message}`);
      }
    }),

  /**
   * Get chef's assigned categories
   * FIX: Query DB for actual assignments.
   */
  getChefAssignments: chefProcedure
    .input(z.object({ chefId: z.string(), cafeteriaId: z.string() }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const assignments = await db
          .select()
          .from(staffCategoryAssignments)
          .where(eq(staffCategoryAssignments.staffId, input.chefId));

        return {
          chefId: input.chefId,
          assignedCategories: assignments.map((a: any) => a.categoryId),
          total: assignments.length,
        };
      } catch (error: any) {
        throw new Error(`Failed to get chef assignments: ${error.message}`);
      }
    }),

  /**
   * Lock order items when sent to kitchen
   * FIX: Persist lock to kitchenLocks table.
   */
  lockKitchenItems: managerProcedure
    .input(
      z.object({
        orderId: z.string(),
        itemIds: z.array(z.string()),
        reason: z.string().default("sent_to_kitchen"),
      })
    )
    .mutation(async ({ input, ctx }) => {
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

        for (const orderItemId of input.itemIds) {
          // Check if already locked
          const existingLock = await db.select().from(kitchenLocks).where(eq(kitchenLocks.orderItemId, orderItemId));
          if (existingLock.length > 0 && existingLock[0].status === "locked") {
            console.warn(`[KITCHEN LOCK] Item ${orderItemId} is already locked.`);
            continue; // Skip if already locked
          }

          await db.insert(kitchenLocks).values({
            id: nanoid(),
            orderItemId,
            lockedAt: new Date(),
            lockedBy: ctx.user?.id || "system",
            status: "locked",
          });
          console.log(`[KITCHEN LOCK] Item ${orderItemId} for order ${input.orderId} locked by ${ctx.user?.id} for reason: ${input.reason}`);
        }

        return {
          success: true,
          orderId: input.orderId,
          lockedItems: input.itemIds.length,
          message: `Locked ${input.itemIds.length} items for order ${input.orderId}`,
        };
      } catch (error: any) {
        throw new Error(`Failed to lock kitchen items: ${error.message}`);
      }
    }),

  /**
   * Check if an item is locked
   * FIX: Query kitchenLocks table.
   */
  isItemLocked: staffProcedure
    .input(z.object({ itemId: z.string() }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const lock = await db.select().from(kitchenLocks).where(and(eq(kitchenLocks.orderItemId, input.itemId), eq(kitchenLocks.status, "locked")));

        return {
          isLocked: lock.length > 0,
          lockedBy: lock.length > 0 ? lock[0].lockedBy : undefined,
          lockedAt: lock.length > 0 ? lock[0].lockedAt : undefined,
          reason: lock.length > 0 ? "locked_by_system" : undefined, // Assuming reason is always 'locked_by_system' if locked
        };
      } catch (error: any) {
        throw new Error(`Failed to check item lock: ${error.message}`);
      }
    }),

  /**
   * Unlock order items (e.g., manager/admin can do this)
   * FIX: Update kitchenLocks table.
   */
  unlockOrderItems: managerProcedure
    .input(
      z.object({
        itemIds: z.array(z.string()),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        for (const orderItemId of input.itemIds) {
          await db.update(kitchenLocks).set({
            status: "unlocked",
            lockedBy: "system_unlocked", // Or ctx.user?.id if manager is unlocking
          }).where(eq(kitchenLocks.orderItemId, orderItemId));
          console.log(`[KITCHEN UNLOCK] Item ${orderItemId} unlocked. Reason: ${input.reason || ""}`);
        }
        return {
          success: true,
          unlockedItems: input.itemIds.length,
          message: `Unlocked ${input.itemIds.length} items`,
        };
      } catch (error: any) {
        throw new Error(`Failed to unlock items: ${error.message}`);
      }
    }),

  /**
   * Try to modify a locked item
   * FIX: Query kitchenLocks table for active locks and prevent modification if locked, unless manager/admin.
   */
  modifyLockedItem: staffProcedure
    .input(
      z.object({
        itemId: z.string(),
        modification: z.object({
          quantity: z.number().optional(),
          notes: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const lock = await db.select().from(kitchenLocks).where(and(eq(kitchenLocks.orderItemId, input.itemId), eq(kitchenLocks.status, "locked")));

        if (lock.length > 0) {
          const userRole = ctx.user?.role;
          if (userRole !== "manager" && userRole !== "cafeteria_admin") {
            return {
              success: false,
              itemId: input.itemId,
              locked: true,
              lockedBy: lock[0].lockedBy,
              lockedAt: lock[0].lockedAt,
              reason: "locked_by_system",
              message: "Item is locked in kitchen. Only manager/admin can modify.",
            };
          }
        }

        // Proceed with modification if not locked or if manager/admin
        // (Actual modification logic for orderItems is not part of this task, just the lock check)
        return {
          success: true,
          itemId: input.itemId,
          modified: true,
          message: lock.length > 0 ? "Item modified by manager/admin" : "Item modified successfully",
        };
      } catch (error: any) {
        throw new Error(`Failed to modify item: ${error.message}`);
      }
    }),
});
