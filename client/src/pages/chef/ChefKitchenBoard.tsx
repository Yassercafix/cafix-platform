import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTranslation } from '@/locales/useTranslation';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DashboardNavigation } from '@/components/DashboardNavigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UtensilsCrossed, LayoutDashboard, Clock, CheckCircle2, AlertCircle, Timer, ChefHat, Bell } from 'lucide-react';
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
  status: 'sent_to_kitchen' | 'preparing' | 'ready';
  createdAt: string;
  items: OrderItem[];
}

export default function ChefKitchenBoard() {
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const { language } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const isRTL = language === 'ar';
  const cafeteriaId = user?.cafeteriaId;

  const navigationItems = [
    { label: isRTL ? 'لوحة التحكم' : 'Dashboard', path: '/dashboard/chef', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: isRTL ? 'لوحة المطبخ' : 'Kitchen Board', path: '/dashboard/chef/kitchen-board', icon: <UtensilsCrossed className="w-5 h-5" /> },
  ];

  const { data: kitchenData, isLoading: ordersLoading, refetch } = trpc.ordersPhase2.getKitchenQueue.useQuery(
    { cafeteriaId: cafeteriaId || "" },
    { enabled: !!cafeteriaId, refetchInterval: 5000 }
  );

  const markPreparingMutation = trpc.ordersPhase2.markPreparing.useMutation();
  const markReadyMutation = trpc.ordersPhase2.markReady.useMutation();

  useEffect(() => {
    if (kitchenData) {
      // Group items by orderId
      const grouped: Record<string, Order> = {};
      kitchenData.forEach((item: any) => {
        if (!grouped[item.orderId]) {
          grouped[item.orderId] = {
            id: item.orderId,
            tableNumber: item.orderId.slice(0, 4), // Fallback if tableNumber not in item
            status: item.status as any,
            createdAt: item.sentToKitchenAt || new Date().toISOString(),
            items: []
          };
        }
        grouped[item.orderId].items.push({
          id: item.id,
          name: `Item ${item.menuItemId}`,
          quantity: item.quantity,
          notes: item.notes
        });
      });
      setOrders(Object.values(grouped));
      setLoading(false);
    }
  }, [kitchenData]);

  const updateOrderStatus = async (orderId: string, newStatus: 'preparing' | 'ready') => {
    try {
      if (newStatus === 'preparing') {
        await markPreparingMutation.mutateAsync({ orderId });
      } else {
        await markReadyMutation.mutateAsync({ orderId });
      }
      
      toast.success(
        newStatus === 'preparing' 
          ? (isRTL ? 'بدأ التحضير' : 'Started preparing') 
          : (isRTL ? 'الطلب جاهز للتسليم' : 'Order ready for delivery')
      );
      refetch();
    } catch (err: any) {
      toast.error(isRTL ? 'خطأ في تحديث الحالة' : 'Error updating status');
    }
  };

  const getTimeInKitchen = (createdAt: string) => {
    const diff = Math.floor((new Date().getTime() - new Date(createdAt).getTime()) / 60000);
    return `${diff} ${isRTL ? 'دقيقة' : 'min'}`;
  };

  if (authLoading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div></div>;

  return (
    <div className={`min-h-screen bg-slate-900 text-white ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <DashboardHeader showBackButton={true} showHomeButton={true} title={isRTL ? 'لوحة تحكم المطبخ' : 'Kitchen Display System'} onMenuClick={() => setMenuOpen(true)} />
      <DashboardNavigation isOpen={menuOpen} onClose={() => setMenuOpen(false)} items={navigationItems} />

      <main className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-orange-600 p-3 rounded-xl shadow-lg shadow-orange-900/20"><ChefHat className="w-8 h-8 text-white" /></div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">{isRTL ? 'الطلبات النشطة' : 'Active Orders'}</h2>
              <p className="text-slate-400 text-sm">{isRTL ? `يوجد ${orders.length} طلبات قيد الانتظار` : `${orders.length} orders waiting`}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700">
            <Timer className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-mono text-slate-300">{new Date().toLocaleTimeString()}</span>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <div key={i} className="h-64 bg-slate-800 animate-pulse rounded-2xl border border-slate-700"></div>)}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-500">
            <UtensilsCrossed className="w-20 h-20 mb-4 opacity-20" />
            <p className="text-xl font-bold">{isRTL ? 'لا توجد طلبات حالياً' : 'No active orders'}</p>
            <p className="text-sm">{isRTL ? 'استمتع ببعض الراحة!' : 'Enjoy some rest!'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {orders.map((order) => (
              <Card key={order.id} className={`border-0 shadow-2xl overflow-hidden rounded-2xl transition-all ${order.status === 'preparing' ? 'bg-slate-800 ring-2 ring-orange-500' : 'bg-slate-800'}`}>
                <CardHeader className="pb-3 border-b border-slate-700/50 flex flex-row items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-3xl font-black text-white">#{order.tableNumber}</span>
                      <Badge className={order.status === 'preparing' ? 'bg-orange-500 text-white' : 'bg-blue-500 text-white'}>
                        {order.status === 'preparing' ? (isRTL ? 'يتم التحضير' : 'Preparing') : (isRTL ? 'جديد' : 'New')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
                      <Clock className="w-3 h-3" /> {getTimeInKitchen(order.createdAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 font-mono">ID: {order.id.slice(0, 6)}</p>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="space-y-3 min-h-[120px]">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-3 group">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 bg-slate-700 rounded flex items-center justify-center text-xs font-bold text-orange-400">{item.quantity}x</span>
                            <span className="font-bold text-slate-100 group-hover:text-orange-300 transition-colors">{item.name}</span>
                          </div>
                          {item.notes && (
                            <div className="mt-1 ml-8 p-1.5 bg-red-900/20 border border-red-900/30 rounded text-[10px] text-red-400 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> {item.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-slate-700/50 flex gap-2">
                    {order.status === 'sent_to_kitchen' ? (
                      <Button 
                        onClick={() => updateOrderStatus(order.id, 'preparing')}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-6 rounded-xl gap-2"
                      >
                        <ChefHat className="w-5 h-5" /> {isRTL ? 'بدء التحضير' : 'Start Cooking'}
                      </Button>
                    ) : (
                      <Button 
                        onClick={() => updateOrderStatus(order.id, 'ready')}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-6 rounded-xl gap-2"
                      >
                        <Bell className="w-5 h-5" /> {isRTL ? 'جاهز للتسليم' : 'Mark as Ready'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
