import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  Clock,
  DollarSign,
  ShoppingCart,
  RefreshCw,
  Loader2,
  Calendar,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface BusinessMetricsProps {
  cafeteriaId: string;
  isRTL?: boolean;
}

export default function BusinessMetrics({ cafeteriaId, isRTL = false }: BusinessMetricsProps) {
  const [now, setNow] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Tick every second
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch all orders
  const { data: allOrders, isLoading, refetch } = trpc.ordersPhase2.getOrders.useQuery(
    { cafeteriaId },
    { enabled: !!cafeteriaId, refetchInterval: 10000 }
  );

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!allOrders) return { totalOrders: 0, totalRevenue: 0, avgPrepTime: 0, servedToday: 0 };

    const today = new Date(selectedDate);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Filter orders for today
    const todaysOrders = allOrders.filter((order: any) => {
      const orderDate = new Date(order.createdAt);
      orderDate.setHours(0, 0, 0, 0);
      return orderDate.getTime() === today.getTime();
    });

    // Calculate total revenue
    const totalRevenue = todaysOrders.reduce((sum: number, order: any) => sum + Number(order.totalAmount || 0), 0);

    // Calculate average preparation time (for served orders)
    const servedOrders = todaysOrders.filter((o: any) => o.status === 'served');
    let avgPrepTime = 0;
    if (servedOrders.length > 0) {
      const totalPrepTime = servedOrders.reduce((sum: number, order: any) => {
        const createdTime = new Date(order.createdAt).getTime();
        const servedTime = order.servedAt ? new Date(order.servedAt).getTime() : now.getTime();
        return sum + (servedTime - createdTime);
      }, 0);
      avgPrepTime = Math.round(totalPrepTime / servedOrders.length / 60000); // Convert to minutes
    }

    return {
      totalOrders: todaysOrders.length,
      totalRevenue: totalRevenue,
      avgPrepTime: avgPrepTime,
      servedToday: servedOrders.length,
    };
  }, [allOrders, selectedDate, now]);

  return (
    <div className="w-full space-y-6">
      {/* Date Selector */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
          <Calendar className="w-5 h-5 text-gray-600" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-sm font-semibold text-gray-900 border-none outline-none"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isRTL ? 'تحديث' : 'Refresh'}
        </Button>
      </div>

      {/* Metrics Grid */}
      {isLoading && metrics.totalOrders === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin w-8 h-8 text-gray-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                {isRTL ? 'طلبات اليوم' : 'Today\'s Orders'}
              </p>
            </CardContent>
          </Card>

          {/* Total Revenue */}
          <Card className="shadow-lg border-0 bg-gradient-to-br from-green-50 to-green-100 hover:shadow-xl transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  {isRTL ? 'الإيرادات' : 'Total Revenue'}
                </CardTitle>
                <div className="p-2 rounded-lg bg-green-200">
                  <DollarSign className="w-5 h-5 text-green-700" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-black text-green-900">${metrics.totalRevenue.toFixed(2)}</p>
              <p className="text-xs text-green-700 mt-2 font-semibold">
                {isRTL ? 'إجمالي الإيرادات' : 'Total Revenue'}
              </p>
            </CardContent>
          </Card>

          {/* Average Prep Time */}
          <Card className="shadow-lg border-0 bg-gradient-to-br from-orange-50 to-orange-100 hover:shadow-xl transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  {isRTL ? 'متوسط الوقت' : 'Avg Prep Time'}
                </CardTitle>
                <div className="p-2 rounded-lg bg-orange-200">
                  <Clock className="w-5 h-5 text-orange-700" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-black text-orange-900">{metrics.avgPrepTime}</p>
              <p className="text-xs text-orange-700 mt-2 font-semibold">
                {isRTL ? 'دقيقة' : 'minutes'}
              </p>
            </CardContent>
          </Card>

          {/* Served Orders */}
          <Card className="shadow-lg border-0 bg-gradient-to-br from-purple-50 to-purple-100 hover:shadow-xl transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  {isRTL ? 'مقدمة' : 'Served'}
                </CardTitle>
                <div className="p-2 rounded-lg bg-purple-200">
                  <TrendingUp className="w-5 h-5 text-purple-700" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-black text-purple-900">{metrics.servedToday}</p>
              <p className="text-xs text-purple-700 mt-2 font-semibold">
                {isRTL ? 'طلبات مقدمة' : 'Orders Served'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Summary Stats */}
      {metrics.totalOrders > 0 && (
        <Card className="shadow-lg border-0 bg-gradient-to-r from-gray-50 to-gray-100">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-gray-900">
              {isRTL ? 'ملخص الأداء' : 'Performance Summary'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">
                  {isRTL ? 'معدل الإكمال' : 'Completion Rate'}
                </p>
                <p className="text-3xl font-black text-gray-900">
                  {metrics.totalOrders > 0 ? Math.round((metrics.servedToday / metrics.totalOrders) * 100) : 0}%
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">
                  {isRTL ? 'متوسط الإيرادات' : 'Avg Order Value'}
                </p>
                <p className="text-3xl font-black text-gray-900">
                  ${metrics.totalOrders > 0 ? (metrics.totalRevenue / metrics.totalOrders).toFixed(2) : '0.00'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">
                  {isRTL ? 'الطلبات المعلقة' : 'Pending Orders'}
                </p>
                <p className="text-3xl font-black text-gray-900">
                  {metrics.totalOrders - metrics.servedToday}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
