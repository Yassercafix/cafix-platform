
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc.js";
import { nanoid } from "nanoid";
import { eq, and, gte, lte, desc, inArray } from "drizzle-orm";
import { getDb } from "../db.js";
import {
  cafeteriaReports,
  orders,
  orderItems,
  shifts,
  cafeterias,
  cafeteriaStaff,
} from "../../drizzle/schema.js";
import { getPlanContext, assertFeature } from "../utils/planGuard.js";
import {
  generateCafeteriaReport,
  calculateTotalSales,
  calculateTotalItemsSold,
  calculateAverageOrderValue,
  getTopSellingItems,
  getTopPerformingStaff,
  calculatePeakHours,
  compareReports,
  validateReportParameters,
} from "../utils/reportingEngine.js";

// Helper to check if a user has access to a cafeteria
async function checkCafeteriaAccess(db: any, userId: string, cafeteriaId: string) {
    const staffRecord = await db
        .select()
        .from(cafeteriaStaff)
        .where(and(eq(cafeteriaStaff.id, userId), eq(cafeteriaStaff.cafeteriaId, cafeteriaId)))
        .limit(1);
    return staffRecord.length > 0;
}

export const reportingRouter = router({
  generateDailyReport: protectedProcedure
    .input(
      z.object({
        cafeteriaId: z.string(),
        reportDate: z.date(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      if (ctx.user.role !== 'owner' && !(await checkCafeteriaAccess(db, ctx.user.id, input.cafeteriaId))) {
          throw new Error("Unauthorized access to cafeteria data");
      }

      // Enforce plan limits for reporting
      const planContext = await getPlanContext(input.cafeteriaId);
      assertFeature(
        planContext, 
        "premiumReports", 
        `Daily reporting is a premium feature. Your current ${planContext.plan} plan does not support this.`
      );

      const startOfDay = new Date(input.reportDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(input.reportDate);
      endOfDay.setHours(23, 59, 59, 999);

      const ordersInCafeteria = await db.select({ id: orders.id }).from(orders).where(eq(orders.cafeteriaId, input.cafeteriaId));
      const orderIds = ordersInCafeteria.map((o: any) => o.id);

      const ordersData = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.cafeteriaId, input.cafeteriaId),
            gte(orders.paidAt, startOfDay),
            lte(orders.paidAt, endOfDay),
            eq(orders.status, "paid")
          )
        );

      const itemsData = orderIds.length > 0 ? await db
        .select()
        .from(orderItems)
        .where(
          and(
            eq(orderItems.status, "paid"),
            gte(orderItems.paidAt, startOfDay),
            lte(orderItems.paidAt, endOfDay),
            (orderIds.length > 0 ? inArray(orderItems.orderId, orderIds) : undefined)
          )
        ) : [];

      const shiftsData = await db
        .select()
        .from(shifts)
        .where(
          and(
            eq(shifts.cafeteriaId, input.cafeteriaId),
            gte(shifts.startTime, startOfDay),
            lte(shifts.startTime, endOfDay)
          )
        );

      const totalSales = calculateTotalSales(ordersData);
      const totalOrders = ordersData.length;
      const totalItemsSold = calculateTotalItemsSold(itemsData);
      const totalPointsDeducted = ordersData.reduce(
        (sum: any, order: any) => sum + (Number(order.pointsConsumed) || 0),
        0
      );
      const averageOrderValue = calculateAverageOrderValue(totalSales, totalOrders);

      const reportId = nanoid();
      const now = new Date();

      await db.insert(cafeteriaReports).values({
        id: reportId,
        cafeteriaId: input.cafeteriaId,
        reportType: "daily",
        reportDate: input.reportDate,
        totalSales: String(totalSales),
        totalOrders,
        totalItemsSold,
        totalPointsDeducted: String(totalPointsDeducted),
        averageOrderValue: String(averageOrderValue),
        generatedAt: now,
      });

      return {
        id: reportId,
        cafeteriaId: input.cafeteriaId,
        reportType: "daily",
        reportDate: input.reportDate,
        totalSales,
        totalOrders,
        totalItemsSold,
        totalPointsDeducted,
        averageOrderValue,
        topItems: getTopSellingItems(itemsData, 5),
        topStaff: getTopPerformingStaff(shiftsData, 5),
        peakHours: calculatePeakHours(ordersData),
      };
    }),

  getReport: protectedProcedure
    .input(z.object({ reportId: z.string() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const reportResult = await db
        .select()
        .from(cafeteriaReports)
        .where(eq(cafeteriaReports.id, input.reportId));

      if (reportResult.length === 0) {
        throw new Error("Report not found");
      }

      const report = reportResult[0];

      if (ctx.user.role !== 'owner' && !(await checkCafeteriaAccess(db, ctx.user.id, report.cafeteriaId))) {
        throw new Error("Unauthorized access to report");
      }

      return {
        id: report.id,
        cafeteriaId: report.cafeteriaId,
        reportType: report.reportType,
        reportDate: report.reportDate,
        totalSales: Number(report.totalSales) || 0,
        totalOrders: report.totalOrders || 0,
        totalItemsSold: report.totalItemsSold || 0,
        totalPointsDeducted: Number(report.totalPointsDeducted) || 0,
        averageOrderValue: Number(report.averageOrderValue) || 0,
        generatedAt: report.generatedAt,
      };
    }),

  getCafeteriaReports: protectedProcedure
    .input(
      z.object({
        cafeteriaId: z.string(),
        reportType: z.enum(["daily", "weekly", "monthly"]).optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      if (ctx.user.role !== 'owner' && !(await checkCafeteriaAccess(db, ctx.user.id, input.cafeteriaId))) {
        throw new Error("Unauthorized access to cafeteria reports");
      }

      const conditions = [eq(cafeteriaReports.cafeteriaId, input.cafeteriaId)];

      if (input.reportType) {
        conditions.push(eq(cafeteriaReports.reportType, input.reportType));
      }

      if (input.startDate) {
        conditions.push(gte(cafeteriaReports.reportDate, input.startDate));
      }

      if (input.endDate) {
        conditions.push(lte(cafeteriaReports.reportDate, input.endDate));
      }

      const result = await db
        .select()
        .from(cafeteriaReports)
        .where(and(...conditions));

      return result.map((report: any) => ({
        id: report.id,
        reportType: report.reportType,
        reportDate: report.reportDate,
        totalSales: Number(report.totalSales) || 0,
        totalOrders: report.totalOrders || 0,
        totalItemsSold: report.totalItemsSold || 0,
        totalPointsDeducted: Number(report.totalPointsDeducted) || 0,
        averageOrderValue: Number(report.averageOrderValue) || 0,
        generatedAt: report.generatedAt,
      }));
    }),

  getTopItemsReport: protectedProcedure
    .input(z.object({ cafeteriaId: z.string(), startDate: z.date().optional(), endDate: z.date().optional(), limit: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const itemsData = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.status, "served"));

      return getTopSellingItems(itemsData, input.limit || 5);
    }),

  getTopStaffReport: protectedProcedure
    .input(z.object({ cafeteriaId: z.string(), startDate: z.date().optional(), endDate: z.date().optional(), limit: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const shiftsData = await db
        .select()
        .from(shifts)
        .where(eq(shifts.cafeteriaId, input.cafeteriaId));

      return getTopPerformingStaff(shiftsData, input.limit || 5);
    }),

  getSalesComparison: protectedProcedure
    .input(z.object({ cafeteriaId: z.string(), startDate: z.date(), endDate: z.date() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const ordersData = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.cafeteriaId, input.cafeteriaId),
            gte(orders.paidAt, input.startDate),
            lte(orders.paidAt, input.endDate),
            eq(orders.status, "paid")
          )
        );

      const totalSales = calculateTotalSales(ordersData);
      const totalOrders = ordersData.length;
      const totalPointsDeducted = ordersData.reduce(
        (sum: any, order: any) => sum + (Number(order.pointsConsumed) || 0),
        0
      );

      return {
        totalSales,
        totalOrders,
        totalItemsSold: 0, // Placeholder as we don't have items here yet, but the client expects it
        totalPointsDeducted,
        averageOrderValue: calculateAverageOrderValue(totalSales, totalOrders),
      };
    }),

  getCafeteriaStats: protectedProcedure
    .input(z.object({ cafeteriaId: z.string(), period: z.enum(["daily", "weekly", "monthly"]) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Enforce plan limits for reporting
      const planContext = await getPlanContext(input.cafeteriaId);
      assertFeature(
        planContext, 
        "premiumReports", 
        `Cafeteria statistics is a premium feature. Your current ${planContext.plan} plan does not support this.`
      );

      const now = new Date();
      let startDate = new Date();
      if (input.period === "daily") startDate.setHours(0, 0, 0, 0);
      else if (input.period === "weekly") startDate.setDate(now.getDate() - 7);
      else if (input.period === "monthly") startDate.setMonth(now.getMonth() - 1);

      const ordersData = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.cafeteriaId, input.cafeteriaId),
            gte(orders.paidAt, startDate),
            eq(orders.status, "paid")
          )
        );

      const totalSales = calculateTotalSales(ordersData);
      const totalOrders = ordersData.length;
      const totalPointsDeducted = ordersData.reduce((sum: any, o: any) => sum + (Number(o.pointsConsumed) || 0), 0);
      const averageOrderValue = calculateAverageOrderValue(totalSales, totalOrders);

      // Get active staff count
      const activeStaff = await db
        .select()
        .from(cafeteriaStaff)
        .where(and(eq(cafeteriaStaff.cafeteriaId, input.cafeteriaId), eq(cafeteriaStaff.status, "active")));

      return {
        totalSales,
        totalOrders,
        totalPointsDeducted,
        averageOrderValue,
        activeStaffCount: activeStaff.length,
      };
    }),

  getStaffPerformance: protectedProcedure
    .input(z.object({ cafeteriaId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Enforce plan limits for reporting
      const planContext = await getPlanContext(input.cafeteriaId);
      assertFeature(
        planContext, 
        "premiumReports", 
        `Staff performance reporting is a premium feature. Your current ${planContext.plan} plan does not support this.`
      );

      const staffList = await db
        .select()
        .from(cafeteriaStaff)
        .where(eq(cafeteriaStaff.cafeteriaId, input.cafeteriaId));

      const performance = await Promise.all(staffList.map(async (staff: any) => {
        const staffShifts = await db
          .select()
          .from(shifts)
          .where(eq(shifts.staffId, staff.id));

        const totalSales = staffShifts.reduce((sum: any, s: any) => sum + (Number(s.totalSales) || 0), 0);
        const totalOrders = staffShifts.reduce((sum: any, s: any) => sum + (s.totalOrders || 0), 0);
        const totalItemsSold = staffShifts.reduce((sum: any, s: any) => sum + (s.totalItemsSold || 0), 0);
        
        let totalHours = 0;
        staffShifts.forEach((s: any) => {
          if (s.startTime && s.endTime) {
            totalHours += (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / (1000 * 60 * 60);
          }
        });

        return {
          staffId: staff.id,
          name: staff.name,
          role: staff.role,
          totalSales,
          totalOrders,
          totalItemsSold,
          totalHoursWorked: Number(totalHours.toFixed(2)),
          averageOrderValue: totalOrders > 0 ? Number((totalSales / totalOrders).toFixed(2)) : 0,
        };
      }));

      return performance.sort((a, b) => b.totalSales - a.totalSales);
    }),
});
