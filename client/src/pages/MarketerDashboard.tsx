import React, { useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTranslation } from '@/locales/useTranslation';
import { trpc } from '@/lib/trpc';
import { 
  User, 
  CreditCard, 
  Wallet, 
  History, 
  Send, 
  Copy, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight, 
  ArrowDownLeft,
  Share2,
  LayoutDashboard,
  Users,
  BarChart3,
  Settings
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DashboardNavigation } from '@/components/DashboardNavigation';

export default function MarketerDashboard() {
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const { language } = useTranslation();
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const isRTL = language === 'ar';

  // Verify user is marketer
  if (!authLoading && user?.role !== 'marketer') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-red-600 font-bold">Access Denied</p>
            <p className="text-sm text-gray-500 mt-2">Only marketers can access this dashboard.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch marketer balance
  const { data: balance, isLoading: balanceLoading } = trpc.commissions.getBalance.useQuery(
    { marketerId: user?.marketerId || '' },
    { enabled: !!user?.marketerId }
  );

  // Fetch commission history
  const { data: commissionHistory, isLoading: historyLoading } = trpc.commissions.getCommissionHistory.useQuery(
    { marketerId: user?.marketerId || '' },
    { enabled: !!user?.marketerId }
  );

  // Request withdrawal mutation
  const withdrawalMutation = trpc.withdrawals.requestWithdrawal.useMutation({
    onSuccess: () => {
      setWithdrawalAmount('');
    }
  });

  const marketerInfo = {
    name: user?.name || 'Marketer',
    referenceCode: user?.referenceCode || 'N/A',
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert(isRTL ? 'تم نسخ الكود المرجعي!' : 'Reference code copied!');
  };

  const navigationItems = [
    { label: isRTL ? 'لوحة التحكم' : 'Dashboard', path: '/dashboard/marketer', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: isRTL ? 'فريقي' : 'My Team', path: '/dashboard/marketer/downlines', icon: <Users className="w-5 h-5" /> },
    { label: isRTL ? 'العمولات' : 'Commissions', path: '/dashboard/marketer/commissions', icon: <Wallet className="w-5 h-5" /> },
    { label: isRTL ? 'التقارير' : 'Reports', path: '/dashboard/marketer/reports', icon: <BarChart3 className="w-5 h-5" /> },
    { label: isRTL ? 'الإعدادات' : 'Settings', path: '/dashboard/marketer/settings', icon: <Settings className="w-5 h-5" /> },
  ];

  if (authLoading) return null;

  return (
    <div className={`min-h-screen bg-gray-50 font-sans ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <DashboardHeader 
        title={isRTL ? 'لوحة تحكم المسوق' : 'Marketer Dashboard'} 
        onMenuClick={() => setMenuOpen(true)} 
        showBackButton={false}
        showHomeButton={false}
      />
      <DashboardNavigation isOpen={menuOpen} onClose={() => setMenuOpen(false)} items={navigationItems} />

      <main className="p-4 md:p-8 max-w-7xl mx-auto">
        {/* Reference Code Card */}
        <Card className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white mb-8 border-0 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-purple-100 text-sm mb-1">{isRTL ? 'كودك المرجعي' : 'Your Reference Code'}</p>
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl font-black tracking-wider">{marketerInfo.referenceCode}</h2>
                  <Button 
                    onClick={() => copyToClipboard(marketerInfo.referenceCode)}
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20 rounded-full"
                  >
                    <Copy className="w-5 h-5" />
                  </Button>
                </div>
              </div>
              <Button className="flex items-center justify-center gap-2 px-6 py-6 bg-white text-purple-600 font-bold rounded-2xl hover:bg-purple-50 shadow-xl transition-all hover:scale-105">
                <Share2 className="w-5 h-5" />
                {isRTL ? 'مشاركة الكود' : 'Share Code'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Balance Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-0 shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                  <Clock className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{isRTL ? 'معلق' : 'Pending'}</span>
              </div>
              <p className="text-sm text-gray-500 mb-1">{isRTL ? 'الرصيد المعلق' : 'Pending Balance'}</p>
              <p className="text-3xl font-black text-gray-900">${balance?.pendingBalance || '0.00'}</p>
              <p className="text-[10px] text-gray-400 mt-2">{isRTL ? 'يتحول لرصيد متاح عند شحن الكافيتريا' : 'Converts to available on next cafeteria recharge'}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-50 rounded-xl text-green-600">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full">{isRTL ? 'متاح' : 'Available'}</span>
              </div>
              <p className="text-sm text-gray-500 mb-1">{isRTL ? 'الرصيد المتاح' : 'Available Balance'}</p>
              <p className="text-3xl font-black text-gray-900">${balance?.availableBalance || '0.00'}</p>
              <p className="text-[10px] text-gray-400 mt-2">{isRTL ? 'جاهز للسحب الفوري' : 'Ready to withdraw immediately'}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
                  <History className="w-6 h-6" />
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-1">{isRTL ? 'إجمالي المسحوبات' : 'Total Withdrawn'}</p>
              <p className="text-3xl font-black text-gray-900">${balance?.totalWithdrawn || '0.00'}</p>
              <p className="text-[10px] text-gray-400 mt-2">{isRTL ? 'إجمالي المبالغ التي تم سحبها بنجاح' : 'Total amount successfully withdrawn'}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Commission History */}
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-md">
              <CardHeader className="border-b border-gray-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold">{isRTL ? 'سجل العمولات' : 'Commission History'}</CardTitle>
                  <Button variant="link" size="sm" className="text-purple-600">{isRTL ? 'عرض الكل' : 'View All'}</Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {historyLoading ? (
                  <div className="p-8 text-center text-gray-500">Loading...</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {commissionHistory?.map((comm: any) => (
                      <div key={comm.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${comm.status === 'available' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                            {comm.status === 'available' ? <ArrowUpRight className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{comm.cafeteriaName}</p>
                            <p className="text-xs text-gray-500">{new Date(comm.createdAt).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${comm.status === 'available' ? 'text-green-600' : 'text-blue-600'}`}>+${comm.commissionAmount}</p>
                          <p className="text-[10px] text-gray-400 uppercase">{comm.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Withdrawal Form */}
          <div>
            <Card className="border-0 shadow-md">
              <CardHeader className="border-b border-gray-50">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Send className="w-5 h-5 text-purple-600" />
                  {isRTL ? 'طلب سحب' : 'Request Withdrawal'}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{isRTL ? 'المبلغ المراد سحبه ($)' : 'Amount to Withdraw ($)'}</label>
                  <Input 
                    type="number" 
                    value={withdrawalAmount}
                    onChange={(e) => setWithdrawalAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-lg font-bold py-6"
                  />
                  <p className="text-[10px] text-gray-400 mt-2">{isRTL ? 'أقصى مبلغ متاح:' : 'Max available:'} ${balance?.availableBalance || '0.00'}</p>
                </div>
                <Button 
                  onClick={() => withdrawalMutation.mutate({ amount: parseFloat(withdrawalAmount) || 0 })}
                  disabled={!withdrawalAmount || parseFloat(withdrawalAmount) <= 0 || parseFloat(withdrawalAmount) > (balance?.availableBalance || 0) || withdrawalMutation.isPending}
                  className="w-full bg-purple-600 hover:bg-purple-700 py-6 text-lg font-bold rounded-xl shadow-lg"
                >
                  {isRTL ? 'إرسال طلب السحب' : 'Submit Withdrawal Request'}
                </Button>
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-xs text-amber-700 leading-relaxed">
                    {isRTL 
                      ? '* تتم مراجعة طلبات السحب من قبل الإدارة خلال 24-48 ساعة عمل.'
                      : '* Withdrawal requests are reviewed by admin within 24-48 business hours.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
