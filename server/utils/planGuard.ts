import { eq, sql } from "drizzle-orm";
import { getDb } from "../db.js";
import { cafeterias } from "../../drizzle/schema.js";

/**
 * PLAN_LIMITS defines the restrictions for each subscription plan.
 * unlimited values are null.
 */
export const PLAN_LIMITS = {
  starter: {
    maxStaff: 3,
    maxTables: 10,
    features: {
      premiumReports: false,
      sections: false,
    },
  },
  growth: {
    maxStaff: 10,
    maxTables: 50,
    features: {
      premiumReports: true,
      sections: true,
    },
  },
  pro: {
    maxStaff: null, // unlimited
    maxTables: null, // unlimited
    features: {
      premiumReports: true,
      sections: true,
    },
  },
} as const;

export type PlanName = keyof typeof PLAN_LIMITS;

export interface PlanContext {
  plan: PlanName;
  limits: typeof PLAN_LIMITS[PlanName];
}

/**
 * Retrieves the plan context for a specific cafeteria.
 * Performs exactly one database query.
 *
 * Falls back gracefully if the subscriptionPlan column does not yet exist
 * (pre-migration state) by running a simpler id-only query.
 */
export async function getPlanContext(cafeteriaId: string): Promise<PlanContext> {
  const db = await getDb();
  if (!db) throw new Error("[PLAN] Database not available");

  // Primary query — includes subscriptionPlan
  let result: any[] = [];
  try {
    result = await db
      .select({
        subscriptionPlan: cafeterias.subscriptionPlan,
      })
      .from(cafeterias)
      .where(eq(cafeterias.id, cafeteriaId))
      .limit(1);
  } catch (queryErr: any) {
    // If the subscriptionPlan column doesn't exist yet (pre-migration),
    // fall back to a raw query that only selects the id column.
    console.warn(
      "[PLAN] subscriptionPlan query failed, falling back to id-only query:",
      queryErr?.message
    );
    try {
      // Use parameterised raw SQL to avoid injection
      const fallback = await db.execute(
        sql`SELECT id FROM "cafeterias" WHERE id = ${cafeteriaId} LIMIT 1`
      );
      const rows: any[] = fallback?.rows ?? (Array.isArray(fallback) ? fallback : []);
      if (rows.length > 0) {
        // Cafeteria exists but subscriptionPlan column is missing — treat as starter
        console.warn("[PLAN] Cafeteria found via fallback, defaulting to starter plan");
        return { plan: "starter", limits: PLAN_LIMITS.starter };
      }
    } catch (fallbackErr: any) {
      console.error("[PLAN] Fallback query also failed:", fallbackErr?.message);
    }
    throw new Error(`[PLAN] Cafeteria not found (id=${cafeteriaId})`);
  }

  if (result.length === 0) {
    throw new Error(`[PLAN] Cafeteria not found (id=${cafeteriaId})`);
  }

  const plan = (result[0].subscriptionPlan as PlanName) || "starter";
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;

  return {
    plan,
    limits,
  };
}

/**
 * Asserts that a specific limit has not been reached.
 * Does NOT query the database.
 */
export function assertLimit(
  planContext: PlanContext,
  limitKey: keyof Omit<PlanContext["limits"], "features">,
  currentCount: number,
  errorMessage?: string
): void {
  const limit = planContext.limits[limitKey];

  if (limit !== null && currentCount >= limit) {
    throw new Error(
      errorMessage || `Plan limit reached: ${limitKey} is restricted to ${limit} on the ${planContext.plan} plan.`
    );
  }
}

/**
 * Asserts that a specific feature is available on the current plan.
 * Does NOT query the database.
 */
export function assertFeature(
  planContext: PlanContext,
  featurePath: keyof PlanContext["limits"]["features"],
  errorMessage?: string
): void {
  const isEnabled = planContext.limits.features[featurePath];

  if (!isEnabled) {
    throw new Error(
      errorMessage || `Feature not available: ${featurePath} requires a higher subscription plan.`
    );
  }
}
