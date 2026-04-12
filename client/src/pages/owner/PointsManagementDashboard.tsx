import React, { useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTranslation } from '@/locales/useTranslation';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DollarSign,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Settings,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface RechargeRequest {
  id: string;
  cafeteriaId: string;
  usdAmount: number;
  pointsAmount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}

interface WithdrawalRequest {
  id: string;
  marketerId: string;
  pointsAmount: number;
  usdAmount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}

export default function PointsManagementDashboard() {
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const { language } = useTranslation();
  const isRTL = language === 'ar';
  const ownerId = user?.id;

  const [conversionRate, setConversionRate] = useState(10);
  const [tempRate, setTempRate] = useState(10);
  const [showRateForm, setShowRateForm] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'recharges' | 'withdrawals' | 'settings'>('recharges');

  // Fetch pending recharge requests
  const { data: rechargeData, isLoading: rechargesLoading, refetch: refetchRecharges } = trpc.pointsManagement.getPendingRecharges.useQuery(
    { ownerId: ownerId || '' },
    { enabled: !!ownerId }
  );

  // Fetch pending withdrawal requests
  const { data: withdrawalData, isLoading: withdrawalsLoading, refetch: refetchWithdrawals } = trpc.withdrawalManagement.getPendingWithdrawals.useQuery(
    { ownerId: ownerId || '' },
    { enabled: !!ownerId }
  );

  // Fetch current conversion rate
  const { data: rateData } = trpc.pointsManagement.getConversionRate.useQuery(
    { ownerId: ownerId || '' },
    { enabled: !!ownerId }
  );

  // Mutations
  const approveRechargeMutation = trpc.pointsManagement.approveRechargeRequest.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? 'تمت الموافقة على طلب الشحن' : 'Recharge request approved');
      refetchRecharges();
    },
    onError: (err) => {
      toast.error(err.message || (isRTL ? 'خطأ في الموافقة' : 'Error approving request'));
    },
  });

  const rejectRechargeMutation = trpc.pointsManagement.rejectRechargeRequest.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? 'تم رفض طلب الشحن' : 'Recharge request rejected');
      refetchRecharges();
    },
    onError: (err) => {
      toast.error(err.message || (isRTL ? 'خطأ في الرفض' : 'Error rejecting request'));
    },
  });

  const approveWithdrawalMutation = trpc.withdrawalManagement.approveWithdrawal.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? 'تمت الموافقة على طلب السحب' : 'Withdrawal request approved');
      refetchWithdrawals();
    },
    onError: (err) => {
      toast.error(err.message || (isRTL ? 'خطأ في الموافقة' : 'Error approving request'));
    },
  });

  const rejectWithdrawalMutation = trpc.withdrawalManagement.rejectWithdrawal.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? 'تم رفض طلب السحب' : 'Withdrawal request rejected');
      refetchWithdrawals();
    },
    onError: (err) => {
      toast.error(err.message || (isRTL ? 'خطأ في الرفض' : 'Error rejecting request'));
    },
  });

  const setRateMutation = trpc.pointsManagement.setConversionRate.useMutation({
    onSuccess: (data) => {
      setConversionRate(data.usdToPoints);
      setShowRateForm(false);
      toast.success(isRTL ? 'تم تحديث سعر الصرف' : 'Conversion rate updated');
    },
    onError: (err) => {
      toast.error(err.message || (isRTL ? 'خطأ في التحديث' : 'Error updating rate'));
    },
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  const pendingRecharges = rechargeData?.requests || [];
  const pendingWithdrawals = withdrawalData?.requests || [];
  const displayRate = rateData?.usdToPoints || conversionRate;

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <DashboardHeader
        showBackButton={true}
        showHomeButton={true}
        title={isRTL ? 'إدارة النقاط والعمولات' : 'Points & Commission Management'}
        onMenuClick={() => {}}
      />

      <main className="p-4 md:p-8 max-w-7xl mx-auto">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Pending Recharges */}
          <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-50 to-blue-100">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  {isRTL ? 'طلبات شحن معلقة' : 'Pending Recharges'}
                </CardTitle>
                <div className="p-2 rounded-lg bg-blue-200">
                  <DollarSign className="w-5 h-5 text-blue-700" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-black text-blue-900">{pendingRecharges.length}</p>
            </CardContent>
          </Card>

          {/* Pending Withdrawals */}
          <Card className="shadow-lg border-0 bg-gradient-to-br from-orange-50 to-orange-100">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  {isRTL ? 'طلبات سحب معلقة' : 'Pending Withdrawals'}
                </CardTitle>
                <div className="p-2 rounded-lg bg-orange-200">
                  <TrendingUp className="w-5 h-5 text-orange-700" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-black text-orange-900">{pendingWithdrawals.length}</p>
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
                  <Settings className="w-5 h-5 text-green-700" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black text-green-900">
                1 USD = {displayRate} {isRTL ? 'نقطة' : 'Pts'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {['recharges', 'withdrawals', 'settings'].map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab as any)}
              className={`px-4 py-2 font-bold transition-all ${
                selectedTab === tab
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab === 'recharges' && (isRTL ? 'طلبات الشحن' : 'Recharge Requests')}
              {tab === 'withdrawals' && (isRTL ? 'طلبات السحب' : 'Withdrawal Requests')}
              {tab === 'settings' && (isRTL ? 'الإعدادات' : 'Settings')}
            </button>
          ))}
        </div>

        {/* Recharge Requests Tab */}
        {selectedTab === 'recharges' && (
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-blue-100 to-blue-50 border-b">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                {isRTL ? 'طلبات شحن النقاط' : 'Points Recharge Requests'}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {rechargesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin w-8 h-8 text-gray-400" />
                </div>
              ) : pendingRecharges.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>{isRTL ? 'لا توجد طلبات معلقة' : 'No pending requests'}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingRecharges.map((req: RechargeRequest) => (
                    <div key={req.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-bold text-gray-900">${req.usdAmount.toFixed(2)} USD</p>
                          <p className="text-sm text-gray-600">{req.pointsAmount} {isRTL ? 'نقطة' : 'Points'}</p>
                        </div>
                        <div className="text-right text-xs text-gray-500">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
                          onClick={() => {
                            if (confirm(isRTL ? 'هل تريد الموافقة على هذا الطلب؟' : 'Approve this request?')) {
                              approveRechargeMutation.mutate({ requestId: req.id, ownerId: ownerId || '' });
                            }
                          }}
                          disabled={approveRechargeMutation.isPending}
                        >
                          {approveRechargeMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          {isRTL ? 'موافقة' : 'Approve'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-red-300 text-red-600 hover:bg-red-50 gap-2"
                          onClick={() => {
                            if (confirm(isRTL ? 'هل تريد رفض هذا الطلب؟' : 'Reject this request?')) {
                              rejectRechargeMutation.mutate({ requestId: req.id, ownerId: ownerId || '' });
                            }
                          }}
                          disabled={rejectRechargeMutation.isPending}
                        >
                          {rejectRechargeMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          {isRTL ? 'رفض' : 'Reject'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Withdrawal Requests Tab */}
        {selectedTab === 'withdrawals' && (
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-orange-100 to-orange-50 border-b">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                {isRTL ? 'طلبات سحب العمولات' : 'Commission Withdrawal Requests'}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {withdrawalsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin w-8 h-8 text-gray-400" />
                </div>
              ) : pendingWithdrawals.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>{isRTL ? 'لا توجد طلبات معلقة' : 'No pending requests'}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingWithdrawals.map((req: WithdrawalRequest) => (
                    <div key={req.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-bold text-gray-900">${req.usdAmount.toFixed(2)} USD</p>
                          <p className="text-sm text-gray-600">{req.pointsAmount} {isRTL ? 'نقطة' : 'Points'}</p>
                        </div>
                        <div className="text-right text-xs text-gray-500">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
                          onClick={() => {
                            if (confirm(isRTL ? 'هل تريد الموافقة على هذا الطلب؟' : 'Approve this request?')) {
                              approveWithdrawalMutation.mutate({ requestId: req.id, ownerId: ownerId || '' });
                            }
                          }}
                          disabled={approveWithdrawalMutation.isPending}
                        >
                          {approveWithdrawalMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          {isRTL ? 'موافقة' : 'Approve'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-red-300 text-red-600 hover:bg-red-50 gap-2"
                          onClick={() => {
                            if (confirm(isRTL ? 'هل تريد رفض هذا الطلب؟' : 'Reject this request?')) {
                              rejectWithdrawalMutation.mutate({ requestId: req.id, ownerId: ownerId || '' });
                            }
                          }}
                          disabled={rejectWithdrawalMutation.isPending}
                        >
                          {rejectWithdrawalMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          {isRTL ? 'رفض' : 'Reject'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Settings Tab */}
        {selectedTab === 'settings' && (
          <Card className="shadow-lg border-0 max-w-md">
            <CardHeader className="bg-gradient-to-r from-green-100 to-green-50 border-b">
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                {isRTL ? 'إعدادات سعر الصرف' : 'Conversion Rate Settings'}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {!showRateForm ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">{isRTL ? 'السعر الحالي' : 'Current Rate'}</p>
                    <p className="text-3xl font-black text-green-900">
                      1 USD = {displayRate} {isRTL ? 'نقطة' : 'Pts'}
                    </p>
                  </div>
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => setShowRateForm(true)}
                  >
                    {isRTL ? 'تحديث السعر' : 'Update Rate'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      {isRTL ? '1 دولار = كم نقطة؟' : '1 USD = ? Points'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="0.1"
                      value={tempRate}
                      onChange={(e) => setTempRate(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => {
                        setRateMutation.mutate({
                          ownerId: ownerId || '',
                          usdToPoints: tempRate,
                        });
                      }}
                      disabled={setRateMutation.isPending}
                    >
                      {setRateMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Save'
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowRateForm(false);
                        setTempRate(displayRate);
                      }}
                    >
                      {isRTL ? 'إلغاء' : 'Cancel'}
                    </Button>
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
