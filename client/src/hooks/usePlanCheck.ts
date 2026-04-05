import { usePlanContext } from "./usePlanContext";

/**
 * usePlanCheck
 *
 * Provides helper functions for checking plan-based limits and feature access.
 * Uses usePlanContext as the single source of truth (backend-driven).
 */
export function usePlanCheck() {
  const { plan, limits, isLoading } = usePlanContext();

  /**
   * Returns true if a new staff member can be created given the current count.
   * @param currentCount - The current number of staff members
   */
  function canCreateStaff(currentCount: number): boolean {
    if (!limits) return false;
    // null means unlimited
    if (limits.maxStaff === null) return true;
    return currentCount < limits.maxStaff;
  }

  /**
   * Returns true if a new table can be created given the current count.
   * @param currentCount - The current number of tables
   */
  function canCreateTable(currentCount: number): boolean {
    if (!limits) return false;
    // null means unlimited
    if (limits.maxTables === null) return true;
    return currentCount < limits.maxTables;
  }

  /**
   * Returns true if the given feature is available on the current plan.
   * @param feature - The feature key to check (e.g., "premiumReports", "sections")
   */
  function hasFeature(feature: keyof NonNullable<typeof limits>["features"]): boolean {
    if (!limits) return false;
    return limits.features[feature] === true;
  }

  return {
    plan,
    limits,
    isLoading,
    canCreateStaff,
    canCreateTable,
    hasFeature,
  };
}
