import React, { useState, useEffect } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTranslation } from '@/locales/useTranslation';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DashboardNavigation } from '@/components/DashboardNavigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  ShoppingCart, LayoutDashboard, UtensilsCrossed, Table2, Users, BarChart3, CreditCard, Settings,
  Eye, CheckCircle, XCircle, Clock, RefreshCw, DollarSign, Package, AlertCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

interface OrderItem {
  id: string;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: string;
  notes?: string;
}

interface Order {
  id: string;
  tableNumber?: number;
  status: string;
  totalAmount: number;
  createdAt: string;
  closedAt?: string;
  items: OrderItem[];
  waiterName?: string;
}

export default function CafeteriaOrders() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const { language } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isRTL = language === 'ar';

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const cafeteriaId = user?.cafeteriaId;

  const navigationItems = [
    { label: isRTL ? 'لوحة التحكم' : 'Dashboard', path: '/dashboard/cafeteria-admin', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: isRTL ? 'المنيو' : 'Menu', path: '/dashboard/cafeteria-admin/menu', icon: <UtensilsCrossed className="w-5 h-5" /> },
    { label: isRTL ? 'الطاولات' : 'Tables', path: '/dashboard/cafeteria-admin/tables', icon: <Table2 className="w-5 h-5" /> },
    { label: isRTL ? 'الموظفين' : 'Staff', path: '/dashboard/cafeteria-admin/staff', icon: <Users className="w-5 h-5" /> },
    { label: isRTL ? 'الطلبات' : 'Orders', path: '/dashboard/cafeteria-admin/orders', icon: <ShoppingCart className="w-5 h-5" /> },
    { label: isRTL ? 'التقارير' : 'Reports', path: '/dashboard/cafeteria-admin/reports', icon: <BarChart3 className="w-5 h-5" /> },
    { label: isRTL ? 'شحن النقاط' : 'Recharge', path: '/dashboard/cafeteria-admin/recharge', icon: <CreditCard className="w-5 h-5" /> },
    { label: isRTL ? 'الإعدادات' : 'Settings', path: '/dashboard/cafeteria-admin/settings', icon: <Settings className="w-5 h-5" /> },
  ];

  const fetchOrders = async () => {
    if (!cafeteriaId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          cafeteria_tables(table_number),
          cafeteria_staff(name),
          order_items(
            id,
            quantity,
            unit_price,
            total_price,
            status,
            notes,
            menu_items(name)
          )
        `)
        .eq('cafeteria_id', cafeteriaId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      const mapped: Order[] = (data || []).map((o: any) => ({
        id: o.id,
        tableNumber: o.cafeteria_tables?.table_number,
        status: o.status,
        totalAmount: Number(o.total_amount || 0),
        createdAt: o.created_at,
        closedAt: o.closed_at,
        waiterName: o.cafeteria_staff?.name,
        items: (o.order_items || []).map((item: any) => ({
          id: item.id,
          menuItemName: item.menu_items?.name || 'Unknown',
          quantity: item.quantity,
          unitPrice: Number(item.unit_price),
          totalPrice: Number(item.total_price),
          status: item.status,
          notes: item.notes,
        })),
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
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [cafeteriaId, statusFilter]);

  const handleCloseOrder = async () => {
    if (!selectedOrder) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
        })
        .eq('id', selectedOrder.id);
      if (error) throw error;
      toast.success(isRTL ? 'تم إغلاق الطلب بنجاح' : 'Order closed successfully');
      setShowCloseDialog(false);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'خطأ في إغلاق الطلب' : 'Error closing order'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', selectedOrder.id);
      if (error) throw error;
      toast.success(isRTL ? 'تم إلغاء الطلب' : 'Order cancelled');
      setShowCancelDialog(false);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'خطأ في إلغاء الطلب' : 'Error cancelling order'));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; labelAr: string; color: string; icon: React.ReactNode }> = {
      open: { label: 'Open', labelAr: 'مفتوح', color: 'bg-blue-100 text-blue-700', icon: <Clock className="w-3 h-3" /> },
      closed: { label: 'Closed', labelAr: 'مغلق', color: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-3 h-3" /> },
      cancelled: { label: 'Cancelled', labelAr: 'ملغي', color: 'bg-red-100 text-red-700', icon: <XCircle className="w-3 h-3" /> },
    };
    return configs[status] || configs.open;
  };

  const getItemStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; labelAr: string; color: string }> = {
      pending: { label: 'Pending', labelAr: 'قيد الانتظار', color: 'bg-yellow-100 text-yellow-700' },
      preparing: { label: 'Preparing', labelAr: 'قيد التحضير', color: 'bg-orange-100 text-orange-700' },
      ready: { label: 'Ready', labelAr: 'جاهز', color: 'bg-green-100 text-green-700' },
      served: { label: 'Served', labelAr: 'تم التقديم', color: 'bg-blue-100 text-blue-700' },
      cancelled: { label: 'Cancelled', labelAr: 'ملغي', color: 'bg-red-100 text-red-700' },
    };
    return configs[status] || configs.pending;
  };

  const openOrders = orders.filter(o => o.status === 'open').length;
  const closedOrders = orders.filter(o => o.status === 'closed').length;
  const totalRevenue = orders.filter(o => o.status === 'closed').reduce((s, o) => s + o.totalAmount, 0);

  const filteredOrders = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter);

  return (
    <div className={`min-h-screen bg-gray-50 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <DashboardHeader showBackButton={true} showHomeButton={true}
        title={isRTL ? 'إدارة الطلبات' : 'Orders Management'}
        icon={<ShoppingCart className="w-5 h-5" />}
        onMenuToggle={setMenuOpen}
        menuOpen={menuOpen}
      />
      <div className="flex">
        <DashboardNavigation items={navigationItems} open={menuOpen} onClose={() => setMenuOpen(false)} />
        <main className="flex-1 p-4 md:p-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{openOrders}</p>
                  <p className="text-xs text-gray-500">{isRTL ? 'طلبات مفتوحة' : 'Open Orders'}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{closedOrders}</p>
                  <p className="text-xs text-gray-500">{isRTL ? 'طلبات مغلقة' : 'Closed Orders'}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{totalRevenue.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">{isRTL ? 'الإيرادات' : 'Revenue'}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters & Actions */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isRTL ? 'جميع الطلبات' : 'All Orders'}</SelectItem>
                <SelectItem value="open">{isRTL ? 'مفتوحة' : 'Open'}</SelectItem>
                <SelectItem value="closed">{isRTL ? 'مغلقة' : 'Closed'}</SelectItem>
                <SelectItem value="cancelled">{isRTL ? 'ملغاة' : 'Cancelled'}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchOrders} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              {isRTL ? 'تحديث' : 'Refresh'}
            </Button>
          </div>

          {/* Orders Table */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {loading ? (
                <div className="text-center py-12 text-gray-400">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
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
                        <TableHead>{isRTL ? 'رقم الطلب' : 'Order ID'}</TableHead>
                        <TableHead>{isRTL ? 'الطاولة' : 'Table'}</TableHead>
                        <TableHead>{isRTL ? 'الأصناف' : 'Items'}</TableHead>
                        <TableHead>{isRTL ? 'الإجمالي' : 'Total'}</TableHead>
                        <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                        <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                        <TableHead>{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => {
                        const statusCfg = getStatusConfig(order.status);
                        return (
                          <TableRow key={order.id} className="hover:bg-gray-50">
                            <TableCell className="font-mono text-xs text-gray-600">
                              #{order.id.slice(0, 8)}
                            </TableCell>
                            <TableCell className="font-medium">
                              {order.tableNumber
                                ? (isRTL ? `طاولة ${order.tableNumber}` : `Table ${order.tableNumber}`)
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Package className="w-3 h-3 text-gray-400" />
                                <span className="text-gray-700">{order.items.length}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold text-green-700">
                              {order.totalAmount.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium w-fit ${statusCfg.color}`}>
                                {statusCfg.icon}
                                {isRTL ? statusCfg.labelAr : statusCfg.label}
                              </span>
                            </TableCell>
                            <TableCell className="text-gray-500 text-sm">
                              {new Date(order.createdAt).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                              })}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                  onClick={() => { setSelectedOrder(order); setShowDetailDialog(true); }}
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>
                                {order.status === 'open' && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-green-600 hover:text-green-800 hover:bg-green-50 text-xs"
                                      onClick={() => { setSelectedOrder(order); setShowCloseDialog(true); }}
                                    >
                                      <CheckCircle className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50 text-xs"
                                      onClick={() => { setSelectedOrder(order); setShowCancelDialog(true); }}
                                    >
                                      <XCircle className="w-3 h-3" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>
              {isRTL ? 'تفاصيل الطلب' : 'Order Details'} #{selectedOrder?.id.slice(0, 8)}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-gray-500 text-xs">{isRTL ? 'الطاولة' : 'Table'}</p>
                  <p className="font-semibold text-gray-800">
                    {selectedOrder.tableNumber
                      ? (isRTL ? `طاولة ${selectedOrder.tableNumber}` : `Table ${selectedOrder.tableNumber}`)
                      : '-'}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-gray-500 text-xs">{isRTL ? 'الحالة' : 'Status'}</p>
                  <p className={`font-semibold ${getStatusConfig(selectedOrder.status).color.replace('bg-', 'text-').replace('-100', '-700')}`}>
                    {isRTL ? getStatusConfig(selectedOrder.status).labelAr : getStatusConfig(selectedOrder.status).label}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-gray-500 text-xs">{isRTL ? 'التاريخ' : 'Date'}</p>
                  <p className="font-semibold text-gray-800 text-xs">
                    {new Date(selectedOrder.createdAt).toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-gray-500 text-xs">{isRTL ? 'الإجمالي' : 'Total'}</p>
                  <p className="font-bold text-green-700">{selectedOrder.totalAmount.toFixed(2)}</p>
                </div>
              </div>

              <div>
                <p className="font-semibold text-gray-800 mb-2">{isRTL ? 'الأصناف المطلوبة' : 'Order Items'}</p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedOrder.items.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-4">{isRTL ? 'لا توجد أصناف' : 'No items'}</p>
                  ) : (
                    selectedOrder.items.map((item) => {
                      const itemCfg = getItemStatusConfig(item.status);
                      return (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-gray-800 text-sm">{item.menuItemName}</p>
                            {item.notes && (
                              <p className="text-xs text-gray-400">{item.notes}</p>
                            )}
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${itemCfg.color}`}>
                              {isRTL ? itemCfg.labelAr : itemCfg.label}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">x{item.quantity}</p>
                            <p className="font-semibold text-green-700 text-sm">{item.totalPrice.toFixed(2)}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {selectedOrder.status === 'open' && (
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => { setShowDetailDialog(false); setShowCloseDialog(true); }}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {isRTL ? 'إغلاق الطلب' : 'Close Order'}
                  </Button>
                  <Button
                    onClick={() => { setShowDetailDialog(false); setShowCancelDialog(true); }}
                    variant="outline"
                    className="flex-1 text-red-600 border-red-200 hover:bg-red-50 gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    {isRTL ? 'إلغاء الطلب' : 'Cancel Order'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Close Order Confirmation */}
      <AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRTL ? 'إغلاق الطلب' : 'Close Order'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL
                ? `هل أنت متأكد من إغلاق الطلب #${selectedOrder?.id.slice(0, 8)}؟ سيتم احتساب المبلغ ${selectedOrder?.totalAmount.toFixed(2)}.`
                : `Close order #${selectedOrder?.id.slice(0, 8)}? Total: ${selectedOrder?.totalAmount.toFixed(2)}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleCloseOrder} disabled={submitting} className="bg-green-600 hover:bg-green-700">
              {submitting ? '...' : (isRTL ? 'إغلاق' : 'Close')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Order Confirmation */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRTL ? 'إلغاء الطلب' : 'Cancel Order'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL
                ? `هل أنت متأكد من إلغاء الطلب #${selectedOrder?.id.slice(0, 8)}؟`
                : `Cancel order #${selectedOrder?.id.slice(0, 8)}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? 'تراجع' : 'Back'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelOrder} disabled={submitting} className="bg-red-600 hover:bg-red-700">
              {submitting ? '...' : (isRTL ? 'إلغاء الطلب' : 'Cancel Order')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
