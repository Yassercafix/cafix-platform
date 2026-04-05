import { useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Calendar, DollarSign, Users, TrendingUp } from 'lucide-react';
import { useLocation } from 'wouter';
import { useTranslation } from '@/locales/useTranslation';

export default function MarketerReports() {
  const { user } = useAuth();
  const { language } = useTranslation();
  const [, setLocation] = useLocation();
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const isRTL = language === 'ar';

  const { data: report, isLoading: reportLoading } = trpc.reports.getMarketerReport.useQuery(
    {
      marketerId: user?.id || '',
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    },
    {
      enabled: !!user?.id,
    }
  );

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') {
      setStartDate(value ? new Date(value) : null);
    } else {
      setEndDate(value ? new Date(value) : null);
    }
  };

  const handleClearFilters = () => {
    setStartDate(null);
    setEndDate(null);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLocation('/dashboard/marketer')}
              className="p-2 hover:bg-white rounded-lg transition"
            >
              <ArrowLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                {isRTL ? 'تقارير المسوق' : 'Marketer Reports'}
              </h1>
              <p className="text-slate-600 mt-1">
                {isRTL ? 'تحليلات العمولات والشحنات' : 'Commission and recharge analytics'}
              </p>
            </div>
          </div>
        </div>

        {/* Date Filter */}
        <Card className="mb-6 border-0 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {isRTL ? 'تصفية حسب نطاق التاريخ' : 'Filter by Date Range'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {isRTL ? 'تاريخ البداية' : 'Start Date'}
                </label>
                <Input
                  type="date"
                  value={startDate ? startDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => handleDateChange('start', e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {isRTL ? 'تاريخ النهاية' : 'End Date'}
                </label>
                <Input
                  type="date"
                  value={endDate ? endDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => handleDateChange('end', e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={handleClearFilters}
                  className="w-full md:w-auto"
                >
                  {isRTL ? 'مسح المرشحات' : 'Clear Filters'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {reportLoading && (
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-500">{isRTL ? 'جاري تحميل التقرير...' : 'Loading report...'}</p>
          </div>
        )}

        {/* Report Summary Cards */}
        {report && !reportLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Total Earned Commissions */}
            <Card className="border-0 shadow-sm hover:shadow-md transition">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  {isRTL ? 'إجمالي المكتسب' : 'Total Earned'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">
                  ${report.totalEarnedCommissions.toFixed(2)}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {isRTL ? 'العمولات المكتسبة' : 'Commissions earned'}
                </p>
              </CardContent>
            </Card>

            {/* Total Paid Commissions */}
            <Card className="border-0 shadow-sm hover:shadow-md transition">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  {isRTL ? 'إجمالي المدفوع' : 'Total Paid'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">
                  ${report.totalPaidCommissions.toFixed(2)}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {isRTL ? 'العمولات المسحوبة' : 'Commissions withdrawn'}
                </p>
              </CardContent>
            </Card>

            {/* Pending Commissions */}
            <Card className="border-0 shadow-sm hover:shadow-md transition">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-orange-600" />
                  {isRTL ? 'قيد الانتظار' : 'Pending'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">
                  ${report.pendingCommissions.toFixed(2)}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {isRTL ? 'في انتظار الموافقة' : 'Awaiting approval'}
                </p>
              </CardContent>
            </Card>

            {/* Available Commissions */}
            <Card className="border-0 shadow-sm hover:shadow-md transition">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-purple-600" />
                  {isRTL ? 'متاح' : 'Available'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">
                  ${report.availableCommissions.toFixed(2)}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {isRTL ? 'جاهز للسحب' : 'Ready to withdraw'}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Additional Metrics */}
        {report && !reportLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Direct Children & Recharges */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  {isRTL ? 'نشاط الشبكة' : 'Downline Activity'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-600">
                      {isRTL ? 'الأطفال المباشرين' : 'Direct Children'}
                    </span>
                    <span className="text-2xl font-bold text-slate-900">
                      {report.directChildrenCount}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-600">
                      {isRTL ? 'إجمالي الشحنات من الشبكة' : 'Total Recharges from Downline'}
                    </span>
                    <span className="text-2xl font-bold text-slate-900">
                      ${report.totalRechargesFromChildren.toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary Info */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">
                  {isRTL ? 'ملخص التقرير' : 'Report Summary'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-600">
                      {isRTL ? 'المسوق' : 'Marketer'}
                    </p>
                    <p className="font-semibold text-slate-900">{report.marketerName}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-600">
                      {isRTL ? 'تم إنشاء التقرير' : 'Report Generated'}
                    </p>
                    <p className="font-semibold text-slate-900">
                      {new Date(report.reportDate).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-600">
                      {isRTL ? 'رصيد العمولة' : 'Commission Balance'}
                    </p>
                    <p className="font-semibold text-slate-900">
                      ${(report.availableCommissions + report.pendingCommissions).toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty State */}
        {!reportLoading && !report && (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">
                {isRTL ? 'تعذر تحميل التقرير. يرجى المحاولة مرة أخرى.' : 'Unable to load report. Please try again.'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
