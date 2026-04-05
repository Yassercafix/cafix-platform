import { useCallback, useEffect, useState, useRef } from "react";
import { trpcVanilla as trpc } from "@/lib/trpcVanilla";
import { supabase } from "@/lib/supabaseClient";

export type AuthUser = {
  id: string;
  email: string | undefined;
  name: string;
  role: string;
  cafeteriaId: any;
  marketerId?: string;
  parentId?: string;
  referenceCode?: string;
  country?: string;
  currency?: string;
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  isUnauthenticated: boolean;
};

export function useAuth(options?: { redirectOnUnauthenticated?: boolean }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
    isAuthenticated: false,
    isUnauthenticated: false,
  });
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchUser = useCallback(async () => {
    // Reset to loading state on every explicit refresh call
    setState(prev => ({ ...prev, loading: true }));

    // Clear any existing timeout before starting a new fetch
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    // Set a safety-net timeout: if the me query doesn't resolve within 10 s,
    // force the loading state to false so the UI doesn't hang forever.
    refreshTimeoutRef.current = setTimeout(() => {
      setState(prev => {
        if (prev.loading) {
          console.warn("Auth loading timeout - forcing unauthenticated");
          return {
            ...prev,
            loading: false,
            isUnauthenticated: true,
          };
        }
        return prev;
      });
    }, 10000);

    try {
      // Use authSupabase.me instead of auth.me
      const result = await trpc.authSupabase.me.query();

      // Cancel the timeout — we got a result in time
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }

      if (result) {
        const user: AuthUser = {
          id: result.id,
          email: result.email,
          name: result.name || "User",
          role: result.role,
          cafeteriaId: result.cafeteriaId ?? (result.role === "cafeteria_admin" ? result.id : undefined),
          marketerId: result.marketerId,
          parentId: result.parentId,
          referenceCode: result.referenceCode,
          country: result.country,
          currency: result.currency,
        };
        setState({
          user,
          loading: false,
          error: null,
          isAuthenticated: true,
          isUnauthenticated: false,
        });
      } else {
        setState({
          user: null,
          loading: false,
          error: null,
          isAuthenticated: false,
          isUnauthenticated: true,
        });
      }
    } catch (err: any) {
      // Cancel the timeout on error too
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }

      // Don't log error for 401/unauthorized as it's expected when not logged in
      if (err.shape?.code !== -32001 && err.data?.code !== "UNAUTHORIZED") {
        console.error("Error in useAuth fetchUser:", err);
      }
      setState({
        user: null,
        loading: false,
        error: err,
        isAuthenticated: false,
        isUnauthenticated: true,
      });
    }
  }, []);

  useEffect(() => {
    fetchUser();

    // Supabase auth listener is disabled — backend session cookie is used instead.
    // Keeping this commented out to avoid crashing when Supabase env vars are absent.
    /*
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        fetchUser();
      } else if (event === 'SIGNED_OUT') {
        setState({
          user: null,
          loading: false,
          error: null,
          isAuthenticated: false,
          isUnauthenticated: true,
        });
      }
    });
    */

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      // subscription.unsubscribe();
    };
  }, [fetchUser]);

  const logout = useCallback(async () => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    try {
      // Call backend logout to clear session cookie
      await trpc.authSupabase.logout.mutate();
      // Guard: only call Supabase signOut when client is available
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.error("Logout error:", err);
    }

    // Clear session token from localStorage
    localStorage.removeItem("session_token");
    localStorage.removeItem("last_activity");

    setState({
      user: null,
      loading: false,
      error: null,
      isAuthenticated: false,
      isUnauthenticated: true,
    });
  }, []);

  return {
    ...state,
    logout,
    refresh: fetchUser,
  };
}
