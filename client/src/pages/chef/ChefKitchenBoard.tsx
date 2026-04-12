import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTranslation } from '@/locales/useTranslation';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DashboardNavigation } from '@/components/DashboardNavigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  UtensilsCrossed,
  LayoutDashboard,
  Clock,
  CheckCircle2,
  AlertCircle,
  Timer,
  ChefHat,
  Bell,
  RefreshCw,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  notes?: string;
}

interface Order {
  id: string;
  tableNumber: string;
  status: 'pending' | 'preparing';
  createdAt: string;
  items: OrderItem[];
}

export default function ChefKitchenBoard() {
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const { language } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [now, setNow] = useState(new Date());
  const [shiftWarning, setShiftWarning] = useState(false);

  const isRTL = language === 'ar';
  const cafeteriaId = user?.cafeteriaId;
  const staffId = (user as any)?.id;

  // Tick every second for elapsed time
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const navigationItems = [
    { label: isRTL ? 'لوحة التحكم' : 'Dashboard', path: '/dashboard/chef', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: isRTL ? 'لوحة المطبخ' : 'Kitchen Board', path: '/dashboard/chef/kitchen-board', icon: <UtensilsCrossed className="w-5 h-5" /> },
  ];

  // Check active shift
  const { data: activeShiftData, isLoading: shiftLoading } = trpc.shifts.getStaffShifts.useQuery(
    { staffId, cafeteriaId: cafeteriaId || '', status: 'active' },
    { enabled: !!staffId && !!cafeteriaId }
  );

  const hasActiveShift = activeShiftData && activeShiftData.length > 0;

  useEffect(() => {
    if (!shiftLoading && !hasActiveShift) {
      setShiftWarning(true);
    } else {
      setShiftWarning(false);
    }
  }, [hasActiveShift, shiftLoading]);

  // Fetch all orders for this cafeteria
  const { data: allOrders, isLoading: ordersLoading, refetch } = trpc.ordersPhase2.getOrders.useQuery(
    { cafeteriaId: cafeteriaId || '' },
    { enabled: !!cafeteriaId, refetchInterval: 5000 }
  );

  const markPreparingMutation = trpc.ordersPhase2.markPreparing.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? 'بدأ التحضير' : 'Started preparing');
      console.log('[CHEF_ACTION] Order moved to preparing');
      refetch();
    },
    onError: (err) => {
      const errorMsg = err.message || (isRTL ? 'خطأ في تحديث الحالة' : 'Error updating status');
      toast.error(errorMsg);
      console.error('[CHEF_ACTION_ERROR] Failed to start preparing:', err);
    },
  });

  const markReadyMutation = trpc.ordersPhase2.markReady.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? 'الطلب جاهز' : 'Order ready');
      console.log('[CHEF_ACTION] Order moved to ready');
      refetch();
    },
    onError: (err) => {
      const errorMsg = err.message || (isRTL ? 'خطأ في تحديث الحالة' : 'Error updating status');
      toast.error(errorMsg);
      console.error('[CHEF_ACTION_ERROR] Failed to mark ready:', err);
    },
  });

  // Normalize and organize orders into columns
  const { pendingOrders, preparingOrders } = useMemo(() => {
    if (!allOrders) return { pendingOrders: [], preparingOrders: [] };

    const normalized = allOrders
      .map((o: any) => ({
        ...o,
        status: normalizeStatus(o.status),
      }))
      .filter((o: any) => ['pending', 'preparing'].includes(o.status));

    return {
      pendingOrders: normalized.filter((o: any) => o.status === 'pending'),
      preparingOrders: normalized.filter((o: any) => o.status === 'preparing'),
    };
  }, [allOrders]);

  const getTimeInKitchen = (createdAt: string) => {
    const diff = Math.floor((now.getTime() - new Date(createdAt).getTime()) / 60000);
    return `${diff} ${isRTL ? 'دقيقة' : 'min'}`;
  };

  const getTableLabel = (order: any) => {
    if (order.table?.tableNumber) return `Table ${order.table.tableNumber}`;
    if (order.tableId) return `Table ${order.tableId.slice(0, 6)}`;
    return 'No Table';
  };

  if (authLoading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );

  return (
    <div className={`min-h-screen bg-slate-900 text-white ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <DashboardHeader
        showBackButton={true}
        showHomeButton={true}
        title={isRTL ? 'لوحة تحكم المطبخ' : 'Kitchen Display System'}
        onMenuClick={() => setMenuOpen(true)}
      />
      <DashboardNavigation isOpen={menuOpen} onClose={() => setMenuOpen(false)} items={navigationItems} />

      <main className="p-4 md:p-6">
        {/* Shift Warning */}
        {shiftWarning && (
          <div className="mb-6 p-4 rounded-lg bg-red-900/30 border border-red-600 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-300">
                {isRTL ? 'لا توجد وردية نشطة' : 'No Active Shift'}
              </p>
              <p className="text-xs text-red-200 mt-1">
                {isRTL ? 'يجب أن تكون لديك وردية نشطة لتنفيذ الإجراءات' : 'You must have an active shift to perform actions'}
              </p>
            </div>
          </div>
        )}

        {/* Header Stats */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-orange-600 p-3 rounded-xl shadow-lg shadow-orange-900/20">
              <ChefHat className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">
                {isRTL ? 'الطلبات النشطة' : 'Active Orders'}
              </h2>
              <p className="text-slate-400 text-sm">
                {isRTL
                  ? `${pendingOrders.length} معلقة، ${preparingOrders.length} قيد التحضير`
                  : `${pendingOrders.length} pending, ${preparingOrders.length} preparing`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700">
              <Timer className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-mono text-slate-300">{now.toLocaleTimeString()}</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => refetch()}
              className="text-slate-300 hover:text-white"
              disabled={ordersLoading}
            >
              <RefreshCw className={`w-4 h-4 ${ordersLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Kanban Columns */}
        {ordersLoading && pendingOrders.length === 0 && preparingOrders.length === 0 ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="animate-spin w-8 h-8 text-slate-400" />
          </div>
        ) : pendingOrders.length === 0 && preparingOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-500">
            <UtensilsCrossed className="w-20 h-20 mb-4 opacity-20" />
            <p className="text-xl font-bold">{isRTL ? 'لا توجد طلبات حالياً' : 'No active orders'}</p>
            <p className="text-sm">{isRTL ? 'استمتع ببعض الراحة!' : 'Enjoy some rest!'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Column 1: Pending Orders */}
            <KanbanColumn
              title={isRTL ? 'الطلبات المعلقة' : 'Pending Orders'}
              orders={pendingOrders}
              status="pending"
              getTableLabel={getTableLabel}
              getTimeInKitchen={getTimeInKitchen}
              onAction={(orderId) => {
                if (!hasActiveShift) {
                  toast.error(isRTL ? 'يجب أن تكون لديك وردية نشطة' : 'You must have an active shift');
                  return;
                }
                markPreparingMutation.mutate({ orderId });
              }}
              actionLabel={isRTL ? 'بدء التحضير' : 'Start Cooking'}
              isLoading={markPreparingMutation.isPending}
              isRTL={isRTL}
              disabled={!hasActiveShift}
            />

            {/* Column 2: Preparing Orders */}
            <KanbanColumn
              title={isRTL ? 'قيد التحضير' : 'Preparing Orders'}
              orders={preparingOrders}
              status="preparing"
              getTableLabel={getTableLabel}
              getTimeInKitchen={getTimeInKitchen}
              onAction={(orderId) => {
                if (!hasActiveShift) {
                  toast.error(isRTL ? 'يجب أن تكون لديك وردية نشطة' : 'You must have an active shift');
                  return;
                }
                markReadyMutation.mutate({ orderId });
              }}
              actionLabel={isRTL ? 'جاهز للتسليم' : 'Mark as Ready'}
              isLoading={markReadyMutation.isPending}
              isRTL={isRTL}
              disabled={!hasActiveShift}
            />
          </div>
        )}
      </main>
    </div>
  );
}

// ── Status Normalization ───────────────────────────────────────────────────
function normalizeStatus(status: string): string {
  if (['pending', 'created'].includes(status)) return 'pending';
  if (['sent_to_kitchen', 'preparing'].includes(status)) return 'preparing';
  if (status === 'ready') return 'ready';
  if (status === 'served') return 'served';
  return status;
}

// ── Kanban Column Component ────────────────────────────────────────────────
interface KanbanColumnProps {
  title: string;
  orders: any[];
  status: 'pending' | 'preparing';
  getTableLabel: (order: any) => string;
  getTimeInKitchen: (createdAt: string) => string;
  onAction: (orderId: string) => void;
  actionLabel: string;
  isLoading: boolean;
  isRTL: boolean;
  disabled?: boolean;
}

function KanbanColumn({
  title,
  orders,
  status,
  getTableLabel,
  getTimeInKitchen,
  onAction,
  actionLabel,
  isLoading,
  isRTL,
  disabled = false,
}: KanbanColumnProps) {
  const columnColors = {
    pending: 'bg-slate-800 border-slate-700',
    preparing: 'bg-slate-800 border-orange-600',
  };

  const headerColors = {
    pending: 'bg-slate-700 border-b border-slate-600',
    preparing: 'bg-orange-900/30 border-b border-orange-600',
  };

  const badgeColors = {
    pending: 'bg-slate-600 text-slate-200',
    preparing: 'bg-orange-600 text-white',
  };

  return (
    <div className={`rounded-xl border-2 ${columnColors[status]} overflow-hidden flex flex-col h-[600px]`}>
      {/* Column Header */}
      <div className={`${headerColors[status]} p-4 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${badgeColors[status]}`}>
            {orders.length}
          </span>
        </div>
      </div>

      {/* Orders List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <CheckCircle2 className="w-12 h-12 mb-2 opacity-20" />
            <p className="text-sm font-medium">{isRTL ? 'لا توجد طلبات' : 'No orders'}</p>
          </div>
        ) : (
          orders.map((order) => (
            <OrderCardKitchen
              key={order.id}
              order={order}
              getTableLabel={getTableLabel}
              getTimeInKitchen={getTimeInKitchen}
              onAction={onAction}
              actionLabel={actionLabel}
              isLoading={isLoading}
              status={status}
              isRTL={isRTL}
              disabled={disabled}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Order Card for Kitchen ────────────────────────────────────────────────
interface OrderCardKitchenProps {
  order: any;
  getTableLabel: (order: any) => string;
  getTimeInKitchen: (createdAt: string) => string;
  onAction: (orderId: string) => void;
  actionLabel: string;
  isLoading: boolean;
  status: 'pending' | 'preparing';
  isRTL: boolean;
  disabled?: boolean;
}

function OrderCardKitchen({
  order,
  getTableLabel,
  getTimeInKitchen,
  onAction,
  actionLabel,
  isLoading,
  status,
  isRTL,
  disabled = false,
}: OrderCardKitchenProps) {
  const statusBgColors = {
    pending: 'bg-slate-700',
    preparing: 'bg-orange-700/40 border border-orange-600',
  };

  return (
    <Card className={`border-0 shadow-lg overflow-hidden rounded-lg ${statusBgColors[status]}`}>
      <CardHeader className="pb-2 pt-3 px-3 border-b border-slate-600/50">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-white">{getTableLabel(order)}</span>
          <span className="text-xs font-mono text-slate-400">#{order.id.slice(0, 6)}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
          <Clock className="w-3 h-3" />
          <span>{getTimeInKitchen(order.createdAt)}</span>
        </div>
      </CardHeader>

      <CardContent className="pt-3 px-3 pb-3">
        {/* Items */}
        <div className="space-y-2 mb-3 min-h-[60px]">
          {order.orderItems && order.orderItems.length > 0 ? (
            order.orderItems.map((item: any) => (
              <div key={item.id} className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded bg-orange-600 text-white text-xs font-bold flex items-center justify-center">
                  {item.quantity}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-100 truncate">
                    {item.menuItem?.name || `Item ${item.menuItemId?.slice(0, 6)}`}
                  </p>
                  {item.notes && (
                    <div className="mt-1 p-1.5 bg-red-900/30 border border-red-900/50 rounded text-xs text-red-300 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{item.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 italic">No items</p>
          )}
        </div>

        {/* Action Button */}
        <Button
          size="sm"
          className={`w-full text-white font-bold py-5 rounded-lg gap-2 ${
            status === 'pending'
              ? 'bg-orange-600 hover:bg-orange-700 disabled:bg-orange-600/50'
              : 'bg-green-600 hover:bg-green-700 disabled:bg-green-600/50'
          }`}
          onClick={() => onAction(order.id)}
          disabled={isLoading || disabled}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : status === 'pending' ? (
            <ChefHat className="w-4 h-4" />
          ) : (
            <Bell className="w-4 h-4" />
          )}
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
