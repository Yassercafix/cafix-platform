import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '../../shared/const.js';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context-supabase.js";
import { getDb } from "../db.js";
import { cafeteriaStaff, shifts } from "../../drizzle/schema.js";
import { eq, and } from "drizzle-orm";
import { hasActiveShift } from "../utils/shiftEngine.js";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

const requireActiveShift = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

  // For staff roles, we need to check the cafeteriaStaff table
  // The ctx.user.id for staff is the id from cafeteriaStaff table (based on context-supabase.ts)
  const staff = await db.select().from(cafeteriaStaff).where(eq(cafeteriaStaff.id, ctx.user.id)).limit(1);

  if (staff.length === 0) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Staff member not found or not assigned." });
  }

  const staffId = staff[0].id;

  const activeShifts = await db.select().from(shifts).where(and(eq(shifts.staffId, staffId), eq(shifts.status, "active")));

  if (!hasActiveShift(activeShifts)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Staff member must have an active shift to perform this operation." });
  }

  return next({
    ctx: {
      ...ctx,
      staffId: staffId, // Make staffId available in context for downstream procedures
    },
  });
});

export const staffProcedure = protectedProcedure.use(requireActiveShift);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'owner') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

export const ownerProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'owner') {
      throw new TRPCError({ code: "FORBIDDEN", message: "Owner access required." });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

export const marketerProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'marketer') {
      throw new TRPCError({ code: "FORBIDDEN", message: "Marketer access required." });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

/**
 * Procedure that allows both owner and marketer roles.
 * Used for operations like creating cafeterias where both roles should have access.
 */
export const ownerOrMarketerProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || (ctx.user.role !== 'owner' && ctx.user.role !== 'marketer')) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Owner or Marketer access required." });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

export const cafeteriaAdminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'cafeteria_admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: "Cafeteria Admin access required." });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
