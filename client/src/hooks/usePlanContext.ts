/**
 * usePlanContext
 *
 * Returns safe stub values so the app works without a backend.
 * Plan enforcement is disabled; all features are treated as available.
 */
export function usePlanContext() {
  return {
    plan: "pro" as string | undefined,
    limits: undefined as any,
    isLoading: false,
    error: null,
    refetch: async () => {},
  };
}
