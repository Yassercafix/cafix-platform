import React, { useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTranslation } from '@/locales/useTranslation';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DollarSign,
  Coins,
  Send,
  History,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface RechargeRequest {
  id: string;
  usdAmount: number;
  pointsAmount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  approvedAt?: Date;
}

interface PointTransaction {
  id: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description?: string;
  createdAt: Date;
}

export default function PointsRechargePanel() {
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const { language } = useTranslation();
  const isRTL = language === 'ar';
  const cafeteriaId = user?.cafeteriaId || '';

  const [selectedTab, setSelectedTab] = useState<'overview' | 'history' | 'request'>('overview');
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [showRechargeForm, setShowRechargeForm] = useState(false);

  // Fetch cafeteria balance (assuming it's stored in cafeterias table)
  const { data: cafeteriaData, isLoading: cafeteriaLoading } = trpc.cafeterias.getCafeteriaById.useQuery(
    { id: cafeteriaId },
    { enabled: !!cafeteriaId }
  );

  // Fetch recharge history
  const { data: rechargeHistoryData, isLoading: rechargeHistoryLoading, refetch: refetchRecharges } = trpc.pointsManagement.getRechargeHistory.useQuery(
    { cafeteriaId, limit: 50 },
    { enabled: !!cafeteriaId }
  );

  // Fetch transaction history
  const { data: transactionData, isLoading: transactionLoading } = trpc.pointsManagement.getPointTransactions.useQuery(
    { cafeteriaId, limit: 100 },
    { enabled: !!cafeteriaId }
  );

  // Get conversion rate
  const { data: rateData } = trpc.pointsManagement.getConversionRate.useQuery(
    { ownerId: cafeteriaData?.marketerId || '' },
    { enabled: !!cafeteriaData?.marketerId }
  );

  // Mutations
  const requestRechargeMutation = trpc.pointsManagement.requestPointsRecharge.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? 'تم تقديم طلب الشحن' : 'Recharge request submitted');
      setRechargeAmount('');
      setShowRechargeForm(false);
      refetchRecharges();
    },
    onError: (err) => {
      toast.error(err.message || (isRTL ? 'خطأ في تقديم الطلب' : 'Error submitting request'));
    },
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  const currentBalance = Number(cafeteriaData?.pointsBalance || 0);
  const rechargeRequests = rechargeHistoryData?.requests || [];
  const transactions = transactionData?.transactions || [];
  const conversionRate = rateData?.usdToPoints || 10;

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <DashboardHeader
        showBackButton={true}
        showHomeButton={true}
        title={isRTL ? 'إدارة النقاط' : 'Points Management'}
        onMenuClick={() => {}}
      />

      <main className="p-4 md:p-8 max-w-7xl mx-auto">
        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Current Balance */}
          <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-50 to-blue-100">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  {isRTL ? 'الرصيد الحالي' : 'Current Balance'}
                </CardTitle>
                <div className="p-2 rounded-lg bg-blue-200">
                  <Coins className="w-5 h-5 text-blue-700" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-black text-blue-900">{currentBalance}</p>
              <p className="text-xs text-blue-700 mt-1">{isRTL ? 'نقطة' : 'Points'}</p>
            </CardContent>
          </Card>

          {/* Conversion Rate */}
          <Card className="shadow-lg border-0 bg-gradient-to-br from-green-50 to-green-100">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  {isRTL ? 'سعر الصرف' : 'Conversion Rate'}
                </CardTitle>
                <div className="p-2 rounded-lg bg-green-200">
                  <DollarSign className="w-5 h-5 text-green-700" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black text-green-900">1 USD</p>
              <p className="text-xs text-green-700 mt-1">= {conversionRate} {isRTL ? 'نقطة' : 'Pts'}</p>
            </CardContent>
          </Card>

          {/* Pending Requests */}
          <Card className="shadow-lg border-0 bg-gradient-to-br from-orange-50 to-orange-100">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  {isRTL ? 'طلبات معلقة' : 'Pending Requests'}
                </CardTitle>
                <div className="p-2 rounded-lg bg-orange-200">
                  <Clock className="w-5 h-5 text-orange-700" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-black text-orange-900">
                {rechargeRequests.filter((r: RechargeRequest) => r.status === 'pending').length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {['overview', 'history', 'request'].map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab as any)}
              className={`px-4 py-2 font-bold transition-all ${
                selectedTab === tab
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab === 'overview' && (isRTL ? 'نظرة عامة' : 'Overview')}
              {tab === 'history' && (isRTL ? 'السجل' : 'History')}
              {tab === 'request' && (isRTL ? 'طلب شحن' : 'Request Recharge')}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {selectedTab === 'overview' && (
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-blue-100 to-blue-50 border-b">
              <CardTitle className="flex items-center gap-2">
                <Coins className="w-5 h-5" />
                {isRTL ? 'ملخص النقاط' : 'Points Summary'}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">{isRTL ? 'الرصيد الحالي' : 'Current Balance'}</p>
                  <p className="text-4xl font-black text-blue-900">{currentBalance}</p>
                  <p className="text-xs text-gray-500 mt-1">{isRTL ? 'نقطة متاحة' : 'Points available'}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">{isRTL ? 'الموافق عليها' : 'Approved'}</p>
                    <p className="text-2xl font-black text-green-900">
                      {rechargeRequests.filter((r: RechargeRequest) => r.status === 'approved').length}
                    </p>
                  </div>
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">{isRTL ? 'المعلقة' : 'Pending'}</p>
                    <p className="text-2xl font-black text-orange-900">
                      {rechargeRequests.filter((r: RechargeRequest) => r.status === 'pending').length}
                    </p>
                  </div>
                </div>

                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2 py-6 font-bold text-lg"
                  onClick={() => setShowRechargeForm(true)}
                >
                  <Send className="w-5 h-5" />
                  {isRTL ? 'طلب شحن جديد' : 'Request New Recharge'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* History Tab */}
        {selectedTab === 'history' && (
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-purple-100 to-purple-50 border-b">
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                {isRTL ? 'سجل العمليات' : 'Transaction History'}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {transactionLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin w-8 h-8 text-gray-400" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>{isRTL ? 'لا توجد عمليات' : 'No transactions'}</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {transactions.map((tx: PointTransaction) => (
                    <div key={tx.id} className="p-3 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-bold text-gray-900">{tx.type}</p>
                          <p className="text-xs text-gray-600">{tx.description}</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.amount > 0 ? '+' : ''}{tx.amount}
                          </p>
                          <p className="text-xs text-gray-500">{new Date(tx.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {isRTL ? 'من' : 'From'} {tx.balanceBefore} → {isRTL ? 'إلى' : 'To'} {tx.balanceAfter}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Request Tab */}
        {selectedTab === 'request' && (
          <Card className="shadow-lg border-0 max-w-md">
            <CardHeader className="bg-gradient-to-r from-green-100 to-green-50 border-b">
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                {isRTL ? 'طلب شحن' : 'Recharge Request'}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {!showRechargeForm ? (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">{isRTL ? 'الرصيد الحالي' : 'Current Balance'}</p>
                    <p className="text-3xl font-black text-blue-900">{currentBalance}</p>
                  </div>
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => setShowRechargeForm(true)}
                  >
                    {isRTL ? 'تقديم طلب' : 'Submit Request'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      {isRTL ? 'المبلغ بالدولار' : 'Amount in USD'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={rechargeAmount}
                      onChange={(e) => setRechargeAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={isRTL ? 'أدخل المبلغ' : 'Enter amount'}
                    />
                    {rechargeAmount && (
                      <p className="text-xs text-gray-600 mt-2">
                        = {(Number(rechargeAmount) * conversionRate).toFixed(0)} {isRTL ? 'نقطة' : 'Points'}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => {
                        if (!rechargeAmount || Number(rechargeAmount) <= 0) {
                          toast.error(isRTL ? 'أدخل مبلغ صحيح' : 'Enter a valid amount');
                          return;
                        }
                        if (confirm(isRTL ? 'هل تريد تقديم طلب الشحن؟' : 'Submit recharge request?')) {
                          requestRechargeMutation.mutate({
                            cafeteriaId,
                            usdAmount: Number(rechargeAmount),
                          });
                        }
                      }}
                      disabled={requestRechargeMutation.isPending}
                    >
                      {requestRechargeMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        isRTL ? 'تقديم' : 'Submit'
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowRechargeForm(false);
                        setRechargeAmount('');
                      }}
                    >
                      {isRTL ? 'إلغاء' : 'Cancel'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Recharge History */}
              {rechargeRequests.length > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <p className="font-bold text-gray-900 mb-3">{isRTL ? 'طلبات سابقة' : 'Previous Requests'}</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {rechargeRequests.map((request: RechargeRequest) => (
                      <div key={request.id} className="p-2 bg-gray-50 rounded text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold">${request.usdAmount.toFixed(2)}</span>
                          <span className={`px-2 py-0.5 rounded flex items-center gap-1 ${
                            request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            request.status === 'approved' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {request.status === 'pending' && <Clock className="w-3 h-3" />}
                            {request.status === 'approved' && <CheckCircle2 className="w-3 h-3" />}
                            {request.status === 'rejected' && <XCircle className="w-3 h-3" />}
                            {request.status === 'pending' && (isRTL ? 'معلقة' : 'Pending')}
                            {request.status === 'approved' && (isRTL ? 'موافق عليها' : 'Approved')}
                            {request.status === 'rejected' && (isRTL ? 'مرفوضة' : 'Rejected')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
