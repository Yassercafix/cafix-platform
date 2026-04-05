import React, { createContext, useContext, useCallback, useEffect, useState, useRef, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type AuthUser = {
  id: string;
  email: string | undefined;
  name: string;
  role: string;
  cafeteriaId: any;
  referenceCode?: string;
};

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  isUnauthenticated: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Simplified user builder that uses only metadata from auth.getUser()
 * This prevents infinite loading states and database dependency issues
 */
async function buildUser(supabaseUser: any): Promise<AuthUser> {
  const meta = supabaseUser.user_metadata ?? {};
  
  return {
    id: supabaseUser.id,
    email: supabaseUser.email,
    name: meta.name ?? meta.full_name ?? supabaseUser.email?.split("@")[0] ?? "User",
    role: meta.role ?? "cafeteria_admin",
    cafeteriaId: meta.cafeteriaId ?? null,
    referenceCode: meta.referenceCode,
  };
}

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider component that wraps the application and provides authentication context
 * to all child components via useAuth hook
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthContextType>({
    user: null,
    loading: true,
    error: null,
    isAuthenticated: false,
    isUnauthenticated: false,
    logout: async () => {},
    refresh: async () => {},
  });

  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      
      if (error || !data.user) {
        setState(prev => ({
          ...prev,
          user: null,
          loading: false,
          error: error ?? null,
          isAuthenticated: false,
          isUnauthenticated: true,
        }));
      } else {
        const user = await buildUser(data.user);
        setState(prev => ({
          ...prev,
          user,
          loading: false,
          error: null,
          isAuthenticated: true,
          isUnauthenticated: false,
        }));
      }
    } catch (err: any) {
      console.error("Error in AuthProvider refresh:", err);
      setState(prev => ({
        ...prev,
        user: null,
        loading: false,
        error: err,
        isAuthenticated: false,
        isUnauthenticated: true,
      }));
    }
  }, []);

  const logout = useCallback(async () => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    await supabase.auth.signOut();
    setState(prev => ({
      ...prev,
      user: null,
      loading: false,
      error: null,
      isAuthenticated: false,
      isUnauthenticated: true,
    }));
  }, []);

  useEffect(() => {
    // Set a timeout to prevent infinite loading
    refreshTimeoutRef.current = setTimeout(() => {
      setState(prev => {
        if (prev.loading) {
          console.warn("Auth loading timeout - forcing completion");
          return {
            ...prev,
            loading: false,
            isUnauthenticated: true,
          };
        }
        return prev;
      });
    }, 3000); // 3 second timeout

    refresh();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current);
        }
        
        if (session?.user) {
          const user = await buildUser(session.user);
          setState(prev => ({
            ...prev,
            user,
            loading: false,
            error: null,
            isAuthenticated: true,
            isUnauthenticated: false,
          }));
        } else {
          setState(prev => ({
            ...prev,
            user: null,
            loading: false,
            error: null,
            isAuthenticated: false,
            isUnauthenticated: true,
          }));
        }
      } catch (err: any) {
        console.error("Error in auth state change:", err);
        setState(prev => ({
          ...prev,
          user: null,
          loading: false,
          error: err,
          isAuthenticated: false,
          isUnauthenticated: true,
        }));
      }
    });

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      subscription.unsubscribe();
    };
  }, [refresh]);

  const value: AuthContextType = {
    ...state,
    logout,
    refresh,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to use authentication context
 * Must be used within AuthProvider
 */
export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
