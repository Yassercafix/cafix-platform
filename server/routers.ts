import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies.js";
import { systemRouter as coreSystemRouter } from "./_core/systemRouter.js";
import { publicProcedure, router } from "./_core/trpc.js";
import { ordersRouter } from "./routers/orders.js";
import { systemRouter } from "./routers/system.js";
import { shiftsRouter } from "./routers/shifts.js";
import { reportingRouter } from "./routers/reporting.js";
import { menuRouter } from "./routers/menu.js";
import { tablesRouter } from "./routers/tables.js";
import { rechargesRouter } from "./routers/recharges.js";
import { staffRouter } from "./routers/staff.js";
import { withdrawalsRouter } from "./routers/withdrawals.js";
import { qrOrdersRouter } from "./routers/qr-orders.js";
import { marketersRouter } from "./routers/marketers.js";
import { commissionsRouter } from "./routers/commissions.js";
import { cafeteriasRouter } from "./routers/cafeterias.js";
import { authRouter } from "./routers/auth.js";
import { authSupabaseRouter } from "./routers/auth-supabase.js";
import { splitBillRouter } from "./routers/splitBill.js";
import { waiterEscalationRouter } from "./routers/waiterEscalation.js";
import { chefRoutingRouter } from "./routers/chefRouting.js";
import { realtimeUpdatesRouter } from "./routers/realtimeUpdates.js";
import { billingRouter } from "./routers/billing.js";
import { reportsRouter } from "./routers/reports.js";
import { ordersPhase2Router } from "./routers/orders-phase2.js";
import { splitBillPhase2Router } from "./routers/splitBill-phase2.js";
import { serviceRequestsRouter } from "./routers/serviceRequests.js";
import { paymentsRouter } from "./routers/payments.js";
import { businessReportingRouter } from "./routers/business-reporting.js";
import { pointsManagementRouter } from "./routers/points-management.js";
import { commissionManagementRouter } from "./routers/commission-management.js";
import { withdrawalManagementRouter } from "./routers/withdrawal-management.js";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  coreSystem: coreSystemRouter,
  auth: authRouter,
  authSupabase: authSupabaseRouter,

  orders: ordersRouter,
  ordersPhase2: ordersPhase2Router,
  shifts: shiftsRouter,
  reporting: reportingRouter,
  menu: menuRouter,
  tables: tablesRouter,
  cafeterias: cafeteriasRouter,
  recharges: rechargesRouter,
  staff: staffRouter,
  withdrawals: withdrawalsRouter,
  qrOrders: qrOrdersRouter,
  marketers: marketersRouter,
  commissions: commissionsRouter,

  // Reports
  reports: reportsRouter,

  // Service Requests
  serviceRequests: serviceRequestsRouter,

  // V6 Features
  splitBill: splitBillRouter,
  splitBillPhase2: splitBillPhase2Router,
  waiterEscalation: waiterEscalationRouter,
  chefRouting: chefRoutingRouter,
  realtimeUpdates: realtimeUpdatesRouter,
  billing: billingRouter,

  // Payments & Business
  payments: paymentsRouter,
  businessReporting: businessReportingRouter,
  pointsManagement: pointsManagementRouter,
  commissionManagement: commissionManagementRouter,
  withdrawalManagement: withdrawalManagementRouter,
});

export type AppRouter = typeof appRouter;
