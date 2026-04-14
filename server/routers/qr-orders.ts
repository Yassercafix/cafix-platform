import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc.js";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { getDb } from "../db.js";
import { cafeteriaTables, orders, orderItems, menuItems, menuCategories, cafeterias } from "../../drizzle/schema.js";
import { and, inArray } from "drizzle-orm";
import { logger } from "../utils/logger.js";

/**
 * QR Table Ordering Router
 * Public endpoints for customer QR-based ordering
 */
export const qrOrdersRouter = router({
  /**
   * Resolve table by token (public endpoint)
   * Returns table details if token is valid
   */
  resolveTableByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const table = await db
        .select()
        .from(cafeteriaTables)
        .where(eq(cafeteriaTables.tableToken, input.token));

      if (!table || table.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid table token",
        });
      }

      const tableData = table[0];
      // Fetch cafeteria name
      let cafeteriaName: string | null = null;
      try {
        const cafResult = await db.select({ name: cafeterias.name }).from(cafeterias).where(eq(cafeterias.id, tableData.cafeteriaId));
        cafeteriaName = cafResult[0]?.name ?? null;
      } catch (_) {}
      return {
        id: tableData.id,
        tableNumber: tableData.tableNumber,
        capacity: tableData.capacity,
        cafeteriaId: tableData.cafeteriaId,
        sectionId: tableData.sectionId,
        status: tableData.status,
        cafeteriaName,
      };
    }),

  /**
   * Get menu items for a table by token (public endpoint)
   * Resolves token → cafeteriaId → menu items
   * This is the public version of menu.getMenuItems for customer QR pages
   */
  getMenuForTable: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      // Step 1: Resolve table from token
      const tableResult = await db
        .select()
        .from(cafeteriaTables)
        .where(eq(cafeteriaTables.tableToken, input.token));

      if (!tableResult || tableResult.length === 0) {
        logger.warn("GET_MENU_ERROR", "Invalid table token", { token: input.token });
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid table token",
        });
      }

      const table = tableResult[0];
      const cafeteriaId = table.cafeteriaId;

      // Step 2: Get categories for this cafeteria
      const categories = await db
        .select()
        .from(menuCategories)
        .where(eq(menuCategories.cafeteriaId, cafeteriaId));

      if (categories.length === 0) {
        return [];
      }

      const categoryIds = categories.map((c: any) => c.id);

      // Step 3: Get menu items for these categories
      const items = await db
        .select()
        .from(menuItems)
        .where(inArray(menuItems.categoryId, categoryIds));

      return items.map((item: any) => ({
        id: item.id,
        categoryId: item.categoryId,
        name: item.name,
        description: item.description,
        price: Number(item.price) || 0,
        imageUrl: item.imageUrl,
        available: item.available,
        createdAt: item.createdAt,
      }));
    }),

  /**
   * Create customer order from QR scan
   * Links order to table and marks source as "customer"
   */
  createCustomerOrder: publicProcedure
    .input(
      z.object({
        token: z.string(),
        items: z.array(
          z.object({
            menuItemId: z.string(),
            quantity: z.number().positive(),
            notes: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Resolve table from token
        const tableResult = await db
          .select()
          .from(cafeteriaTables)
          .where(eq(cafeteriaTables.tableToken, input.token));

        if (!tableResult || tableResult.length === 0) {
          logger.warn("ORDER_SUBMISSION_ERROR", "Invalid table token used", { token: input.token });
          throw new Error("Invalid table token");
        }

        const table = tableResult[0];
        const cafeteriaId = table.cafeteriaId;
        
        if (!cafeteriaId) {
          throw new Error("Table is not linked to any cafeteria");
        }

        const now = new Date();
        
        // Find existing open order for this table to maintain one session per table
        // We use "pending" as the initial active status
        const existingOpenOrders = await db
          .select()
          .from(orders)
          .where(
            and(
              eq(orders.tableId, table.id),
              inArray(orders.status, ["pending"])
            )
          )
          .limit(1);
        
        let orderId: string;
        let isNewOrder = false;
        
        if (existingOpenOrders.length > 0) {
          orderId = existingOpenOrders[0].id;
        } else {
          orderId = nanoid();
          isNewOrder = true;
        }

        // Calculate total amount from menu items
        let totalAmount = 0;
        const itemsWithPrices = [];
        for (const item of input.items) {
          const menuItemResult = await db
            .select()
            .from(menuItems)
            .where(eq(menuItems.id, item.menuItemId));
          
          if (!menuItemResult || menuItemResult.length === 0) {
            throw new Error(`Menu item ${item.menuItemId} not found`);
          }
          
          const menuItem = menuItemResult[0];
          const price = parseFloat(menuItem.price || "0");
          const itemTotal = price * item.quantity;
          totalAmount += itemTotal;
          itemsWithPrices.push({
            ...item,
            price,
            itemTotal,
          });
        }

        if (isNewOrder) {
          // Create new order session for the table
          await db.insert(orders).values({
            id: orderId,
            cafeteriaId: cafeteriaId,
            tableId: table.id,
            totalAmount: totalAmount.toFixed(2),
            status: "pending",
            source: "customer",
            pointsConsumed: "0.00",
            createdAt: now,
          });
        } else {
          // Update existing order session total
          const currentTotal = parseFloat(existingOpenOrders[0].totalAmount || "0");
          await db
            .update(orders)
            .set({
              totalAmount: (currentTotal + totalAmount).toFixed(2),
              status: "pending", // Keep it pending/active
            })
            .where(eq(orders.id, orderId));
        }

        // Add order items
        for (const item of itemsWithPrices) {
          const orderItemId = nanoid();
          await db.insert(orderItems).values({
            id: orderItemId,
            orderId,
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            unitPrice: item.price.toFixed(2),
            totalPrice: item.itemTotal.toFixed(2),
            status: "pending",
            notes: item.notes || null,
            createdAt: now,
          });
        }

        // Update table status to occupied
        await db
          .update(cafeteriaTables)
          .set({ status: "occupied" })
          .where(eq(cafeteriaTables.id, table.id));

        logger.info("ORDER_CREATED", `Customer order ${orderId} created for Table ${table.tableNumber}`, { orderId, tableId: table.id });

        return {
          orderId,
          tableId: table.id,
          tableNumber: table.tableNumber,
          totalAmount,
          itemCount: input.items.length,
          status: "pending",
          createdAt: now,
        };
      } catch (error: any) {
        logger.error("ORDER_SUBMISSION_ERROR", error.message, { input });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to submit order. Please try again.",
          cause: error,
        });
      }
    }),

  /**
   * Get customer order details (public endpoint)
   */
  getCustomerOrder: publicProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const orderResult = await db
        .select({
          id: orders.id,
          cafeteriaId: orders.cafeteriaId,
          tableId: orders.tableId,
          totalAmount: orders.totalAmount,
          status: orders.status,
          source: orders.source,
          createdAt: orders.createdAt,
          cafeteriaName: cafeterias.name,
        })
        .from(orders)
        .leftJoin(cafeterias, eq(orders.cafeteriaId, cafeterias.id))
        .where(eq(orders.id, input.orderId));

      if (!orderResult || orderResult.length === 0) {
        throw new Error("Order not found");
      }

      const order = orderResult[0];

      // Get order items with names
      const items = await db
        .select({
          id: orderItems.id,
          menuItemId: orderItems.menuItemId,
          quantity: orderItems.quantity,
          unitPrice: orderItems.unitPrice,
          totalPrice: orderItems.totalPrice,
          status: orderItems.status,
          notes: orderItems.notes,
          name: menuItems.name,
        })
        .from(orderItems)
        .leftJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
        .where(eq(orderItems.orderId, input.orderId));

      return {
        id: order.id,
        tableId: order.tableId,
        cafeteriaId: order.cafeteriaId,
        cafeteriaName: order.cafeteriaName || null,
        totalAmount: order.totalAmount,
        status: order.status,
        source: order.source,
        items: items.map((item: any) => ({
          id: item.id,
          menuItemId: item.menuItemId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          status: item.status,
          notes: item.notes,
        })),
        createdAt: order.createdAt,
      };
    }),
});
