import React, { useState, useEffect } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTranslation } from '@/locales/useTranslation';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DashboardNavigation } from '@/components/DashboardNavigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShoppingCart, LayoutDashboard, Table2, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

interface Order {
  id: string;
  tableNumber: number;
  status: string;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function WaiterOrders() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const { language } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const isRTL = language === 'ar';
  const cafeteriaId = user?.cafeteriaId;

  const navigationItems = [
    { label: isRTL ? 'لوحة التحكم' : 'Dashboard', path: '/dashboard/waiter', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: isRTL ? 'الطاولات' : 'Tables', path: '/dashboard/waiter/tables', icon: <Table2 className="w-5 h-5" /> },
    { label: isRTL ? 'الطلبات' : 'Orders', path: '/dashboard/waiter/orders', icon: <ShoppingCart className="w-5 h-5" /> },
  ];

  const fetchOrders = async () => {
    if (!cafeteriaId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select('id, table_number, status, total_amount, created_at, updated_at')
        .eq('cafeteria_id', cafeteriaId);

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((o: any) => ({
        id: o.id,
        tableNumber: o.table_number,
        status: o.status,
        totalAmount: o.total_amount,
        itemCount: 0,
        createdAt: o.created_at,
        updatedAt: o.updated_at,
      }));

      setOrders(mapped);
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      toast.error(isRTL ? 'خطأ في تحميل الطلبات' : 'Error loading orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [cafeteriaId, filter]);

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; color: string; icon: React.ReactNode } } = {
      created: { label: isRTL ? 'تم الإنشاء' : 'Created', color: 'bg-blue-100 text-blue-800', icon: <ShoppingCart className="w-3 h-3" /> },
      sent_to_kitchen: { label: isRTL ? 'مرسل للمطبخ' : 'Sent to Kitchen', color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-3 h-3" /> },
      preparing: { label: isRTL ? 'قيد التحضير' : 'Preparing', color: 'bg-orange-100 text-orange-800', icon: <AlertCircle className="w-3 h-3" /> },
      ready: { label: isRTL ? 'جاهز' : 'Ready', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-3 h-3" /> },
      completed: { label: isRTL ? 'مكتمل' : 'Completed', color: 'bg-gray-100 text-gray-800', icon: <CheckCircle className="w-3 h-3" /> },
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
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffHours > 0) {
      return `${diffHours}h ${diffMins % 60}m`;
    }
    return `${diffMins}m`;
  };

  const readyOrders = orders.filter(o => o.status === 'ready').length;
  const pendingOrders = orders.filter(o => !['completed'].includes(o.status)).length;

  return (
    <div className={`min-h-screen bg-gray-50 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <DashboardHeader showBackButton={true} showHomeButton={true}
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
                <p className="text-3xl font-bold">{orders.length}</p>
                <p className="text-xs opacity-80">{isRTL ? 'إجمالي الطلبات' : 'Total Orders'}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0">
              <CardContent className="p-4">
                <p className="text-3xl font-bold">{pendingOrders}</p>
                <p className="text-xs opacity-80">{isRTL ? 'طلبات معلقة' : 'Pending Orders'}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
              <CardContent className="p-4">
                <p className="text-3xl font-bold">{readyOrders}</p>
                <p className="text-xs opacity-80">{isRTL ? 'جاهزة للتسليم' : 'Ready for Delivery'}</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {['all', 'created', 'sent_to_kitchen', 'preparing', 'ready'].map((status) => (
              <Button
                key={status}
                variant={filter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(status)}
                className={filter === status ? 'bg-blue-600 hover:bg-blue-700' : ''}
              >
                {status === 'all'
                  ? (isRTL ? 'الكل' : 'All')
                  : status === 'created'
                  ? (isRTL ? 'تم الإنشاء' : 'Created')
                  : status === 'sent_to_kitchen'
                  ? (isRTL ? 'مرسل للمطبخ' : 'Sent to Kitchen')
                  : status === 'preparing'
                  ? (isRTL ? 'قيد التحضير' : 'Preparing')
                  : (isRTL ? 'جاهز' : 'Ready')}
              </Button>
            ))}
          </div>

          {/* Orders Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="text-center py-12 text-gray-400">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
              ) : orders.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">{isRTL ? 'لا توجد طلبات' : 'No orders found'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>{isRTL ? 'رقم الطاولة' : 'Table #'}</TableHead>
                        <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                        <TableHead>{isRTL ? 'المبلغ' : 'Amount'}</TableHead>
                        <TableHead>{isRTL ? 'الوقت المنقضي' : 'Elapsed Time'}</TableHead>
                        <TableHead>{isRTL ? 'تم الإنشاء' : 'Created'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
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
