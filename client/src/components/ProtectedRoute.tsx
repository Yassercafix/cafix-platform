import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Spinner } from "@/components/ui/spinner";
import { useEffect, useState } from "react";

interface ProtectedRouteProps {
  component: React.ComponentType<any>;
  allowedRoles: string[];
}

/**
 * Role → dashboard route mapping.
 * Corrected to separate owner, cafeteria_admin, and manager.
 */
const ROLE_ROUTES: Record<string, string> = {
  owner: "/dashboard/owner",
  marketer: "/dashboard/marketer",
  cafeteria_admin: "/dashboard/cafeteria-admin",
  manager: "/dashboard/manager",
  waiter: "/dashboard/waiter",
  chef: "/dashboard/chef",
};

/**
 * ProtectedRoute wraps a dashboard component and enforces both
 * authentication and role-based access control (RBAC).
 * 
 * Improved version with better error handling and logging.
 */
export function ProtectedRoute({
  component: Component,
  allowedRoles,
}: ProtectedRouteProps) {
  const { user, loading, isUnauthenticated, error } = useAuth();
  const [, setLocation] = useLocation();
  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    // Log for debugging
    console.log("ProtectedRoute state:", {
      loading,
      isUnauthenticated,
      userRole: user?.role,
      allowedRoles,
      error: error?.message,
    });

    if (loading) return;

    // Not authenticated → redirect to login
    if (isUnauthenticated) {
      console.log("User is unauthenticated, redirecting to login");
      setLocation("/login");
      setRedirected(true);
      return;
    }

    // Authenticated but role not allowed → redirect to user's correct dashboard
    if (user && user.role) {
      const userRole = user.role as string;
      if (!allowedRoles.includes(userRole)) {
        const correctRoute = ROLE_ROUTES[userRole] ?? "/";
        console.log(`User role '${userRole}' not in allowed roles, redirecting to ${correctRoute}`);
        setLocation(correctRoute);
        setRedirected(true);
        return;
      }
    }
  }, [loading, isUnauthenticated, user, allowedRoles, setLocation]);

  // Still loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Spinner />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirected or unauthenticated
  if (isUnauthenticated || redirected) {
    return null;
  }

  // No user data
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-red-600">Error: No user data available</p>
        </div>
      </div>
    );
  }

  // Check role permission
  if (user.role) {
    const userRole = user.role as string;
    if (!allowedRoles.includes(userRole)) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-red-600">Error: Access denied for role '{userRole}'</p>
          </div>
        </div>
      );
    }
  }

  // All checks passed, render the component
  return <Component />;
}
