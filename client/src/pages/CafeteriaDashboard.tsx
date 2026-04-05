import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  Store, Users, Settings, ShoppingCart, Table2, UtensilsCrossed,
  CreditCard, BarChart3, LogOut, TrendingUp, DollarSign,
  LayoutDashboard, Languages, RefreshCw, ChevronRight
} from 'lucide-react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTranslation } from '@/locales/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabaseClient';

export default function CafeteriaDashboard() {
  const { user, logout } = useAuth();
  const { language, setLanguage } = useTranslation();
  const [, setLocation] = useLocation();
  const cafeteriaId = user?.cafeteriaId;
  const isRTL = language === 'ar';

  const [cafeteriaInfo, setCafeteriaInfo] = useState<any>(null);
  const [stats, setStats] = useState({
    activeOrders: 0,
    totalRevenue: 0,
    staffCount: 0,
    tablesCount: 0,
    menuItemsCount: 0,
    availableTables: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    if (!cafeteriaId) return;
    try {
      const [cafRes, ordersRes, staffRes, tablesRes, menuRes] = await Promise.all([
        supabase.from('cafeterias').select('*').eq('id', cafeteriaId).single(),
        supabase.from('orders').select('*').eq('cafeteriaId', cafeteriaId).order('createdAt', { ascending: false }).limit(50),
        supabase.from('cafeteriaStaff').select('id').eq('cafeteriaId', cafeteriaId),
        supabase.from('cafeteriaTables').select('id, status').eq('cafeteriaId', cafeteriaId),
        supabase.from('menuItems').select('id').eq('cafeteriaId', cafeteriaId),
      ]);

      if (cafRes.data) setCafeteriaInfo(cafRes.data);

      const orders = ordersRes.data || [];
      const activeOrders = orders.filter((o: any) => o.status === 'open').length;
      const totalRevenue = orders
        .filter((o: any) => o.status === 'closed')
        .reduce((s: number, o: any) => s + Number(o.totalAmount || 0), 0);

      const tables = tablesRes.data || [];
      const availableTables = tables.filter((t: any) => t.status === 'available').length;

      setStats({
        activeOrders,
        totalRevenue,
        staffCount: (staffRes.data || []).length,
        tablesCount: tables.length,
        menuItemsCount: (menuRes.data || []).length,
        availableTables,
      });

      setRecentOrders(orders.slice(0, 5));
    } catch (err: any) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [cafeteriaId]);

  const quickActions = [
    {
      titleAr: 'المنيو',
      titleEn: 'Menu',
      icon: UtensilsCrossed,
      color: 'from-orange-400 to-orange-600',
      bg: 'bg-orange-50',
      count: stats.menuItemsCount,
      path: '/dashboard/cafeteria-admin/menu',
    },
    {
      titleAr: 'لوحة التحكم',
      titleEn: 'Dashboard',
      icon: LayoutDashboard,
      color: 'from-blue-400 to-blue-600',
      bg: 'bg-blue-50',
      count: stats.activeOrders,
      path: '/dashboard/cafeteria-admin',
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
      count: stats.tablesCount,
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


  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 pb-20 ${isRTL ? 'rtl' : 'ltr'}`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
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
              onClick={fetchDashboardData}
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
        {/* KPI Stats */}
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

        {/* Quick Access Grid */}
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
                    key={action.path}
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

        {/* Tables Status */}
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
                <p className="text-2xl font-black text-green-700">{stats.availableTables}</p>
                <p className="text-xs text-green-600">{isRTL ? 'متاحة' : 'Available'}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-red-700">
                  {stats.tablesCount - stats.availableTables}
                </p>
                <p className="text-xs text-red-600">{isRTL ? 'مشغولة' : 'Occupied'}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-blue-700">{stats.tablesCount}</p>
                <p className="text-xs text-blue-600">{isRTL ? 'الإجمالي' : 'Total'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
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
              <p className="text-center text-gray-400 py-4">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
            ) : recentOrders.length === 0 ? (
              <div className="text-center py-6">
                <ShoppingCart className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">{isRTL ? 'لا توجد طلبات بعد' : 'No orders yet'}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentOrders.map((order: any) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200"
                  >
                    <div>
                      <p className="font-bold text-slate-900 text-sm">#{order.id.slice(0, 8)}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(order.created_at).toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US', {
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={`text-xs border-none ${
                          order.status === 'open'
                            ? 'bg-blue-100 text-blue-700'
                            : order.status === 'closed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {order.status === 'open'
                          ? (isRTL ? 'مفتوح' : 'Open')
                          : order.status === 'closed'
                          ? (isRTL ? 'مغلق' : 'Closed')
                          : (isRTL ? 'ملغي' : 'Cancelled')}
                      </Badge>
                      <span className="font-bold text-green-700 text-sm">
                        {Number(order.total_amount || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation Links */}
        <Card className="border-0 shadow-md mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-800">
              {isRTL ? 'الإدارة' : 'Management'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { titleAr: 'إدارة المنيو', titleEn: 'Menu Management', icon: UtensilsCrossed, path: '/dashboard/cafeteria-admin/menu', color: 'text-orange-600' },
              { titleAr: 'إدارة الطاولات', titleEn: 'Tables Management', icon: Table2, path: '/dashboard/cafeteria-admin/tables', color: 'text-purple-600' },
              { titleAr: 'إدارة الموظفين', titleEn: 'Staff Management', icon: Users, path: '/dashboard/cafeteria-admin/staff', color: 'text-green-600' },
              { titleAr: 'إدارة الطلبات', titleEn: 'Orders Management', icon: ShoppingCart, path: '/dashboard/cafeteria-admin/orders', color: 'text-pink-600' },
              { titleAr: 'التقارير والإحصائيات', titleEn: 'Reports & Analytics', icon: BarChart3, path: '/dashboard/cafeteria-admin/reports', color: 'text-indigo-600' },
              { titleAr: 'شحن النقاط', titleEn: 'Recharge Points', icon: CreditCard, path: '/dashboard/cafeteria-admin/recharge', color: 'text-yellow-600' },
              { titleAr: 'إعدادات الكافيتريا', titleEn: 'Cafeteria Settings', icon: Settings, path: '/dashboard/cafeteria-admin/settings', color: 'text-slate-600' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => setLocation(item.path)}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${item.color}`} />
                    <span className="font-semibold text-slate-800 text-sm">
                      {isRTL ? item.titleAr : item.titleEn}
                    </span>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-slate-400 ${isRTL ? 'rotate-180' : ''}`} />
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Language Switcher */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Languages className="w-5 h-5 text-slate-600" />
                <span className="font-semibold text-slate-800 text-sm">
                  {isRTL ? 'اللغة' : 'Language'}
                </span>
              </div>
              <Select value={language} onValueChange={(v) => setLanguage(v)}>
                <SelectTrigger className="w-[130px] border-2 border-slate-300 font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">العربية</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
