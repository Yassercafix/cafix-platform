import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

interface OrderStatus {
  status: 'pending' | 'preparing' | 'ready' | 'served';
  timestamp: string;
}

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
    { enabled: !!orderId, refetchInterval: 3000 }
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
        label: 'Pending',
        icon: <Clock className="w-6 h-6" />,
        color: 'text-gray-600',
        bgColor: 'bg-gray-100',
      },
      preparing: {
        label: 'Preparing',
        icon: <ChefHat className="w-6 h-6" />,
        color: 'text-orange-600',
        bgColor: 'bg-orange-100',
      },
      ready: {
        label: 'Ready for Pickup',
        icon: <UtensilsCrossed className="w-6 h-6" />,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
      },
      served: {
        label: 'Served',
        icon: <CheckCircle2 className="w-6 h-6" />,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 animate-spin text-orange-600 mb-4" />
            <p className="text-gray-600 font-medium">Loading order details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg border-red-300">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-12 h-12 text-red-600 mb-4" />
            <p className="text-gray-800 font-semibold mb-2">Order Not Found</p>
            <p className="text-gray-600 text-sm text-center mb-6">
              We couldn't find the order you're looking for. Please try again.
            </p>
            <Button onClick={() => navigate('/')} className="gap-2">
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Confirmation</h1>
          <p className="text-gray-600">Order ID: <span className="font-mono text-sm bg-gray-200 px-2 py-1 rounded">{order.id.slice(0, 12)}</span></p>
        </div>

        {/* Status Card */}
        <Card className="mb-6 shadow-lg border-2 border-orange-200">
          <CardHeader className="bg-gradient-to-r from-orange-50 to-orange-100 border-b">
            <CardTitle className="text-center text-xl">Current Status</CardTitle>
          </CardHeader>
          <CardContent className="pt-8 pb-8">
            {/* Status Icon and Label */}
            <div className="flex flex-col items-center mb-8">
              <div className={`p-4 rounded-full ${statusInfo.bgColor} mb-4`}>
                <div className={statusInfo.color}>{statusInfo.icon}</div>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">{statusInfo.label}</h2>
              <p className="text-gray-600 text-sm">
                Elapsed time: <span className="font-mono font-semibold">{getElapsedTime(order.createdAt)}</span>
              </p>
            </div>

            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex justify-between text-xs font-semibold text-gray-700 mb-2">
                <span>Order Placed</span>
                <span>Preparing</span>
                <span>Ready</span>
                <span>Served</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-orange-400 to-orange-600 h-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>

            {/* Status Messages */}
            {order.status === 'pending' && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                <p className="text-blue-800 font-medium">
                  Your order has been received and is waiting to be prepared by the kitchen.
                </p>
              </div>
            )}
            {order.status === 'preparing' && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg text-center">
                <p className="text-orange-800 font-medium">
                  Your order is being prepared by the chef. It will be ready soon!
                </p>
              </div>
            )}
            {order.status === 'ready' && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                <p className="text-green-800 font-medium">
                  Your order is ready! Please ask the waiter to bring it to your table.
                </p>
              </div>
            )}
            {order.status === 'served' && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                <p className="text-blue-800 font-medium">
                  Your order has been served. Enjoy your meal!
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Items */}
        {order.items && order.items.length > 0 && (
          <Card className="mb-6 shadow-lg">
            <CardHeader className="bg-gray-50 border-b">
              <CardTitle className="text-lg">Order Items</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {order.items.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{item.menuItemId}</p>
                      {item.notes && (
                        <p className="text-xs text-gray-600 mt-1">
                          <span className="font-medium">Note:</span> {item.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-semibold">
                        x{item.quantity}
                      </span>
                      <span className="font-semibold text-gray-900">
                        ${(item.totalPrice || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="mt-4 pt-4 border-t-2 border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-gray-900">Total Amount</span>
                  <span className="text-2xl font-bold text-orange-600">
                    ${(order.totalAmount || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Status
          </Button>
          <Button
            onClick={() => navigate('/')}
            className="gap-2 bg-orange-600 hover:bg-orange-700"
          >
            <Home className="w-4 h-4" />
            Back to Menu
          </Button>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-600 text-sm">
          <p>Status updates automatically every 3 seconds</p>
        </div>
      </div>
    </div>
  );
}
