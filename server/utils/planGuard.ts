import { eq } from "drizzle-orm";
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
 */
export async function getPlanContext(cafeteriaId: string): Promise<PlanContext> {
  const db = await getDb();
  if (!db) throw new Error("[PLAN] Database not available");
  const result = await db
    .select({
      subscriptionPlan: cafeterias.subscriptionPlan,
    })
    .from(cafeterias)
    .where(eq(cafeterias.id, cafeteriaId))
    .limit(1);

  if (result.length === 0) {
    throw new Error("[PLAN] Cafeteria not found");
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
