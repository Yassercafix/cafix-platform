import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import {
  Store, Users, ShoppingCart, Table2, UtensilsCrossed,
  BarChart3, LogOut, DollarSign, LayoutDashboard,
  RefreshCw, ChevronRight, Layers
} from 'lucide-react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTranslation } from '@/locales/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';
import { trpc } from '@/lib/trpc';

export default function CafeteriaDashboard() {
  const { user, logout } = useAuth();
  const { language } = useTranslation();
  const [, setLocation] = useLocation();
  const cafeteriaId = user?.cafeteriaId;
  const isRTL = language === 'ar';

  const [cafeteriaInfo, setCafeteriaInfo] = useState<any>(null);
  const [stats, setStats] = useState({
    activeOrders: 0,
    totalRevenue: 0,
    staffCount: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(true);

  const menuSummaryQuery = trpc.menu.getMenuSummary.useQuery(
    { cafeteriaId: cafeteriaId || '' },
    { enabled: !!cafeteriaId }
  );

  const tablesQuery = trpc.tables.getTables.useQuery(
    { cafeteriaId: cafeteriaId || '' },
    { enabled: !!cafeteriaId }
  );

  const fetchDashboardData = async () => {
    if (!cafeteriaId) return;

    setRefreshing(true);

    try {
      const [cafRes, ordersRes, staffRes] = await Promise.all([
        supabase.from('cafeterias').select('*').eq('id', cafeteriaId).single(),
        supabase.from('orders').select('*').eq('cafeteriaId', cafeteriaId).order('createdAt', { ascending: false }).limit(50),
        supabase.from('cafeteriaStaff').select('id').eq('cafeteriaId', cafeteriaId),
      ]);

      if (cafRes.data) {
        setCafeteriaInfo(cafRes.data);
      }

      const orders = ordersRes.data || [];
      const activeOrders = orders.filter((order: any) => !['paid', 'cancelled'].includes(String(order.status || '').toLowerCase())).length;
      const totalRevenue = orders
        .filter((order: any) => String(order.status || '').toLowerCase() === 'paid')
        .reduce((sum: number, order: any) => sum + Number(order.totalAmount || 0), 0);

      setStats({
        activeOrders,
        totalRevenue,
        staffCount: (staffRes.data || []).length,
      });

      setRecentOrders(orders.slice(0, 5));
    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [cafeteriaId]);

  const tables = tablesQuery.data || [];
  const menuSummary = menuSummaryQuery.data;

  const derivedCounts = useMemo(() => {
    const availableTables = tables.filter((table: any) => table.status === 'available').length;

    return {
      totalCategories: menuSummary?.totalCategories || 0,
      totalItems: menuSummary?.totalItems || 0,
      availableItems: menuSummary?.availableItems || 0,
      totalTables: tables.length,
      availableTables,
      occupiedTables: Math.max(tables.length - availableTables, 0),
    };
  }, [menuSummary, tables]);

  const quickActions = [
    {
      titleAr: 'الفئات',
      titleEn: 'Categories',
      icon: Layers,
      color: 'from-amber-400 to-amber-600',
      bg: 'bg-amber-50',
      count: derivedCounts.totalCategories,
      path: '/dashboard/cafeteria-admin/menu',
    },
    {
      titleAr: 'العناصر',
      titleEn: 'Items',
      icon: UtensilsCrossed,
      color: 'from-orange-400 to-orange-600',
      bg: 'bg-orange-50',
      count: derivedCounts.totalItems,
      path: '/dashboard/cafeteria-admin/menu',
    },
    {
      titleAr: 'الموظفين',
      titleEn: 'Staff',
      icon: Users,
      color: 'from-green-400 to-green-600',
      bg: 'bg-green-50',
      count: stats.staffCount,
      path: '/dashboard/cafeteria-admin/staff',
    },
    {
      titleAr: 'الطاولات',
      titleEn: 'Tables',
      icon: Table2,
      color: 'from-purple-400 to-purple-600',
      bg: 'bg-purple-50',
      count: derivedCounts.totalTables,
      path: '/dashboard/cafeteria-admin/tables',
    },
    {
      titleAr: 'الطلبات',
      titleEn: 'Orders',
      icon: ShoppingCart,
      color: 'from-pink-400 to-pink-600',
      bg: 'bg-pink-50',
      count: stats.activeOrders,
      path: '/dashboard/cafeteria-admin/orders',
    },
    {
      titleAr: 'التقارير',
      titleEn: 'Reports',
      icon: BarChart3,
      color: 'from-indigo-400 to-indigo-600',
      bg: 'bg-indigo-50',
      count: null,
      path: '/dashboard/cafeteria-admin/reports',
    },
  ];

  const loading = refreshing || menuSummaryQuery.isLoading || tablesQuery.isLoading;

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 pb-20 ${isRTL ? 'rtl' : 'ltr'}`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <header className="bg-white border-b-4 border-blue-500 sticky top-0 z-40 shadow-lg">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-3 rounded-xl shadow-lg">
              <Store className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">
                {cafeteriaInfo?.name || (isRTL ? 'الكافيتريا' : 'Cafeteria')}
              </h1>
              <Badge className="bg-blue-100 text-blue-700 border-none text-xs font-bold uppercase">
                {isRTL ? 'لوحة التحكم' : 'Dashboard'}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                fetchDashboardData();
                menuSummaryQuery.refetch();
                tablesQuery.refetch();
              }}
              className="h-10 w-10 text-slate-600 hover:text-blue-600"
            >
              <RefreshCw className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="h-10 w-10 text-slate-600 hover:text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 max-w-4xl mx-auto">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="border-0 shadow-md bg-gradient-to-br from-blue-500 to-blue-700 text-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-8 h-8 opacity-80" />
                <div>
                  <p className="text-3xl font-black">{stats.activeOrders}</p>
                  <p className="text-xs opacity-80">{isRTL ? 'الطلبات النشطة' : 'Active Orders'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-green-500 to-green-700 text-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="w-8 h-8 opacity-80" />
                <div>
                  <p className="text-3xl font-black">{stats.totalRevenue.toFixed(0)}</p>
                  <p className="text-xs opacity-80">{isRTL ? 'الإيرادات' : 'Revenue'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-md mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-800">
              {isRTL ? 'عدادات النظام' : 'System Counters'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                <p className="text-2xl font-black text-amber-700">{derivedCounts.totalCategories}</p>
                <p className="text-xs text-amber-600">{isRTL ? 'الفئات' : 'Categories'}</p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
                <p className="text-2xl font-black text-orange-700">{derivedCounts.totalItems}</p>
                <p className="text-xs text-orange-600">{isRTL ? 'العناصر' : 'Items'}</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <p className="text-2xl font-black text-green-700">{derivedCounts.availableItems}</p>
                <p className="text-xs text-green-600">{isRTL ? 'العناصر المتاحة' : 'Available Items'}</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
                <p className="text-2xl font-black text-purple-700">{derivedCounts.totalTables}</p>
                <p className="text-xs text-purple-600">{isRTL ? 'الطاولات' : 'Tables'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-800">
              {isRTL ? 'وصول سريع' : 'Quick Access'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.path + action.titleEn}
                    onClick={() => setLocation(action.path)}
                    className={`${action.bg} p-4 rounded-xl flex flex-col items-center gap-2 transition-all hover:shadow-md hover:scale-105 active:scale-95`}
                  >
                    <div className={`w-10 h-10 bg-gradient-to-br ${action.color} rounded-lg flex items-center justify-center shadow-sm`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs font-bold text-slate-700 text-center">
                      {isRTL ? action.titleAr : action.titleEn}
                    </span>
                    {action.count !== null && (
                      <span className="text-lg font-black text-slate-800">{action.count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md mb-6">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-slate-800">
              {isRTL ? 'حالة الطاولات' : 'Tables Status'}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/dashboard/cafeteria-admin/tables')}
              className="text-blue-600 hover:text-blue-800 gap-1 text-xs"
            >
              {isRTL ? 'عرض الكل' : 'View All'}
              <ChevronRight className={`w-3 h-3 ${isRTL ? 'rotate-180' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-green-700">{derivedCounts.availableTables}</p>
                <p className="text-xs text-green-600">{isRTL ? 'متاحة' : 'Available'}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-red-700">{derivedCounts.occupiedTables}</p>
                <p className="text-xs text-red-600">{isRTL ? 'مشغولة' : 'Occupied'}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-blue-700">{derivedCounts.totalTables}</p>
                <p className="text-xs text-blue-600">{isRTL ? 'الإجمالي' : 'Total'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md mb-6">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-slate-800">
              {isRTL ? 'آخر الطلبات' : 'Recent Orders'}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/dashboard/cafeteria-admin/orders')}
              className="text-blue-600 hover:text-blue-800 gap-1 text-xs"
            >
              {isRTL ? 'عرض الكل' : 'View All'}
              <ChevronRight className={`w-3 h-3 ${isRTL ? 'rotate-180' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-6 text-center text-slate-500 text-sm">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
            ) : recentOrders.length === 0 ? (
              <div className="py-6 text-center text-slate-500 text-sm">{isRTL ? 'لا توجد طلبات بعد' : 'No orders yet'}</div>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order: any) => (
                  <div key={order.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div>
                      <p className="font-semibold text-slate-800">#{order.id?.slice?.(0, 8) || order.id}</p>
                      <p className="text-xs text-slate-500">{order.status}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">{Number(order.totalAmount || 0).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
