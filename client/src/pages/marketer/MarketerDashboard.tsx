import React, { useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTranslation } from '@/locales/useTranslation';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Coins,
  TrendingUp,
  Send,
  History,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface CommissionRecord {
  id: string;
  orderId: string;
  commissionPercentage: number;
  orderAmount: number;
  commissionAmount: number;
  commissionPoints: number;
  status: 'pending' | 'available' | 'withdrawn';
  createdAt: Date;
}

interface WithdrawalRequest {
  id: string;
  pointsAmount: number;
  usdAmount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  approvedAt?: Date;
  markedAsPaidAt?: Date;
}

export default function MarketerDashboard() {
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const { language } = useTranslation();
  const isRTL = language === 'ar';
  const marketerId = user?.id;

  const [selectedTab, setSelectedTab] = useState<'overview' | 'history' | 'withdraw'>('overview');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);

  // Fetch balance
  const { data: balanceData, isLoading: balanceLoading } = trpc.commissionManagement.getMarketerBalance.useQuery(
    { marketerId: marketerId || '' },
    { enabled: !!marketerId }
  );

  // Fetch commission history
  const { data: historyData, isLoading: historyLoading } = trpc.commissionManagement.getMarketerCommissionHistory.useQuery(
    { marketerId: marketerId || '', limit: 100 },
    { enabled: !!marketerId }
  );

  // Fetch withdrawal history
  const { data: withdrawalHistoryData, isLoading: withdrawalHistoryLoading, refetch: refetchWithdrawals } = trpc.withdrawalManagement.getWithdrawalHistory.useQuery(
    { marketerId: marketerId || '', limit: 50 },
    { enabled: !!marketerId }
  );

  // Mutations
  const requestWithdrawalMutation = trpc.withdrawalManagement.requestWithdrawal.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? 'تم تقديم طلب السحب' : 'Withdrawal request submitted');
      setWithdrawAmount('');
      setShowWithdrawForm(false);
      refetchWithdrawals();
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

  const balance = balanceData || {
    pendingPoints: 0,
    availablePoints: 0,
    withdrawnPoints: 0,
    totalPoints: 0,
  };

  const commissions = historyData?.records || [];
  const withdrawals = withdrawalHistoryData?.requests || [];

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <DashboardHeader
        showBackButton={true}
        showHomeButton={true}
        title={isRTL ? 'لوحة تحكم المسوق' : 'Marketer Dashboard'}
        onMenuClick={() => {}}
      />

      <main className="p-4 md:p-8 max-w-7xl mx-auto">
        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Total Points */}
          <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-50 to-blue-100">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  {isRTL ? 'إجمالي النقاط' : 'Total Points'}
                </CardTitle>
                <div className="p-2 rounded-lg bg-blue-200">
                  <Coins className="w-5 h-5 text-blue-700" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-black text-blue-900">{balance.totalPoints}</p>
            </CardContent>
          </Card>

          {/* Pending Points */}
          <Card className="shadow-lg border-0 bg-gradient-to-br from-yellow-50 to-yellow-100">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  {isRTL ? 'معلقة' : 'Pending'}
                </CardTitle>
                <div className="p-2 rounded-lg bg-yellow-200">
                  <Clock className="w-5 h-5 text-yellow-700" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-black text-yellow-900">{balance.pendingPoints}</p>
            </CardContent>
          </Card>

          {/* Available Points */}
          <Card className="shadow-lg border-0 bg-gradient-to-br from-green-50 to-green-100">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  {isRTL ? 'متاحة للسحب' : 'Available'}
                </CardTitle>
                <div className="p-2 rounded-lg bg-green-200">
                  <CheckCircle2 className="w-5 h-5 text-green-700" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-black text-green-900">{balance.availablePoints}</p>
            </CardContent>
          </Card>

          {/* Withdrawn Points */}
          <Card className="shadow-lg border-0 bg-gradient-to-br from-purple-50 to-purple-100">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  {isRTL ? 'مسحوبة' : 'Withdrawn'}
                </CardTitle>
                <div className="p-2 rounded-lg bg-purple-200">
                  <TrendingUp className="w-5 h-5 text-purple-700" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-black text-purple-900">{balance.withdrawnPoints}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {['overview', 'history', 'withdraw'].map((tab) => (
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
              {tab === 'withdraw' && (isRTL ? 'طلب سحب' : 'Withdrawal')}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {selectedTab === 'overview' && (
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-blue-100 to-blue-50 border-b">
              <CardTitle className="flex items-center gap-2">
                <Coins className="w-5 h-5" />
                {isRTL ? 'ملخص العمولات' : 'Commission Summary'}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">{isRTL ? 'النقاط المعلقة' : 'Pending Points'}</p>
                  <p className="text-3xl font-black text-blue-900">{balance.pendingPoints}</p>
                  <p className="text-xs text-gray-500 mt-1">{isRTL ? 'في انتظار موافقة المالك' : 'Awaiting owner approval'}</p>
                </div>

                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">{isRTL ? 'النقاط المتاحة' : 'Available Points'}</p>
                  <p className="text-3xl font-black text-green-900">{balance.availablePoints}</p>
                  <p className="text-xs text-gray-500 mt-1">{isRTL ? 'جاهزة للسحب' : 'Ready to withdraw'}</p>
                </div>

                {balance.availablePoints > 0 && (
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white gap-2 py-6 font-bold text-lg"
                    onClick={() => setShowWithdrawForm(true)}
                  >
                    <Send className="w-5 h-5" />
                    {isRTL ? 'طلب سحب' : 'Request Withdrawal'}
                  </Button>
                )}
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
                {isRTL ? 'سجل العمولات' : 'Commission History'}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin w-8 h-8 text-gray-400" />
                </div>
              ) : commissions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>{isRTL ? 'لا توجد عمولات' : 'No commissions yet'}</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {commissions.map((commission: CommissionRecord) => (
                    <div key={commission.id} className="p-3 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-bold text-gray-900">${commission.commissionAmount.toFixed(2)}</p>
                          <p className="text-xs text-gray-600">{commission.commissionPoints} {isRTL ? 'نقطة' : 'Points'}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-xs font-bold px-2 py-1 rounded ${
                            commission.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            commission.status === 'available' ? 'bg-green-100 text-green-800' :
                            'bg-purple-100 text-purple-800'
                          }`}>
                            {commission.status === 'pending' && (isRTL ? 'معلقة' : 'Pending')}
                            {commission.status === 'available' && (isRTL ? 'متاحة' : 'Available')}
                            {commission.status === 'withdrawn' && (isRTL ? 'مسحوبة' : 'Withdrawn')}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">{new Date(commission.createdAt).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Withdrawal Tab */}
        {selectedTab === 'withdraw' && (
          <Card className="shadow-lg border-0 max-w-md">
            <CardHeader className="bg-gradient-to-r from-green-100 to-green-50 border-b">
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                {isRTL ? 'طلب سحب' : 'Withdrawal Request'}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {!showWithdrawForm ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">{isRTL ? 'النقاط المتاحة' : 'Available Points'}</p>
                    <p className="text-3xl font-black text-green-900">{balance.availablePoints}</p>
                  </div>
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => setShowWithdrawForm(true)}
                    disabled={balance.availablePoints === 0}
                  >
                    {isRTL ? 'تقديم طلب' : 'Submit Request'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      {isRTL ? 'عدد النقاط' : 'Points Amount'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={balance.availablePoints}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={isRTL ? 'أدخل عدد النقاط' : 'Enter points amount'}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => {
                        if (!withdrawAmount || Number(withdrawAmount) <= 0) {
                          toast.error(isRTL ? 'أدخل مبلغ صحيح' : 'Enter a valid amount');
                          return;
                        }
                        if (confirm(isRTL ? 'هل تريد تقديم طلب السحب؟' : 'Submit withdrawal request?')) {
                          requestWithdrawalMutation.mutate({
                            marketerId: marketerId || '',
                            pointsAmount: Number(withdrawAmount),
                          });
                        }
                      }}
                      disabled={requestWithdrawalMutation.isPending}
                    >
                      {requestWithdrawalMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        isRTL ? 'تقديم' : 'Submit'
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowWithdrawForm(false);
                        setWithdrawAmount('');
                      }}
                    >
                      {isRTL ? 'إلغاء' : 'Cancel'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Withdrawal History */}
              {withdrawals.length > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <p className="font-bold text-gray-900 mb-3">{isRTL ? 'طلبات السحب السابقة' : 'Previous Requests'}</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {withdrawals.map((withdrawal: WithdrawalRequest) => (
                      <div key={withdrawal.id} className="p-2 bg-gray-50 rounded text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold">{withdrawal.pointsAmount} {isRTL ? 'نقطة' : 'Pts'}</span>
                          <span className={`px-2 py-0.5 rounded ${
                            withdrawal.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            withdrawal.status === 'approved' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {withdrawal.status === 'pending' && (isRTL ? 'معلقة' : 'Pending')}
                            {withdrawal.status === 'approved' && (isRTL ? 'موافق عليها' : 'Approved')}
                            {withdrawal.status === 'rejected' && (isRTL ? 'مرفوضة' : 'Rejected')}
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
