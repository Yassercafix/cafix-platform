import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookieHeader } from "cookie";
import { jwtVerify, importJWK, createRemoteJWKSet, type KeyLike } from "jose";
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
    cafeteriaId?: string | null;
  } | null;
};

// ── Supabase project configuration ───────────────────────────────────────────
const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://ztamzcpkegijqcgbgtnn.supabase.co";

// ── Embedded EC public key (ES256) ───────────────────────────────────────────
// This is the live public key from the Supabase project's JWKS endpoint.
// Embedding it eliminates the network round-trip to fetch JWKS on every cold
// start, which is the primary cause of the 401 on Vercel serverless.
// Source: GET https://ztamzcpkegijqcgbgtnn.supabase.co/auth/v1/.well-known/jwks.json
const SUPABASE_EC_JWK = {
  alg: "ES256",
  crv: "P-256",
  ext: true,
  key_ops: ["verify"],
  kid: "75f5cd02-d8fb-40ae-90be-f5b9fdffc153",
  kty: "EC",
  use: "sig",
  x: "q5HfoyfIFVUfaHJy6iGKTGtmaDbsf8d1CiodFIU6TxQ",
  y: "UmRJmyWoDW7-yFEa8AXfm4WckPYjvrZL_0WExEZ8igU",
};

// Pre-import the embedded key at module load time (sync-safe via promise).
let _embeddedKey: KeyLike | null = null;
let _embeddedKeyPromise: Promise<KeyLike> | null = null;

function getEmbeddedKey(): Promise<KeyLike> {
  if (_embeddedKey) return Promise.resolve(_embeddedKey);
  if (!_embeddedKeyPromise) {
    _embeddedKeyPromise = importJWK(SUPABASE_EC_JWK, "ES256").then((k) => {
      _embeddedKey = k as KeyLike;
      console.log("[context] Embedded EC public key imported successfully");
      return _embeddedKey;
    });
  }
  return _embeddedKeyPromise;
}

// ── JWKS remote key set (ES256) — kept as fallback for key rotation ──────────
let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!_jwks) {
    try {
      const jwksUrl = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
      console.log("[context] Creating JWKS set from:", jwksUrl);
      _jwks = createRemoteJWKSet(new URL(jwksUrl));
    } catch (e) {
      console.error("[context] Failed to create JWKS set:", e);
    }
  }
  return _jwks;
}

/**
 * Verify a Supabase JWT token and extract its payload.
 *
 * Verification order:
 *  1. Embedded EC public key (no network, fastest, covers the current key)
 *  2. Remote JWKS (handles key rotation automatically)
 *  3. HS256 secret (legacy fallback, only if SUPABASE_JWT_SECRET is set)
 */
async function verifySupabaseToken(token: string): Promise<any> {
  console.log("[context] Verifying token, length:", token?.length);

  // ── 1. Embedded EC public key (primary, no network dependency) ────────────
  try {
    const key = await getEmbeddedKey();
    const { payload } = await jwtVerify(token, key, { algorithms: ["ES256"] });
    console.log("[context] Embedded-key verification success for:", payload.email);
    return payload;
  } catch (e: any) {
    console.warn("[context] Embedded-key verification failed:", e?.message);
  }

  // ── 2. Remote JWKS (fallback for key rotation) ────────────────────────────
  const jwks = getJwks();
  if (jwks) {
    try {
      const { payload } = await jwtVerify(token, jwks, { algorithms: ["ES256"] });
      console.log("[context] JWKS verification success for:", payload.email);
      return payload;
    } catch (e: any) {
      console.warn("[context] JWKS verification failed:", e?.message);
    }
  }

  // ── 3. HS256 secret (legacy fallback) ─────────────────────────────────────
  if (process.env.SUPABASE_JWT_SECRET) {
    try {
      const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);
      console.log("[context] HS256 verification success for:", payload.email);
      return payload;
    } catch (e: any) {
      console.error("[context] HS256 verification failed:", e?.message);
    }
  }

  console.error("[context] All token verification methods failed");
  return null;
}

/**
 * Resolve a verified Supabase user to a database record.
 * Checks users → marketers → cafeterias → cafeteriaStaff in order.
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
      cafeteriaId: userRow[0].cafeteriaId,
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
      cafeteriaId: cafeteriaRow[0].id,
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
      cafeteriaId: staffRow[0].cafeteriaId,
    };
  }

  return null;
}

/**
 * Create tRPC context with Supabase Auth.
 *
 * Token extraction order:
 *  1. Cookie: app_session_id (set by the backend login handler)
 *  2. Authorization: Bearer <token> (set by trpcVanilla from localStorage)
 */
export async function createContextSupabase(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user = null;

  try {
    // ── Extract session token ────────────────────────────────────────────────
    const cookieHeader = opts.req.headers.cookie || "";
    const cookies = parseCookieHeader(cookieHeader);
    let sessionToken = cookies[COOKIE_NAME];

    if (!sessionToken && opts.req.headers.authorization) {
      const authHeader = opts.req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7).trim();
      }
    }

    if (!sessionToken) {
      // No token present — unauthenticated request (public procedures are fine)
      return { req: opts.req, res: opts.res, user: null };
    }

    console.log("[context] Token found, source:", cookies[COOKIE_NAME] ? "cookie" : "Authorization header");

    // ── Verify the Supabase JWT ──────────────────────────────────────────────
    const payload = await verifySupabaseToken(sessionToken);
    if (!payload || !payload.email) {
      console.warn("[context] Token verification returned no payload or no email");
      return { req: opts.req, res: opts.res, user: null };
    }

    const email = payload.email as string;
    const sub = payload.sub as string;

    // ── Resolve user in database ─────────────────────────────────────────────
    const db = await getDb();
    if (!db) {
      console.error("[context] Database not available");
      return { req: opts.req, res: opts.res, user: null };
    }

    user = await getUserFromDatabase(email, sub, db);

    if (!user) {
      console.warn(`[context] Authenticated user ${email} (sub=${sub}) not found in any database table`);
      return { req: opts.req, res: opts.res, user: null };
    }

    console.log(`[context] Session resolved: ${email} role=${user.role}`);
  } catch (error) {
    console.error("[context] Unexpected authentication error:", error);
    user = null;
  }

  return { req: opts.req, res: opts.res, user };
}
