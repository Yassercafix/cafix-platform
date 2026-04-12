import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTranslation } from '@/locales/useTranslation';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DashboardNavigation } from '@/components/DashboardNavigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  UtensilsCrossed,
  LayoutDashboard,
  Clock,
  ChefHat,
  Bell,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Flame,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

export default function ChefKitchenBoard() {
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const { language } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [now, setNow] = useState(new Date());
  const [shiftWarning, setShiftWarning] = useState(false);
  const [lastOrderCount, setLastOrderCount] = useState(0);

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
    { enabled: !!cafeteriaId, refetchInterval: 3000 }
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
  const { pendingOrders, preparingOrders, readyOrders } = useMemo(() => {
    if (!allOrders) return { pendingOrders: [], preparingOrders: [], readyOrders: [] };

    const normalized = allOrders
      .map((o: any) => ({
        ...o,
        status: normalizeStatus(o.status),
      }))
      .filter((o: any) => ['pending', 'preparing', 'ready'].includes(o.status));

    // Notify on new pending orders
    const currentPendingCount = normalized.filter((o: any) => o.status === 'pending').length;
    if (currentPendingCount > lastOrderCount && lastOrderCount > 0) {
      playNotificationSound();
      toast.info(isRTL ? 'طلب جديد!' : 'New order!', { duration: 3000 });
    }
    setLastOrderCount(currentPendingCount);

    return {
      pendingOrders: normalized.filter((o: any) => o.status === 'pending').sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
      preparingOrders: normalized.filter((o: any) => o.status === 'preparing').sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
      readyOrders: normalized.filter((o: any) => o.status === 'ready').sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    };
  }, [allOrders, lastOrderCount]);

  const getTimeInKitchen = (createdAt: string) => {
    const diff = Math.floor((now.getTime() - new Date(createdAt).getTime()) / 60000);
    return `${diff} ${isRTL ? 'دقيقة' : 'min'}`;
  };

  const getTableLabel = (order: any) => {
    if (order.table?.tableNumber) return `Table ${order.table.tableNumber}`;
    if (order.tableId) return `Table ${order.tableId.slice(0, 6)}`;
    return 'No Table';
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <DashboardHeader
        showBackButton={true}
        showHomeButton={true}
        title={isRTL ? 'لوحة تحكم المطبخ' : 'Kitchen Display System'}
        onMenuClick={() => setMenuOpen(true)}
      />
      <DashboardNavigation isOpen={menuOpen} onClose={() => setMenuOpen(false)} items={navigationItems} />

      <main className="p-4 md:p-8 max-w-7xl mx-auto">
        {/* Shift Warning */}
        {shiftWarning && (
          <div className="mb-6 p-4 rounded-lg bg-red-900/40 border-2 border-red-500 flex items-center gap-3 animate-pulse">
            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0" />
            <div>
              <p className="font-bold text-red-300">
                {isRTL ? 'لا توجد وردية نشطة' : 'No Active Shift'}
              </p>
              <p className="text-xs text-red-200 mt-1">
                {isRTL ? 'يجب أن تكون لديك وردية نشطة لتنفيذ الإجراءات' : 'You must have an active shift to perform actions'}
              </p>
            </div>
          </div>
        )}

        {/* Header Stats */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-4 rounded-xl shadow-lg shadow-orange-900/50">
              <ChefHat className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight text-white">
                {isRTL ? 'الطلبات النشطة' : 'Active Orders'}
              </h2>
              <p className="text-slate-300 text-sm mt-1">
                {isRTL
                  ? `${pendingOrders.length} معلقة • ${preparingOrders.length} قيد التحضير • ${readyOrders.length} جاهزة`
                  : `${pendingOrders.length} Pending • ${preparingOrders.length} Preparing • ${readyOrders.length} Ready`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-700/50 p-3 rounded-lg border border-slate-600">
              <Clock className="w-4 h-4 text-orange-400" />
              <span className="text-xs font-mono text-slate-200">{now.toLocaleTimeString()}</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => refetch()}
              className="text-slate-300 hover:text-white hover:bg-slate-700"
              disabled={ordersLoading}
            >
              <RefreshCw className={`w-5 h-5 ${ordersLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* 3-Column Kanban Board */}
        {ordersLoading && pendingOrders.length === 0 && preparingOrders.length === 0 && readyOrders.length === 0 ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="animate-spin w-12 h-12 text-slate-400" />
          </div>
        ) : pendingOrders.length === 0 && preparingOrders.length === 0 && readyOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400">
            <UtensilsCrossed className="w-24 h-24 mb-4 opacity-30" />
            <p className="text-2xl font-bold">{isRTL ? 'لا توجد طلبات حالياً' : 'No active orders'}</p>
            <p className="text-sm mt-2">{isRTL ? 'استمتع ببعض الراحة!' : 'Enjoy some rest!'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
              icon={<AlertCircle className="w-6 h-6" />}
              bgColor="from-red-900/20 to-red-800/10"
              borderColor="border-red-600"
              headerBg="bg-red-900/40"
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
              icon={<Flame className="w-6 h-6" />}
              bgColor="from-orange-900/20 to-orange-800/10"
              borderColor="border-orange-600"
              headerBg="bg-orange-900/40"
            />

            {/* Column 3: Ready Orders */}
            <KanbanColumn
              title={isRTL ? 'جاهزة للتسليم' : 'Ready for Pickup'}
              orders={readyOrders}
              status="ready"
              getTableLabel={getTableLabel}
              getTimeInKitchen={getTimeInKitchen}
              onAction={() => {
                toast.info(isRTL ? 'انتظر النادل لتسليم الطلب' : 'Waiting for waiter to pickup');
              }}
              actionLabel={isRTL ? 'في انتظار النادل' : 'Awaiting Pickup'}
              isLoading={false}
              isRTL={isRTL}
              disabled={true}
              icon={<CheckCircle className="w-6 h-6" />}
              bgColor="from-green-900/20 to-green-800/10"
              borderColor="border-green-600"
              headerBg="bg-green-900/40"
              isReadyColumn={true}
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

// ── Play Notification Sound ────────────────────────────────────────────────
function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (e) {
    console.log('Audio notification not available');
  }
}

// ── Kanban Column Component ────────────────────────────────────────────────
interface KanbanColumnProps {
  title: string;
  orders: any[];
  status: 'pending' | 'preparing' | 'ready';
  getTableLabel: (order: any) => string;
  getTimeInKitchen: (createdAt: string) => string;
  onAction: (orderId: string) => void;
  actionLabel: string;
  isLoading: boolean;
  isRTL: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  bgColor: string;
  borderColor: string;
  headerBg: string;
  isReadyColumn?: boolean;
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
  icon,
  bgColor,
  borderColor,
  headerBg,
  isReadyColumn = false,
}: KanbanColumnProps) {
  return (
    <div className={`rounded-xl border-2 ${borderColor} bg-gradient-to-b ${bgColor} overflow-hidden flex flex-col h-[700px] shadow-2xl`}>
      {/* Column Header */}
      <div className={`${headerBg} p-5 flex items-center justify-between border-b border-slate-600/50`}>
        <div className="flex items-center gap-3">
          <div className="text-slate-300">{icon}</div>
          <div>
            <h3 className="text-lg font-bold text-white">{title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{orders.length} {isRTL ? 'طلب' : 'orders'}</p>
          </div>
        </div>
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/20 text-white text-sm font-bold">
          {orders.length}
        </span>
      </div>

      {/* Orders List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <CheckCircle className="w-16 h-16 mb-3 opacity-20" />
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
              isReadyColumn={isReadyColumn}
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
  status: 'pending' | 'preparing' | 'ready';
  isRTL: boolean;
  disabled?: boolean;
  isReadyColumn?: boolean;
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
  isReadyColumn = false,
}: OrderCardKitchenProps) {
  const statusBgColors = {
    pending: 'bg-red-900/30 border border-red-700/50',
    preparing: 'bg-orange-900/30 border border-orange-700/50',
    ready: 'bg-green-900/30 border border-green-700/50',
  };

  const buttonColors = {
    pending: 'bg-red-600 hover:bg-red-700 disabled:bg-red-600/50',
    preparing: 'bg-orange-600 hover:bg-orange-700 disabled:bg-orange-600/50',
    ready: 'bg-green-600 hover:bg-green-700 disabled:bg-green-600/50',
  };

  return (
    <Card className={`border-0 shadow-lg overflow-hidden rounded-lg ${statusBgColors[status]} bg-slate-800`}>
      <CardHeader className="pb-3 pt-4 px-4 border-b border-slate-600/50">
        <div className="flex items-center justify-between">
          <span className="text-3xl font-black text-white">{getTableLabel(order)}</span>
          <span className="text-xs font-mono text-slate-400 bg-slate-700/50 px-2 py-1 rounded">#{order.id.slice(0, 6)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-300 mt-2">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-semibold">{getTimeInKitchen(order.createdAt)}</span>
        </div>
      </CardHeader>

      <CardContent className="pt-4 px-4 pb-4">
        {/* Items */}
        <div className="space-y-2 mb-4 min-h-[80px] max-h-[160px] overflow-y-auto">
          {order.orderItems && order.orderItems.length > 0 ? (
            order.orderItems.map((item: any) => (
              <div key={item.id} className="flex items-start gap-3 p-2 bg-slate-700/40 rounded-lg">
                <span className="flex-shrink-0 w-6 h-6 rounded bg-orange-500 text-white text-xs font-bold flex items-center justify-center">
                  {item.quantity}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-100 truncate">
                    {item.menuItem?.name || `Item ${item.menuItemId?.slice(0, 6)}`}
                  </p>
                  {item.notes && (
                    <div className="mt-1.5 p-1.5 bg-red-900/40 border border-red-700/50 rounded text-xs text-red-300 flex items-start gap-1.5">
                      <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      <span className="truncate">{item.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 italic">{isRTL ? 'لا توجد عناصر' : 'No items'}</p>
          )}
        </div>

        {/* Action Button */}
        <Button
          size="sm"
          className={`w-full text-white font-bold py-6 rounded-lg gap-2 transition-all ${buttonColors[status]}`}
          onClick={() => onAction(order.id)}
          disabled={isLoading || disabled}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : status === 'pending' ? (
            <Flame className="w-4 h-4" />
          ) : status === 'preparing' ? (
            <Bell className="w-4 h-4" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
