import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DollarSign,
  Coins,
  CreditCard,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface PaymentPanelProps {
  orderId: string;
  totalAmount: number;
  currentPaymentStatus?: 'pending' | 'paid' | 'cancelled';
  currentPaymentMethod?: 'cash' | 'points' | 'online';
  onPaymentSuccess?: () => void;
  isRTL?: boolean;
}

export default function PaymentPanel({
  orderId,
  totalAmount,
  currentPaymentStatus = 'pending',
  currentPaymentMethod = 'cash',
  onPaymentSuccess,
  isRTL = false,
}: PaymentPanelProps) {
  const [selectedMethod, setSelectedMethod] = useState<'cash' | 'points' | 'online'>(currentPaymentMethod);

  const processPaymentMutation = trpc.payments.processPayment.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? 'تم معالجة الدفع' : 'Payment processed successfully');
      console.log(`[PAYMENT_SUCCESS] Order ${orderId} marked as paid via ${selectedMethod}`);
      onPaymentSuccess?.();
    },
    onError: (err) => {
      const errorMsg = err.message || (isRTL ? 'خطأ في معالجة الدفع' : 'Error processing payment');
      toast.error(errorMsg);
      console.error('[PAYMENT_ERROR]', err);
    },
  });

  const handlePayment = (method: 'cash' | 'points' | 'online') => {
    setSelectedMethod(method);
    processPaymentMutation.mutate({
      orderId,
      paymentMethod: method,
    });
  };

  if (currentPaymentStatus === 'paid') {
    return (
      <Card className="border-2 border-green-500 bg-green-50">
        <CardContent className="pt-6 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-green-600" />
          <div>
            <p className="font-bold text-green-900">{isRTL ? 'تم الدفع' : 'Payment Completed'}</p>
            <p className="text-sm text-green-700">
              {isRTL ? `طريقة الدفع: ${currentPaymentMethod}` : `Payment Method: ${currentPaymentMethod}`}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-white">
      <CardHeader className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-t-lg">
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          {isRTL ? 'معالجة الدفع' : 'Process Payment'}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {/* Amount Display */}
        <div className="p-4 bg-white border-2 border-orange-200 rounded-lg">
          <p className="text-sm text-gray-600 mb-1">{isRTL ? 'المبلغ المستحق' : 'Amount Due'}</p>
          <p className="text-3xl font-black text-orange-600">${totalAmount.toFixed(2)}</p>
        </div>

        {/* Payment Methods */}
        <div className="space-y-3">
          <p className="text-sm font-bold text-gray-700">{isRTL ? 'اختر طريقة الدفع' : 'Select Payment Method'}</p>

          {/* Cash */}
          <Button
            size="lg"
            variant={selectedMethod === 'cash' ? 'default' : 'outline'}
            onClick={() => handlePayment('cash')}
            disabled={processPaymentMutation.isPending}
            className={`w-full gap-3 py-6 font-bold transition-all ${
              selectedMethod === 'cash'
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'border-2 border-green-300 text-green-700 hover:bg-green-50'
            }`}
          >
            {processPaymentMutation.isPending && selectedMethod === 'cash' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <DollarSign className="w-5 h-5" />
            )}
            {isRTL ? 'دفع نقداً' : 'Pay with Cash'}
          </Button>

          {/* Points */}
          <Button
            size="lg"
            variant={selectedMethod === 'points' ? 'default' : 'outline'}
            onClick={() => handlePayment('points')}
            disabled={processPaymentMutation.isPending}
            className={`w-full gap-3 py-6 font-bold transition-all ${
              selectedMethod === 'points'
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'border-2 border-blue-300 text-blue-700 hover:bg-blue-50'
            }`}
          >
            {processPaymentMutation.isPending && selectedMethod === 'points' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Coins className="w-5 h-5" />
            )}
            {isRTL ? 'دفع بالنقاط' : 'Pay with Points'}
          </Button>

          {/* Online */}
          <Button
            size="lg"
            variant={selectedMethod === 'online' ? 'default' : 'outline'}
            onClick={() => handlePayment('online')}
            disabled={processPaymentMutation.isPending}
            className={`w-full gap-3 py-6 font-bold transition-all ${
              selectedMethod === 'online'
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'border-2 border-purple-300 text-purple-700 hover:bg-purple-50'
            }`}
          >
            {processPaymentMutation.isPending && selectedMethod === 'online' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <CreditCard className="w-5 h-5" />
            )}
            {isRTL ? 'دفع إلكتروني' : 'Online Payment'}
          </Button>
        </div>

        {/* Info */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            {isRTL
              ? 'اختر طريقة الدفع وسيتم تسجيل الدفع فوراً'
              : 'Select a payment method and the payment will be recorded immediately'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
