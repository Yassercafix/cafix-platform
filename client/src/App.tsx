import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ThemeProvider } from "./contexts/ThemeContext";
import { TranslationProvider } from "./locales/useTranslation";
import Home from "./pages/Home";
import Login from "./pages/Login";
import OwnerDashboard from "./pages/OwnerDashboard";
import WaiterDashboard from "./pages/WaiterDashboard";
import ChefDashboard from "./pages/ChefDashboard";
import ReportingDashboard from "./pages/ReportingDashboard";
import ManagerDashboard from "./pages/ManagerDashboard";
import MarketerDashboard from "./pages/MarketerDashboard";
import CafeteriaDashboard from "./pages/CafeteriaDashboard";
import CustomerMenu from "./pages/CustomerMenu";
import OrderTracking from "./pages/OrderTracking";
import { useAuth } from "./_core/hooks/useAuth";
import { toast } from "sonner";

// Owner Dashboard Sub-pages
import OwnerCafeterias from "./pages/owner/OwnerCafeterias";
import OwnerMarketers from "./pages/owner/OwnerMarketers";
import OwnerPoints from "./pages/owner/OwnerPoints";
import OwnerReports from "./pages/owner/OwnerReports";
import OwnerSettings from "./pages/owner/OwnerSettings";

// Marketer Dashboard Sub-pages
import MarketerDownlines from "./pages/marketer/MarketerDownlines";
import MarketerCommissions from "./pages/marketer/MarketerCommissions";
import MarketerReports from "./pages/marketer/MarketerReports";

// Cafeteria Admin Dashboard Sub-pages
import CafeteriaMenu from "./pages/cafeteria/CafeteriaMenu";
import CafeteriaTables from "./pages/cafeteria/CafeteriaTables";
import CafeteriaStaff from "./pages/cafeteria/CafeteriaStaff";
import CafeteriaReports from "./pages/cafeteria/CafeteriaReports";
import CafeteriaOrders from "./pages/cafeteria/CafeteriaOrders";
import CafeteriaRecharge from "./pages/cafeteria/CafeteriaRecharge";
import CafeteriaSettings from "./pages/cafeteria/CafeteriaSettings";

// Manager Dashboard Sub-pages
import ManagerOrders from "./pages/manager/ManagerOrders";
import ManagerStaff from "./pages/manager/ManagerStaff";
import ManagerReports from "./pages/manager/ManagerReports";

// Waiter Dashboard Sub-pages
import WaiterTables from "./pages/waiter/WaiterTables";
import WaiterOrders from "./pages/waiter/WaiterOrders";

// Chef Dashboard Sub-pages
import ChefKitchenBoard from "./pages/chef/ChefKitchenBoard";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/login"} component={Login} />
      <Route path={"/menu/:tableToken"} component={CustomerMenu} />
      <Route path={"/order/:tableToken"} component={CustomerMenu} />
      <Route path={"/order-tracking/:orderId"} component={OrderTracking} />
      <Route path={"/order-confirmation/:orderId"} component={OrderTracking} />
      
      {/* ===== OWNER DASHBOARD ROUTES ===== */}
      <Route path={"/dashboard/owner"} component={() => <ProtectedRoute component={OwnerDashboard} allowedRoles={["owner"]} />} />
      <Route path={"/dashboard/owner/cafeterias"} component={() => <ProtectedRoute component={OwnerCafeterias} allowedRoles={["owner"]} />} />
      <Route path={"/dashboard/owner/marketers"} component={() => <ProtectedRoute component={OwnerMarketers} allowedRoles={["owner"]} />} />
      <Route path={"/dashboard/owner/points"} component={() => <ProtectedRoute component={OwnerPoints} allowedRoles={["owner"]} />} />
      <Route path={"/dashboard/owner/reports"} component={() => <ProtectedRoute component={OwnerReports} allowedRoles={["owner"]} />} />
      <Route path={"/dashboard/owner/settings"} component={() => <ProtectedRoute component={OwnerSettings} allowedRoles={["owner"]} />} />

      {/* ===== MARKETER DASHBOARD ROUTES ===== */}
      <Route path={"/dashboard/marketer"} component={() => <ProtectedRoute component={MarketerDashboard} allowedRoles={["marketer"]} />} />
      <Route path={"/dashboard/marketer/downlines"} component={() => <ProtectedRoute component={MarketerDownlines} allowedRoles={["marketer"]} />} />
      <Route path={"/dashboard/marketer/commissions"} component={() => <ProtectedRoute component={MarketerCommissions} allowedRoles={["marketer"]} />} />
      <Route path={"/dashboard/marketer/reports"} component={() => <ProtectedRoute component={MarketerReports} allowedRoles={["marketer"]} />} />

      {/* ===== CAFETERIA ADMIN DASHBOARD ROUTES ===== */}
      <Route path={"/dashboard/cafeteria-admin"} component={() => <ProtectedRoute component={CafeteriaDashboard} allowedRoles={["cafeteria_admin"]} />} />
      <Route path={"/dashboard/cafeteria-admin/menu"} component={() => <ProtectedRoute component={CafeteriaMenu} allowedRoles={["cafeteria_admin"]} />} />
      <Route path={"/dashboard/cafeteria-admin/tables"} component={() => <ProtectedRoute component={CafeteriaTables} allowedRoles={["cafeteria_admin"]} />} />
      <Route path={"/dashboard/cafeteria-admin/staff"} component={() => <ProtectedRoute component={CafeteriaStaff} allowedRoles={["cafeteria_admin"]} />} />
      <Route path={"/dashboard/cafeteria-admin/orders"} component={() => <ProtectedRoute component={CafeteriaOrders} allowedRoles={["cafeteria_admin"]} />} />
      <Route path={"/dashboard/cafeteria-admin/reports"} component={() => <ProtectedRoute component={CafeteriaReports} allowedRoles={["cafeteria_admin"]} />} />
      <Route path={"/dashboard/cafeteria-admin/recharge"} component={() => <ProtectedRoute component={CafeteriaRecharge} allowedRoles={["cafeteria_admin"]} />} />
      <Route path={"/dashboard/cafeteria-admin/settings"} component={() => <ProtectedRoute component={CafeteriaSettings} allowedRoles={["cafeteria_admin"]} />} />

      {/* ===== MANAGER DASHBOARD ROUTES ===== */}
      <Route path={"/dashboard/manager"} component={() => <ProtectedRoute component={ManagerDashboard} allowedRoles={["manager"]} />} />
      <Route path={"/dashboard/manager/orders"} component={() => <ProtectedRoute component={ManagerOrders} allowedRoles={["manager"]} />} />
      <Route path={"/dashboard/manager/staff"} component={() => <ProtectedRoute component={ManagerStaff} allowedRoles={["manager"]} />} />
      <Route path={"/dashboard/manager/reports"} component={() => <ProtectedRoute component={ManagerReports} allowedRoles={["manager"]} />} />

      {/* ===== WAITER DASHBOARD ROUTES ===== */}
      <Route path={"/dashboard/waiter"} component={() => <ProtectedRoute component={WaiterDashboard} allowedRoles={["waiter"]} />} />
      <Route path={"/dashboard/waiter/tables"} component={() => <ProtectedRoute component={WaiterTables} allowedRoles={["waiter"]} />} />
      <Route path={"/dashboard/waiter/orders"} component={() => <ProtectedRoute component={WaiterOrders} allowedRoles={["waiter"]} />} />

      {/* ===== CHEF DASHBOARD ROUTES ===== */}
      <Route path={"/dashboard/chef"} component={() => <ProtectedRoute component={ChefDashboard} allowedRoles={["chef"]} />} />
      <Route path={"/dashboard/chef/kitchen-board"} component={() => <ProtectedRoute component={ChefKitchenBoard} allowedRoles={["chef"]} />} />

      {/* ===== OTHER ROUTES ===== */}
      <Route path={"/reports"} component={ReportingDashboard} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [autoLogoutTime, setAutoLogoutTime] = useState(120 * 60 * 1000); // Default 2 hours

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;

    const checkSession = async () => {
      // Only act on session expiry once auth state has fully resolved (loading=false).
      // This prevents the race condition where the app sees last_activity in localStorage
      // but useAuth hasn't finished its first authSupabase.me call yet, which would
      // incorrectly trigger a "session expired" redirect immediately after login.
      if (loading) return;

      if (!isAuthenticated && localStorage.getItem('last_activity')) {
        // Auth resolved as unauthenticated but we have stale last_activity → clear and redirect.
        localStorage.removeItem('last_activity');
        toast.error("Session expired. Please login again.");
        setLocation('/login');
        return;
      }

      if (isAuthenticated) {
        const lastActivity = localStorage.getItem('last_activity');
        if (lastActivity) {
          const now = Date.now();
          if (now - parseInt(lastActivity) > autoLogoutTime) {
            logout();
            toast.error("Session expired due to inactivity. Please login again.");
            setLocation('/login');
          }
        }
      }
    };

    const updateActivity = () => {
      if (isAuthenticated) {
        localStorage.setItem('last_activity', Date.now().toString());
      }
    };

    if (isAuthenticated) {
      interval = setInterval(checkSession, 30000); // Check every 30 seconds
      window.addEventListener('mousemove', updateActivity);
      window.addEventListener('keydown', updateActivity);
      window.addEventListener('click', updateActivity);
      window.addEventListener('scroll', updateActivity);
    } else {
      if (interval) clearInterval(interval);
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('scroll', updateActivity);
    }

    return () => {
      if (interval) clearInterval(interval);
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('scroll', updateActivity);
    };
  }, [isAuthenticated, loading, autoLogoutTime, setLocation, logout]);

  return (
    <ErrorBoundary>
      <TranslationProvider>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </TranslationProvider>
    </ErrorBoundary>
  );
}

export default App;
