import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  Clock,
  ChefHat,
  UtensilsCrossed,
  Loader2,
  AlertCircle,
  Home,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

export default function OrderConfirmation() {
  const params = useParams<{ orderId?: string }>();
  const [, navigate] = useLocation();
  const orderId = params.orderId;
  const [now, setNow] = useState(new Date());

  // Tick every second for elapsed time
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch order details
  const { data: order, isLoading, error, refetch } = trpc.ordersPhase2.getOrderDetails.useQuery(
    { orderId: orderId || '' },
    { enabled: !!orderId, refetchInterval: 2000 }
  );

  useEffect(() => {
    if (error) {
      console.error('[ORDER_CONFIRMATION_ERROR]', error);
      toast.error('Failed to load order details');
    }
  }, [error]);

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
      pending: {
        label: 'Waiting in Queue',
        icon: <Clock className="w-8 h-8" />,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
      },
      preparing: {
        label: 'Cooking Now',
        icon: <ChefHat className="w-8 h-8" />,
        color: 'text-orange-600',
        bgColor: 'bg-orange-100',
      },
      ready: {
        label: 'Ready for Pickup',
        icon: <UtensilsCrossed className="w-8 h-8" />,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
      },
      served: {
        label: 'Enjoy Your Meal',
        icon: <CheckCircle2 className="w-8 h-8" />,
        color: 'text-purple-600',
        bgColor: 'bg-purple-100',
      },
    };

    return statusMap[status] || statusMap.pending;
  };

  const getProgressPercentage = (status: string) => {
    const progressMap: Record<string, number> = {
      pending: 25,
      preparing: 50,
      ready: 75,
      served: 100,
    };
    return progressMap[status] || 0;
  };

  const getElapsedTime = (createdAt: string) => {
    const diff = Math.floor((now.getTime() - new Date(createdAt).getTime()) / 1000);
    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-0">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-16 h-16 animate-spin text-orange-600 mb-4" />
            <p className="text-gray-700 font-bold text-lg">Loading order details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-0 border-l-4 border-red-500">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="w-16 h-16 text-red-600 mb-4" />
            <p className="text-gray-900 font-bold text-lg mb-2">Order Not Found</p>
            <p className="text-gray-600 text-sm text-center mb-8">
              We couldn't find the order you're looking for. Please try again.
            </p>
            <Button onClick={() => navigate('/')} className="gap-2 bg-orange-600 hover:bg-orange-700">
              <Home className="w-4 h-4" />
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusInfo = getStatusInfo(order.status);
  const progress = getProgressPercentage(order.status);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-slate-50 p-4 py-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 mb-6 shadow-lg">
            <UtensilsCrossed className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-black text-gray-900 mb-3">Order Confirmed</h1>
          <p className="text-gray-700 text-sm">
            Order ID: <span className="font-mono font-bold bg-orange-100 text-orange-800 px-3 py-1.5 rounded-full inline-block mt-2">{order.id.slice(0, 12)}</span>
          </p>
        </div>

        {/* Status Card */}
        <Card className="mb-8 shadow-2xl border-0 bg-white overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-orange-500 to-orange-600 border-b-4 border-orange-700 py-6">
            <CardTitle className="text-center text-2xl text-white font-black">Live Status Update</CardTitle>
          </CardHeader>
          <CardContent className="pt-10 pb-10 bg-gradient-to-b from-white to-orange-50">
            {/* Status Icon and Label */}
            <div className="flex flex-col items-center mb-10">
              <div className={`p-8 rounded-full ${statusInfo.bgColor} mb-6 shadow-lg`}>
                <div className={`${statusInfo.color} text-6xl`}>{statusInfo.icon}</div>
              </div>
              <h2 className="text-5xl font-black text-gray-900 mb-4">{statusInfo.label}</h2>
              <div className="flex items-center gap-3 text-gray-700 text-base bg-gray-100 px-6 py-3 rounded-full font-semibold">
                <Clock className="w-5 h-5" />
                <span>Elapsed: <span className="font-mono font-bold text-orange-600 text-lg">{getElapsedTime(order.createdAt)}</span></span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-10">
              <div className="flex justify-between text-sm font-bold text-gray-700 mb-4">
                <span className={order.status === 'pending' || order.status === 'preparing' || order.status === 'ready' || order.status === 'served' ? 'text-orange-600' : 'text-gray-500'}>📍 Placed</span>
                <span className={order.status === 'preparing' || order.status === 'ready' || order.status === 'served' ? 'text-orange-600' : 'text-gray-500'}>👨‍🍳 Preparing</span>
                <span className={order.status === 'ready' || order.status === 'served' ? 'text-orange-600' : 'text-gray-500'}>✅ Ready</span>
                <span className={order.status === 'served' ? 'text-orange-600' : 'text-gray-500'}>🎉 Served</span>
              </div>
              <div className="w-full bg-gray-300 rounded-full h-4 overflow-hidden shadow-inner">
                <div
                  className="bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 h-full transition-all duration-700 shadow-lg"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>

            {/* Status Messages */}
            {order.status === 'pending' && (
              <div className="p-6 bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-blue-500 rounded-lg text-center shadow-md">
                <p className="text-blue-900 font-bold text-lg">⏳ Waiting in Queue</p>
                <p className="text-blue-700 text-sm mt-2">Your order has been received and is waiting to be prepared by the kitchen.</p>
              </div>
            )}
            {order.status === 'preparing' && (
              <div className="p-6 bg-gradient-to-r from-orange-50 to-orange-100 border-l-4 border-orange-500 rounded-lg text-center shadow-md animate-pulse">
                <p className="text-orange-900 font-bold text-lg">👨‍🍳 Cooking Now</p>
                <p className="text-orange-700 text-sm mt-2">Your order is being prepared by the chef. It will be ready soon!</p>
              </div>
            )}
            {order.status === 'ready' && (
              <div className="p-6 bg-gradient-to-r from-green-50 to-green-100 border-l-4 border-green-500 rounded-lg text-center shadow-md">
                <p className="text-green-900 font-bold text-lg">✅ Ready for Pickup!</p>
                <p className="text-green-700 text-sm mt-2">Your order is ready! Please ask the waiter to bring it to your table.</p>
              </div>
            )}
            {order.status === 'served' && (
              <div className="p-6 bg-gradient-to-r from-purple-50 to-purple-100 border-l-4 border-purple-500 rounded-lg text-center shadow-md">
                <p className="text-purple-900 font-bold text-lg">🎉 Enjoy Your Meal!</p>
                <p className="text-purple-700 text-sm mt-2">Your order has been served. Bon appétit!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Items */}
        {order.items && order.items.length > 0 && (
          <Card className="mb-8 shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-gray-100 to-gray-50 border-b py-4">
              <CardTitle className="text-lg font-bold text-gray-900">Order Items</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 pb-6">
              <div className="space-y-3">
                {order.items.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-orange-50 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex-1">
                      <p className="font-bold text-gray-900 text-lg">{item.menuItemId}</p>
                      {item.notes && (
                        <p className="text-xs text-gray-600 mt-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded inline-block">
                          <span className="font-semibold">Note:</span> {item.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="bg-gradient-to-br from-orange-400 to-orange-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-md">
                        x{item.quantity}
                      </span>
                      <span className="font-bold text-gray-900 text-lg">
                        ${(item.totalPrice || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="mt-6 pt-6 border-t-2 border-gray-300">
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold text-gray-900">Total Amount</span>
                  <span className="text-3xl font-black text-orange-600">
                    ${(order.totalAmount || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-4 justify-center flex-wrap">
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="gap-2 px-6 py-3 font-bold border-2 border-gray-300 hover:border-orange-500 hover:text-orange-600"
          >
            <RefreshCw className="w-5 h-5" />
            Refresh Status
          </Button>
          <Button
            onClick={() => navigate('/')}
            className="gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold shadow-lg"
          >
            <Home className="w-5 h-5" />
            Back to Menu
          </Button>
        </div>

        {/* Footer */}
        <div className="text-center mt-10 text-gray-600 text-sm">
          <p className="font-semibold">Status updates automatically every 2 seconds</p>
          <p className="mt-1 text-xs">Thank you for your order!</p>
        </div>
      </div>
    </div>
  );
}
