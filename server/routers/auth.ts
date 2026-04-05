import { z } from "zod";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "../_core/trpc.js";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { getDb } from "../db.js";
import { users, marketers, cafeterias, cafeteriaStaff } from "../../drizzle/schema.js";
import bcryptjs from "bcryptjs";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import { getSessionCookieOptions } from "../_core/cookies.js";
import { sdk } from "../_core/sdk.js";
import * as cookieModule from "cookie";
const cookie = cookieModule as any;

const SALT_ROUNDS = 10;

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(password, hash);
}

function mapStaffRole(staffRole: string): string {
  return staffRole;
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

export const authRouter = router({
  login: publicProcedure
    .input(
      z.object({
        email: z.string().min(1),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });
        }

        const identifier = input.email.trim();

        // USERS
        let userRow =
          (await db.select().from(users).where(eq(users.loginUsername, identifier)))[0] ||
          (await db.select().from(users).where(eq(users.email, identifier)))[0];

        if (userRow && userRow.passwordHash) {
          const isValid = await verifyPassword(input.password, userRow.passwordHash);
          if (!isValid) throw new TRPCError({ code: "UNAUTHORIZED" });

          const role = userRow.role === "owner" ? "owner" : "cafeteria_admin";

          const sessionToken = await sdk.createSessionToken(userRow.openId, {
            name: userRow.name || "",
            expiresInMs: ONE_YEAR_MS,
          });

          setCookie(ctx, sessionToken);

          return {
            success: true,
            role,
            name: userRow.name,
            referenceCode: userRow.referenceCode ?? null,
          };
        }

        // MARKETER
        let marketerRow =
          (await db.select().from(marketers).where(eq(marketers.loginUsername, identifier)))[0] ||
          (await db.select().from(marketers).where(eq(marketers.email, identifier)))[0];

        if (marketerRow && marketerRow.passwordHash) {
          const isValid = await verifyPassword(input.password, marketerRow.passwordHash);
          if (!isValid) throw new TRPCError({ code: "UNAUTHORIZED" });

          const sessionToken = await sdk.createSessionToken(`marketer_${marketerRow.id}`, {
            name: marketerRow.name,
            expiresInMs: ONE_YEAR_MS,
          });

          setCookie(ctx, sessionToken);

          return {
            success: true,
            role: "marketer",
            name: marketerRow.name,
            referenceCode: marketerRow.referenceCode ?? null,
          };
        }

        // CAFETERIA
        const cafeteriaRow =
          (await db.select().from(cafeterias).where(eq(cafeterias.loginUsername, identifier)))[0];

        if (cafeteriaRow && cafeteriaRow.passwordHash) {
          const isValid = await verifyPassword(input.password, cafeteriaRow.passwordHash);
          if (!isValid) throw new TRPCError({ code: "UNAUTHORIZED" });

          const sessionToken = await sdk.createSessionToken(`cafeteria_${cafeteriaRow.id}`, {
            name: cafeteriaRow.name,
            expiresInMs: ONE_YEAR_MS,
          });

          setCookie(ctx, sessionToken);

          return {
            success: true,
            role: "cafeteria_admin",
            name: cafeteriaRow.name,
            referenceCode: cafeteriaRow.referenceCode ?? null,
          };
        }

        // STAFF
        const staffRow =
          (await db.select().from(cafeteriaStaff).where(eq(cafeteriaStaff.loginUsername, identifier)))[0];

        if (staffRow && staffRow.passwordHash) {
          const isValid = await verifyPassword(input.password, staffRow.passwordHash);
          if (!isValid) throw new TRPCError({ code: "UNAUTHORIZED" });

          const sessionToken = await sdk.createSessionToken(`staff_${staffRow.id}`, {
            name: staffRow.name,
            expiresInMs: ONE_YEAR_MS,
          });

          setCookie(ctx, sessionToken);

          return {
            success: true,
            role: mapStaffRole(staffRow.role ?? "manager"),
            name: staffRow.name,
            referenceCode: null,
          };
        }

        throw new TRPCError({ code: "UNAUTHORIZED" });

      } catch (error) {
        if (error instanceof TRPCError) throw error;

         console.error("[auth.login ERROR]:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred. Please try again.",
        });
      }
    }),
  changePassword: protectedProcedure
    .input(
      z.object({
        oldPassword: z.string().min(1),
        newPassword: z.string().min(8),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }
      const userId = ctx.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      const userRow = await db.query.users.findFirst({ where: eq(users.id, userId) });
      if (!userRow || !userRow.passwordHash) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }
      const isValid = await verifyPassword(input.oldPassword, userRow.passwordHash);
      if (!isValid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect" });
      }
      const newHash = await bcryptjs.hash(input.newPassword, SALT_ROUNDS);
      await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, userId));
      return { success: true };
    }),
});
