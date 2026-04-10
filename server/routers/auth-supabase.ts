import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc.js";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { getDb } from "../db.js";
import { users, marketers, cafeterias, cafeteriaStaff } from "../../drizzle/schema.js";
import { createClient } from "@supabase/supabase-js";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import { getSessionCookieOptions } from "../_core/cookies.js";
import * as cookieModule from "cookie";
const cookie = cookieModule as any;
import bcryptjs from "bcryptjs";

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("[Supabase Auth] ERROR: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured");
}

let supabase: any = null;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function setCookie(ctx: any, sessionToken: string) {
  const cookieOptions = getSessionCookieOptions(ctx.req);

  const cookieStr = cookie.serialize(
    COOKIE_NAME,
    sessionToken,
    {
      ...cookieOptions,
      maxAge: ONE_YEAR_MS / 1000,
    }
  );

  ctx.res.setHeader("Set-Cookie", cookieStr);
}

/**
 * Map database role to Supabase auth metadata role
 */
function mapDbRoleToAuthRole(dbRole: string): string {
  switch (dbRole) {
    case "owner":
      return "owner";
    case "marketer":
      return "marketer";
    case "cafeteria_admin":
      return "cafeteria_admin";
    case "manager":
      return "manager";
    case "waiter":
      return "waiter";
    case "chef":
      return "chef";
    default:
      return "user";
  }
}

/**
 * Determine user role based on which table they exist in
 */
async function determineUserRole(
  email: string,
  db: any
): Promise<{ role: string; userId: string; entityId?: string }> {
  // Check users table (owner)
  const userRow = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (userRow.length > 0) {
    return {
      role: userRow[0].role || "owner",
      userId: userRow[0].id,
      entityId: userRow[0].marketerId || userRow[0].cafeteriaId || userRow[0].id,
    };
  }

  // Check marketers table
  const marketerRow = await db
    .select()
    .from(marketers)
    .where(eq(marketers.email, email))
    .limit(1);

  if (marketerRow.length > 0) {
    return {
      role: "marketer",
      userId: marketerRow[0].id,
      entityId: marketerRow[0].id,
    };
  }

  // Check cafeterias table
  const cafeteriaRow = await db
    .select()
    .from(cafeterias)
    .where(eq(cafeterias.loginUsername, email))
    .limit(1);

  if (cafeteriaRow.length > 0) {
    return {
      role: "cafeteria_admin",
      userId: cafeteriaRow[0].id,
      entityId: cafeteriaRow[0].id,
    };
  }

  // Check cafeteria staff table
  const staffRow = await db
    .select()
    .from(cafeteriaStaff)
    .where(eq(cafeteriaStaff.loginUsername, email))
    .limit(1);

  if (staffRow.length > 0) {
    return {
      role: staffRow[0].role || "waiter",
      userId: staffRow[0].id,
      entityId: staffRow[0].id,
    };
  }

  throw new TRPCError({
    code: "NOT_FOUND",
    message: "User not found in any table",
  });
}

export const authSupabaseRouter = router({
  /**
   * Login with email and password via Supabase Auth
   */
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        console.log("[LOGIN ATTEMPT]", input.email);
        
        if (!supabase) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Supabase is not configured. Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.",
          });
        }

        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });
        }

        // Sign in with Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
          email: input.email,
          password: input.password,
        });

        if (error || !data.session) {
          console.log("[LOGIN FAILED]", input.email, error?.message);
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: error?.message || "Invalid email or password",
          });
        }
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });
        }

        // Determine user role from database
        const roleInfo = await determineUserRole(input.email, db);

        // Set session cookie
        setCookie(ctx, data.session.access_token);

        return {
          success: true,
          role: roleInfo.role,
          userId: roleInfo.userId,
          email: input.email,
          sessionToken: data.session.access_token,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error("[auth-supabase.login ERROR]:", error);

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred. Please try again.",
        });
      }
    }),

  /**
   * Create a new account (parent-only, no self-signup)
   * This is called by parent when creating child accounts
   */
  createAccount: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(1),
        role: z.enum(["marketer", "cafeteria_admin", "manager", "waiter", "chef"]),
        parentId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Only allow parent/admin to create accounts
        if (!ctx.user || (ctx.user.role !== "owner" && ctx.user.role !== "marketer")) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only parents can create child accounts",
          });
        }

        // Create Supabase Auth account
        const { data, error } = await supabase.auth.admin.createUser({
          email: input.email,
          password: input.password,
          email_confirm: true,
          user_metadata: {
            name: input.name,
            role: input.role,
          },
        });

        if (error || !data.user) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error?.message || "Failed to create Supabase Auth user",
          });
        }

        // Account created successfully
        return {
          success: true,
          userId: data.user.id,
          email: input.email,
          role: input.role,
          message: "Account created successfully. User can now login.",
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error("[auth-supabase.createAccount ERROR]:", error);

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create account",
        });
      }
    }),

  /**
   * Get current user info
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    try {
      if (!ctx.user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      // Get user details based on role
      let userData: any = null;

      if (ctx.user.role === "owner") {
        const userRow = await db
          .select()
          .from(users)
          .where(eq(users.id, ctx.user.id))
          .limit(1);
        userData = userRow[0];
      } else if (ctx.user.role === "marketer") {
        const marketerRow = await db
          .select()
          .from(marketers)
          .where(eq(marketers.id, ctx.user.id))
          .limit(1);
        userData = marketerRow[0];
      } else if (ctx.user.role === "cafeteria_admin") {
        // First try to find cafeteria by id (ctx.user.id may already be cafeteria.id)
        let cafeteriaRow = await db
          .select()
          .from(cafeterias)
          .where(eq(cafeterias.id, ctx.user.id))
          .limit(1);
        // If not found by id, try by loginUsername (email) — this handles the case
        // where ctx.user.id is a users.id (UUID) rather than cafeterias.id (nanoid)
        if (cafeteriaRow.length === 0 && ctx.user.email) {
          cafeteriaRow = await db
            .select()
            .from(cafeterias)
            .where(eq(cafeterias.loginUsername, ctx.user.email))
            .limit(1);
        }
        userData = cafeteriaRow[0];
      } else {
        const staffRow = await db
          .select()
          .from(cafeteriaStaff)
          .where(eq(cafeteriaStaff.id, ctx.user.id))
          .limit(1);
        userData = staffRow[0];
      }

      // For cafeteria_admin, the cafeteriaId IS the cafeteria's own id (userData.id)
      // because the cafeterias table does not have a separate cafeteriaId column.
      // For staff, cafeteriaId comes from cafeteriaStaff.cafeteriaId.
      const resolvedCafeteriaId =
        ctx.user.role === 'cafeteria_admin'
          ? (userData?.id ?? null)
          : (userData?.cafeteriaId ?? null);

      return {
        id: ctx.user.id,
        role: ctx.user.role,
        name: userData?.name,
        email: userData?.email || userData?.loginUsername,
        referenceCode: userData?.referenceCode,
        cafeteriaId: resolvedCafeteriaId,
        marketerId: ctx.user.role === 'marketer' ? ctx.user.id : userData?.marketerId,
        parentId: userData?.parentId,
        country: userData?.country,
        currency: userData?.currency,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      console.error("[auth-supabase.me ERROR]:", error);

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch user info",
      });
    }
  }),

  /**
   * Logout
   */
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      // Sign out from Supabase
      await supabase.auth.signOut();

      // Clear session cookie
      const cookieStr = cookie.serialize(COOKIE_NAME, "", {
        maxAge: 0,
        path: "/",
      });

      ctx.res.setHeader("Set-Cookie", cookieStr);

      return {
        success: true,
        message: "Logged out successfully",
      };
    } catch (error) {
      console.error("[auth-supabase.logout ERROR]:", error);

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to logout",
      });
    }
  }),
});
