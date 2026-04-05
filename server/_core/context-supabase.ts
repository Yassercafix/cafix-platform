import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookieHeader } from "cookie";
import { jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { getDb } from "../db.js";
import { users, marketers, cafeterias, cafeteriaStaff } from "../../drizzle/schema.js";
import { COOKIE_NAME } from "../../shared/const.js";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: {
    id: string;
    role: string;
    email: string;
    name?: string;
    referenceCode?: string;
  } | null;
};

/**
 * Verify Supabase JWT token and extract user info
 */
async function verifySupabaseToken(token: string): Promise<any> {
  try {
    // Get Supabase JWT secret for verification
    const secret = new TextEncoder().encode(
      process.env.SUPABASE_JWT_SECRET || ""
    );

    const verified = await jwtVerify(token, secret);
    return verified.payload;
  } catch (error) {
    console.error("[context] JWT verification failed:", error);
    return null;
  }
}

/**
 * Determine user role and get user data from database
 */
async function getUserFromDatabase(
  email: string,
  supabaseUserId: string,
  db: any
): Promise<any> {
  // Check users table (owner)
  const userRow = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (userRow.length > 0) {
    return {
      id: userRow[0].id,
      role: userRow[0].role || "owner",
      email: userRow[0].email,
      name: userRow[0].name,
      referenceCode: userRow[0].referenceCode,
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
      id: marketerRow[0].id,
      role: "marketer",
      email: marketerRow[0].email,
      name: marketerRow[0].name,
      referenceCode: marketerRow[0].referenceCode,
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
      id: cafeteriaRow[0].id,
      role: "cafeteria_admin",
      email: cafeteriaRow[0].loginUsername,
      name: cafeteriaRow[0].name,
      referenceCode: cafeteriaRow[0].referenceCode,
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
      id: staffRow[0].id,
      role: staffRow[0].role || "waiter",
      email: staffRow[0].loginUsername,
      name: staffRow[0].name,
    };
  }

  return null;
}

/**
 * Create tRPC context with Supabase Auth
 */
export async function createContextSupabase(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user = null;

  try {
    // Extract session token from cookie or Authorization header
    const cookieHeader = opts.req.headers.cookie || "";
    const cookies = parseCookieHeader(cookieHeader);
    let sessionToken = cookies[COOKIE_NAME];

    if (!sessionToken && opts.req.headers.authorization) {
      sessionToken = opts.req.headers.authorization.split(" ")[1];
    }

    if (!sessionToken) {
      // No session token, user is not authenticated
      return {
        req: opts.req,
        res: opts.res,
        user: null,
      };
    }

    // Get database connection
    const db = await getDb();
    if (!db) {
      console.error("[context] Database not available");
      return { req: opts.req, res: opts.res, user: null };
    }

    // Verify the Supabase JWT token
    const payload = await verifySupabaseToken(sessionToken);
    if (!payload || !payload.email) {
      return { req: opts.req, res: opts.res, user: null };
    }
    const email = payload.email;
    const sub = payload.sub;

    // Get user data from database
    user = await getUserFromDatabase(email, sub, db);

    if (!user) {
      // User not found in database
      console.warn(`[context] User ${email} not found in database`);
      return {
        req: opts.req,
        res: opts.res,
        user: null,
      };
    }
  } catch (error) {
    // Authentication is optional for public procedures
    console.error("[context] Authentication error:", error);
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
