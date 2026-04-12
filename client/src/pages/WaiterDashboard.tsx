import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Loader2,
  Clock,
  CheckCircle2,
  ChefHat,
  Bell,
  UtensilsCrossed,
  PlayCircle,
  StopCircle,
  RefreshCw,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";

type OrderStatus = "all" | "pending" | "preparing" | "ready";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700 border-gray-300",
  preparing: "bg-yellow-100 text-yellow-700 border-yellow-300",
  ready: "bg-green-100 text-green-700 border-green-300",
  served: "bg-blue-100 text-blue-700 border-blue-300",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || "bg-gray-100 text-gray-700 border-gray-300";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export default function WaiterDashboard() {
  const { user, loading: authLoading } = useAuth();
  const staffId = (user as any)?.id || "";
  const cafeteriaId = (user as any)?.cafeteriaId || (user as any)?.id || "";

  const [activeFilter, setActiveFilter] = useState<OrderStatus>("all");
  const [now, setNow] = useState(new Date());
  const [shiftWarning, setShiftWarning] = useState(false);

  // Tick every second for elapsed time
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Shift ──────────────────────────────────────────────────────────────────
  const {
    data: activeShiftData,
    isLoading: shiftLoading,
    refetch: refetchShift,
  } = trpc.shifts.getStaffShifts.useQuery(
    { staffId, cafeteriaId, status: "active" },
    { enabled: !!staffId && !!cafeteriaId }
  );

  const hasActiveShift = activeShiftData && activeShiftData.length > 0;
  const currentShift = hasActiveShift ? activeShiftData[0] : null;

  useEffect(() => {
    if (!shiftLoading && !hasActiveShift) {
      setShiftWarning(true);
    } else {
      setShiftWarning(false);
    }
  }, [hasActiveShift, shiftLoading]);

  const startShiftMutation = trpc.shifts.startShift.useMutation({
    onSuccess: () => {
      toast.success("Shift started");
      refetchShift();
    },
    onError: (err) => toast.error(`Failed to start shift: ${err.message}`),
  });

  const endShiftMutation = trpc.shifts.endShift.useMutation({
    onSuccess: () => {
      toast.success("Shift ended");
      refetchShift();
    },
    onError: (err) => toast.error(`Failed to end shift: ${err.message}`),
  });

  const handleStartShift = () => startShiftMutation.mutate({ staffId, cafeteriaId });
  const handleEndShift = () => {
    if (!currentShift) return;
    endShiftMutation.mutate({ shiftId: currentShift.id });
  };

  // ── Active Orders (polling every 5 s) ─────────────────────────────────────
  const {
    data: allOrders,
    isLoading: ordersLoading,
    refetch: refetchOrders,
  } = trpc.ordersPhase2.getOrders.useQuery(
    { cafeteriaId },
    { enabled: !!cafeteriaId, refetchInterval: 5000 }
  );

  // Normalize to 4 statuses and filter only active orders
  const activeOrders = useMemo(() => {
    if (!allOrders) return [];
    return allOrders
      .map((o: any) => ({
        ...o,
        // Normalize status to 4 states
        status: normalizeStatus(o.status),
      }))
      .filter((o: any) => o.status !== "served");
  }, [allOrders]);

  // Apply filter
  const filteredOrders = useMemo(() => {
    if (activeFilter === "all") return activeOrders;
    return activeOrders.filter((o: any) => o.status === activeFilter);
  }, [activeOrders, activeFilter]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const markServedMutation = trpc.ordersPhase2.markServed.useMutation({
    onSuccess: () => {
      toast.success("Order marked as served");
      console.log('[WAITER_ACTION] Order marked as served');
      refetchOrders();
    },
    onError: (err) => {
      const errorMsg = err.message || 'Failed to mark order as served';
      toast.error(errorMsg);
      console.error('[WAITER_ACTION_ERROR] Failed to mark served:', err);
    },
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getElapsed = (createdAt: string) => {
    const diffMs = now.getTime() - new Date(createdAt).getTime();
    const mins = Math.floor(diffMs / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getTableLabel = (order: any) => {
    if (order.table?.tableNumber) return `Table ${order.table.tableNumber}`;
    if (order.tableId) return `Table ${order.tableId.slice(0, 6)}`;
    return "No Table";
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin w-8 h-8 text-gray-500" />
      </div>
    );
  }

  const filterButtons: { label: string; value: OrderStatus }[] = [
    { label: "All", value: "all" },
    { label: "Pending", value: "pending" },
    { label: "Preparing", value: "preparing" },
    { label: "Ready", value: "ready" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <UtensilsCrossed className="w-6 h-6 text-orange-500" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Waiter Dashboard</h1>
              <p className="text-xs text-gray-500">Welcome, {(user as any)?.name || "Waiter"}</p>
            </div>
          </div>

          {/* Shift Control */}
          <div className="flex items-center gap-3">
            {shiftLoading ? (
              <Loader2 className="animate-spin w-4 h-4 text-gray-400" />
            ) : hasActiveShift ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Shift Active
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  onClick={handleEndShift}
                  disabled={endShiftMutation.isPending}
                >
                  <StopCircle className="w-4 h-4 mr-1" />
                  End Shift
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  No Active Shift
                </span>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleStartShift}
                  disabled={startShiftMutation.isPending}
                >
                  <PlayCircle className="w-4 h-4 mr-1" />
                  Start Shift
                </Button>
              </div>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={() => refetchOrders()}
              title="Refresh orders"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Shift Warning */}
        {shiftWarning && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-300 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-800">No Active Shift</p>
              <p className="text-xs text-red-600 mt-1">You must start a shift to perform actions</p>
            </div>
          </div>
        )}
        {/* ── Summary Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Active Orders", value: activeOrders.length, color: "text-gray-700" },
            {
              label: "Pending",
              value: activeOrders.filter((o: any) => o.status === "pending").length,
              color: "text-gray-500",
            },
            {
              label: "Preparing",
              value: activeOrders.filter((o: any) => o.status === "preparing").length,
              color: "text-yellow-600",
            },
            {
              label: "Ready",
              value: activeOrders.filter((o: any) => o.status === "ready").length,
              color: "text-green-600",
            },
          ].map((stat) => (
            <Card key={stat.label} className="text-center py-3">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
            </Card>
          ))}
        </div>

        {/* ── Filter Bar ── */}
        <div className="flex flex-wrap gap-2 mb-5">
          {filterButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setActiveFilter(btn.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activeFilter === btn.value
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-white text-gray-600 border-gray-300 hover:border-orange-400"
              }`}
            >
              {btn.label}
              {btn.value !== "all" && (
                <span className="ml-1.5 text-xs opacity-70">
                  (
                  {activeOrders.filter((o: any) => o.status === btn.value).length}
                  )
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Orders Grid ── */}
        {ordersLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin w-8 h-8 text-gray-400" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <UtensilsCrossed className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg font-semibold">No active orders</p>
            <p className="text-sm mt-1">Orders will appear here once customers place them.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredOrders.map((order: any) => (
              <OrderCard
                key={order.id}
                order={order}
                elapsed={getElapsed(order.createdAt)}
                tableLabel={getTableLabel(order)}
                onMarkServed={() => markServedMutation.mutate({ orderId: order.id })}
                isMarkingServed={markServedMutation.isPending}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Status Normalization ───────────────────────────────────────────────────
function normalizeStatus(status: string): string {
  // Map all backend statuses to 4 normalized statuses
  if (["pending", "created"].includes(status)) return "pending";
  if (["sent_to_kitchen", "preparing"].includes(status)) return "preparing";
  if (status === "ready") return "ready";
  if (status === "served") return "served";
  return status;
}

// ── Order Card Component ───────────────────────────────────────────────────
interface OrderCardProps {
  order: any;
  elapsed: string;
  tableLabel: string;
  onMarkServed: () => void;
  isMarkingServed: boolean;
}

function OrderCard({
  order,
  elapsed,
  tableLabel,
  onMarkServed,
  isMarkingServed,
}: OrderCardProps) {
  const canMarkServed = order.status === "ready";

  const cardBorder =
    order.status === "ready"
      ? "border-green-400 ring-1 ring-green-300"
      : order.status === "preparing"
      ? "border-yellow-400"
      : "border-gray-200";

  return (
    <Card className={`border ${cardBorder} shadow-sm hover:shadow-md transition-shadow`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-gray-900">{tableLabel}</span>
          <StatusBadge status={order.status} />
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
          <Clock className="w-3 h-3" />
          <span>{elapsed}</span>
          <span className="ml-1 font-mono text-gray-300">#{order.id.slice(0, 6)}</span>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4">
        {/* Items List */}
        <div className="space-y-1.5 mb-4 min-h-[60px]">
          {order.orderItems && order.orderItems.length > 0 ? (
            order.orderItems.map((item: any) => (
              <div key={item.id} className="flex items-start gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center">
                  {item.quantity}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {item.menuItem?.name || `Item ${item.menuItemId?.slice(0, 6)}`}
                  </p>
                  {item.notes && (
                    <p className="text-xs text-amber-600 bg-amber-50 rounded px-1.5 py-0.5 mt-0.5 truncate">
                      Note: {item.notes}
                    </p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-gray-400 italic">No items</p>
          )}
        </div>

        {/* Total */}
        <div className="flex justify-between items-center text-sm mb-3 pt-2 border-t border-gray-100">
          <span className="text-gray-500">Total</span>
          <span className="font-semibold text-gray-800">
            {Number(order.totalAmount).toFixed(2)}
          </span>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {canMarkServed && (
                <Button
                  size="sm"
                  className="w-full bg-green-600 hover:bg-green-700 text-white disabled:bg-green-600/50"
                  onClick={() => {
                    if (!hasActiveShift) {
                      toast.error('You must have an active shift to mark orders as served');
                      return;
                    }
                    onMarkServed();
                  }}
                  disabled={isMarkingServed || !hasActiveShift}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  Mark as Served
                </Button>
          )}
          {order.status === "pending" && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 py-1">
              <Clock className="w-3.5 h-3.5" />
              Waiting for kitchen...
            </div>
          )}
          {order.status === "preparing" && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-yellow-600 py-1">
              <ChefHat className="w-3.5 h-3.5" />
              Kitchen is preparing...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
