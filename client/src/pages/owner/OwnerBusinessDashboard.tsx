import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTranslation } from '@/locales/useTranslation';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DashboardNavigation } from '@/components/DashboardNavigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Store,
  BarChart3,
  RefreshCw,
  Loader2,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

export default function OwnerBusinessDashboard() {
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const { language } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const isRTL = language === 'ar';
  const ownerId = user?.id;

  const navigationItems = [
    { label: isRTL ? 'لوحة التحكم' : 'Dashboard', path: '/dashboard/owner', icon: <BarChart3 className="w-5 h-5" /> },
    { label: isRTL ? 'الكافيتريات' : 'Cafeterias', path: '/dashboard/owner/cafeterias', icon: <Store className="w-5 h-5" /> },
  ];

  // Fetch all cafeterias for this owner
  const { data: cafeterias, isLoading: cafeteriasLoading } = trpc.cafeterias.getCafeteriasByOwner.useQuery(
    { ownerId: ownerId || '' },
    { enabled: !!ownerId }
  );

  // Calculate metrics for all cafeterias
  const metrics = useMemo(() => {
    if (!cafeterias || cafeterias.length === 0) {
      return {
        totalRevenue: 0,
        totalOrders: 0,
        totalCafeterias: 0,
        avgOrderValue: 0,
        topCafeteria: null,
      };
    }

    const today = new Date(selectedDate);
    today.setHours(0, 0, 0, 0);

    let totalRevenue = 0;
    let totalOrders = 0;
    let topCafeteria = null;
    let topRevenue = 0;

    // This is a simplified calculation - in production, you'd fetch actual order data
    cafeterias.forEach((cafe: any) => {
      // Placeholder: In real implementation, fetch orders for each cafeteria
      const cafeRevenue = Math.random() * 5000; // Simulated
      const cafeOrders = Math.floor(Math.random() * 50);

      totalRevenue += cafeRevenue;
      totalOrders += cafeOrders;

      if (cafeRevenue > topRevenue) {
        topRevenue = cafeRevenue;
        topCafeteria = cafe;
      }
    });

    return {
      totalRevenue: totalRevenue,
      totalOrders: totalOrders,
      totalCafeterias: cafeterias.length,
      avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      topCafeteria: topCafeteria,
    };
  }, [cafeterias, selectedDate]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <DashboardHeader
        showBackButton={true}
        showHomeButton={true}
        title={isRTL ? 'لوحة تحكم الأعمال' : 'Business Dashboard'}
        onMenuClick={() => setMenuOpen(true)}
      />
      <DashboardNavigation isOpen={menuOpen} onClose={() => setMenuOpen(false)} items={navigationItems} />

      <main className="p-4 md:p-8 max-w-7xl mx-auto">
        {/* Date Selector */}
        <div className="flex items-center gap-4 mb-8 flex-wrap">
          <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
            <Calendar className="w-5 h-5 text-gray-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-sm font-semibold text-gray-900 border-none outline-none"
            />
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Revenue */}
          <Card className="shadow-lg border-0 bg-gradient-to-br from-green-50 to-green-100 hover:shadow-xl transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  {isRTL ? 'إجمالي الإيرادات' : 'Total Revenue'}
                </CardTitle>
                <div className="p-2 rounded-lg bg-green-200">
                  <DollarSign className="w-5 h-5 text-green-700" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-black text-green-900">${metrics.totalRevenue.toFixed(2)}</p>
              <p className="text-xs text-green-700 mt-2 font-semibold flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" />
                {isRTL ? 'اليوم' : 'Today'}
              </p>
            </CardContent>
          </Card>

          {/* Total Orders */}
          <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-50 to-blue-100 hover:shadow-xl transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  {isRTL ? 'إجمالي الطلبات' : 'Total Orders'}
                </CardTitle>
                <div className="p-2 rounded-lg bg-blue-200">
                  <ShoppingCart className="w-5 h-5 text-blue-700" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-black text-blue-900">{metrics.totalOrders}</p>
              <p className="text-xs text-blue-700 mt-2 font-semibold">
                {isRTL ? 'طلبات' : 'Orders'}
              </p>
            </CardContent>
          </Card>

          {/* Active Cafeterias */}
          <Card className="shadow-lg border-0 bg-gradient-to-br from-orange-50 to-orange-100 hover:shadow-xl transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  {isRTL ? 'الكافيتريات النشطة' : 'Active Cafeterias'}
                </CardTitle>
                <div className="p-2 rounded-lg bg-orange-200">
                  <Store className="w-5 h-5 text-orange-700" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-black text-orange-900">{metrics.totalCafeterias}</p>
              <p className="text-xs text-orange-700 mt-2 font-semibold">
                {isRTL ? 'كافيتريا' : 'Cafeterias'}
              </p>
            </CardContent>
          </Card>

          {/* Avg Order Value */}
          <Card className="shadow-lg border-0 bg-gradient-to-br from-purple-50 to-purple-100 hover:shadow-xl transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  {isRTL ? 'متوسط القيمة' : 'Avg Order Value'}
                </CardTitle>
                <div className="p-2 rounded-lg bg-purple-200">
                  <TrendingUp className="w-5 h-5 text-purple-700" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-black text-purple-900">${metrics.avgOrderValue.toFixed(2)}</p>
              <p className="text-xs text-purple-700 mt-2 font-semibold">
                {isRTL ? 'لكل طلب' : 'Per Order'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Top Cafeteria */}
        {metrics.topCafeteria && (
          <Card className="shadow-lg border-0 mb-8 bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-t-lg">
              <CardTitle className="flex items-center gap-2">
                <Store className="w-5 h-5" />
                {isRTL ? 'أفضل كافيتريا' : 'Top Performing Cafeteria'}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-black text-gray-900">{metrics.topCafeteria.name}</p>
                  <p className="text-sm text-gray-600 mt-1">{metrics.topCafeteria.location}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-green-600">${(Math.random() * 5000).toFixed(2)}</p>
                  <p className="text-xs text-gray-600 mt-1">{isRTL ? 'إيرادات اليوم' : 'Today\'s Revenue'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cafeterias List */}
        {cafeteriasLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin w-8 h-8 text-gray-400" />
          </div>
        ) : cafeterias && cafeterias.length > 0 ? (
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-gray-100 to-gray-50 border-b">
              <CardTitle className="text-lg font-bold text-gray-900">
                {isRTL ? 'جميع الكافيتريات' : 'All Cafeterias'}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {cafeterias.map((cafe: any) => (
                  <div key={cafe.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-gray-900">{cafe.name}</p>
                        <p className="text-sm text-gray-600">{cafe.location}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">${(Math.random() * 5000).toFixed(2)}</p>
                        <p className="text-xs text-gray-600">{isRTL ? 'إيرادات اليوم' : 'Today\'s Revenue'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-lg border-0">
            <CardContent className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Store className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg font-bold">{isRTL ? 'لا توجد كافيتريات' : 'No cafeterias found'}</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
