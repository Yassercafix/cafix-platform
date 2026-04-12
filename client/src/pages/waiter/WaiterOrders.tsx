import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTranslation } from '@/locales/useTranslation';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DashboardNavigation } from '@/components/DashboardNavigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShoppingCart, LayoutDashboard, Table2, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface Order {
  id: string;
  tableNumber: string;
  status: string;
  totalAmount: number;
  createdAt: string;
}

type FilterStatus = 'all' | 'pending' | 'preparing' | 'ready';

function normalizeStatus(status: string): string {
  if (['pending', 'created'].includes(status)) return 'pending';
  if (['sent_to_kitchen', 'preparing'].includes(status)) return 'preparing';
  if (status === 'ready') return 'ready';
  if (status === 'served') return 'served';
  return status;
}

export default function WaiterOrders() {
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const { language } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [now, setNow] = useState(new Date());

  const isRTL = language === 'ar';
  const cafeteriaId = user?.cafeteriaId;

  // Tick every second for elapsed time
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const navigationItems = [
    { label: isRTL ? 'لوحة التحكم' : 'Dashboard', path: '/dashboard/waiter', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: isRTL ? 'الطاولات' : 'Tables', path: '/dashboard/waiter/tables', icon: <Table2 className="w-5 h-5" /> },
    { label: isRTL ? 'الطلبات' : 'Orders', path: '/dashboard/waiter/orders', icon: <ShoppingCart className="w-5 h-5" /> },
  ];

  // Fetch orders via tRPC
  const { data: allOrders, isLoading: ordersLoading } = trpc.ordersPhase2.getOrders.useQuery(
    { cafeteriaId: cafeteriaId || '' },
    { enabled: !!cafeteriaId, refetchInterval: 5000 }
  );

  // Normalize and filter orders
  const filteredOrders = useMemo(() => {
    if (!allOrders) return [];

    let normalized = allOrders.map((o: any) => ({
      id: o.id,
      tableNumber: o.table?.tableNumber ? `Table ${o.table.tableNumber}` : o.tableId ? `Table ${o.tableId.slice(0, 6)}` : 'No Table',
      status: normalizeStatus(o.status),
      totalAmount: Number(o.totalAmount),
      createdAt: o.createdAt,
    }));

    // Filter out served orders
    normalized = normalized.filter((o: any) => o.status !== 'served');

    // Apply filter
    if (filter !== 'all') {
      normalized = normalized.filter((o: any) => o.status === filter);
    }

    return normalized;
  }, [allOrders, filter]);

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; color: string; icon: React.ReactNode } } = {
      pending: { label: isRTL ? 'معلق' : 'Pending', color: 'bg-gray-100 text-gray-800', icon: <Clock className="w-3 h-3" /> },
      preparing: { label: isRTL ? 'قيد التحضير' : 'Preparing', color: 'bg-yellow-100 text-yellow-800', icon: <AlertCircle className="w-3 h-3" /> },
      ready: { label: isRTL ? 'جاهز' : 'Ready', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-3 h-3" /> },
    };
    const statusInfo = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800', icon: null };
    return (
      <Badge className={`${statusInfo.color} border-0 flex items-center gap-1 w-fit`}>
        {statusInfo.icon}
        {statusInfo.label}
      </Badge>
    );
  };

  const getTimeElapsed = (createdAt: string) => {
    const diffMs = now.getTime() - new Date(createdAt).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffHours > 0) {
      return `${diffHours}h ${diffMins % 60}m`;
    }
    if (diffMins > 0) {
      return `${diffMins}m ${diffSecs}s`;
    }
    return `${diffSecs}s`;
  };

  const readyCount = filteredOrders.filter(o => o.status === 'ready').length;
  const pendingCount = filteredOrders.filter(o => o.status === 'pending').length;

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin w-8 h-8 text-gray-400" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <DashboardHeader
        showBackButton={true}
        showHomeButton={true}
        title={isRTL ? 'الطلبات' : 'Orders'}
        icon={<ShoppingCart className="w-5 h-5" />}
        onMenuToggle={setMenuOpen}
        menuOpen={menuOpen}
      />
      <div className="flex">
        <DashboardNavigation items={navigationItems} open={menuOpen} onClose={() => setMenuOpen(false)} />
        <main className="flex-1 p-4 md:p-8">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
              <CardContent className="p-4">
                <p className="text-3xl font-bold">{filteredOrders.length}</p>
                <p className="text-xs opacity-80">{isRTL ? 'إجمالي الطلبات' : 'Total Orders'}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0">
              <CardContent className="p-4">
                <p className="text-3xl font-bold">{pendingCount}</p>
                <p className="text-xs opacity-80">{isRTL ? 'طلبات معلقة' : 'Pending Orders'}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
              <CardContent className="p-4">
                <p className="text-3xl font-bold">{readyCount}</p>
                <p className="text-xs opacity-80">{isRTL ? 'جاهزة للتسليم' : 'Ready for Delivery'}</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {(['all', 'pending', 'preparing', 'ready'] as const).map((status) => (
              <Button
                key={status}
                variant={filter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(status)}
                className={filter === status ? 'bg-blue-600 hover:bg-blue-700' : ''}
              >
                {status === 'all'
                  ? isRTL ? 'الكل' : 'All'
                  : status === 'pending'
                  ? isRTL ? 'معلق' : 'Pending'
                  : status === 'preparing'
                  ? isRTL ? 'قيد التحضير' : 'Preparing'
                  : isRTL ? 'جاهز' : 'Ready'}
              </Button>
            ))}
          </div>

          {/* Orders Table */}
          <Card>
            <CardContent className="p-0">
              {ordersLoading ? (
                <div className="text-center py-12 text-gray-400 flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin w-4 h-4" />
                  {isRTL ? 'جاري التحميل...' : 'Loading...'}
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">{isRTL ? 'لا توجد طلبات' : 'No orders found'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>{isRTL ? 'الطاولة' : 'Table'}</TableHead>
                        <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                        <TableHead>{isRTL ? 'المبلغ' : 'Amount'}</TableHead>
                        <TableHead>{isRTL ? 'الوقت المنقضي' : 'Elapsed Time'}</TableHead>
                        <TableHead>{isRTL ? 'تم الإنشاء' : 'Created'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => (
                        <TableRow key={order.id} className="hover:bg-gray-50">
                          <TableCell className="font-bold text-lg text-gray-900">{order.tableNumber}</TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell className="font-semibold">{order.totalAmount.toFixed(2)}</TableCell>
                          <TableCell className="text-sm text-gray-600">{getTimeElapsed(order.createdAt)}</TableCell>
                          <TableCell className="text-xs text-gray-500">
                            {new Date(order.createdAt).toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
