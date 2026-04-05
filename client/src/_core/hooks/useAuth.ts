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
    try {
      // Use authSupabase.me instead of auth.me
      const result = await trpc.authSupabase.me.query();
      
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
    // Set a timeout to force loading to false if it takes too long
    refreshTimeoutRef.current = setTimeout(() => {
      if (state.loading) {
        console.warn("Auth loading timeout - forcing completion");
        setState(prev => ({
          ...prev,
          loading: false,
          isUnauthenticated: true,
        }));
      }
    }, 5000);

    fetchUser();

    // Local test bypass: disable Supabase auth listener
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
      // Call Supabase logout via tRPC to clear cookies and Supabase session
      await trpc.authSupabase.logout.mutate();
      // Also clear Supabase client session just in case
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Logout error:", err);
    }
    
    setState({
      user: null,
      loading: false,
      error: null,
      isAuthenticated: false,
      isUnauthenticated: true,
    });
    
    // Clear last activity
    localStorage.removeItem("last_activity");
  }, []);

  return {
    ...state,
    logout,
    refresh: fetchUser,
  };
}
