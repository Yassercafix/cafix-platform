import { useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Calendar, DollarSign, Store, Users } from 'lucide-react';
import { useLocation } from 'wouter';
import { useTranslation } from '@/locales/useTranslation';

export default function OwnerReports() {
  const { user } = useAuth();
  const { language } = useTranslation();
  const [, setLocation] = useLocation();
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const isRTL = language === 'ar';

  const { data: report, isLoading: reportLoading } = trpc.reports.getOwnerReport.useQuery(
    {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
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
              onClick={() => setLocation('/dashboard/owner')}
              className="p-2 hover:bg-white rounded-lg transition"
            >
              <ArrowLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                {isRTL ? 'تقارير المالك' : 'Owner Reports'}
              </h1>
              <p className="text-slate-600 mt-1">
                {isRTL ? 'نظرة عامة على النظام' : 'System overview and analytics'}
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
            {/* Total System Recharges */}
            <Card className="border-0 shadow-sm hover:shadow-md transition">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  {isRTL ? 'إجمالي الشحنات' : 'Total Recharges'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">
                  ${report.totalRecharges.toFixed(2)}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {isRTL ? 'في النظام' : 'System-wide'}
                </p>
              </CardContent>
            </Card>

            {/* Total Commissions Distributed */}
            <Card className="border-0 shadow-sm hover:shadow-md transition">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-blue-600" />
                  {isRTL ? 'إجمالي العمولات' : 'Total Commissions'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">
                  ${report.totalCommissionsDistributed.toFixed(2)}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {isRTL ? 'موزعة' : 'Distributed'}
                </p>
              </CardContent>
            </Card>

            {/* Total Cafeterias */}
            <Card className="border-0 shadow-sm hover:shadow-md transition">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                  <Store className="w-4 h-4 text-orange-600" />
                  {isRTL ? 'إجمالي الكافتيريات' : 'Total Cafeterias'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">
                  {report.totalCafeterias}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {isRTL ? 'نشطة' : 'Active'}
                </p>
              </CardContent>
            </Card>

            {/* Total Marketers */}
            <Card className="border-0 shadow-sm hover:shadow-md transition">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600" />
                  {isRTL ? 'إجمالي المسوقين' : 'Total Marketers'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">
                  {report.totalMarketers}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {isRTL ? 'في الشبكة' : 'In network'}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* System Overview */}
        {report && !reportLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Financial Summary */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  {isRTL ? 'الملخص المالي' : 'Financial Summary'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-600">
                      {isRTL ? 'إجمالي الشحنات' : 'Total Recharges'}
                    </span>
                    <span className="text-2xl font-bold text-slate-900">
                      ${report.totalRecharges.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-600">
                      {isRTL ? 'إجمالي العمولات' : 'Total Commissions'}
                    </span>
                    <span className="text-2xl font-bold text-slate-900">
                      ${report.totalCommissionsDistributed.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-600">
                      {isRTL ? 'نسبة العمولة' : 'Commission Ratio'}
                    </span>
                    <span className="text-2xl font-bold text-slate-900">
                      {report.totalRecharges > 0 ? ((report.totalCommissionsDistributed / report.totalRecharges) * 100).toFixed(1) : '0'}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Network Overview */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  {isRTL ? 'نظرة عامة على الشبكة' : 'Network Overview'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-600">
                      {isRTL ? 'إجمالي الكافتيريات' : 'Total Cafeterias'}
                    </span>
                    <span className="text-2xl font-bold text-slate-900">
                      {report.totalCafeterias}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-600">
                      {isRTL ? 'إجمالي المسوقين' : 'Total Marketers'}
                    </span>
                    <span className="text-2xl font-bold text-slate-900">
                      {report.totalMarketers}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-600">
                      {isRTL ? 'متوسط الكافتيريات لكل مسوق' : 'Avg Cafeterias/Marketer'}
                    </span>
                    <span className="text-2xl font-bold text-slate-900">
                      {report.totalMarketers > 0 ? (report.totalCafeterias / report.totalMarketers).toFixed(1) : '0'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Report Info */}
        {report && !reportLoading && (
          <Card className="mt-6 border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">
                {isRTL ? 'معلومات التقرير' : 'Report Information'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    {isRTL ? 'نطاق التاريخ' : 'Date Range'}
                  </p>
                  <p className="font-semibold text-slate-900">
                    {startDate && endDate
                      ? `${startDate.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')} - ${endDate.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}`
                      : isRTL ? 'كل الوقت' : 'All Time'}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-600">
                    {isRTL ? 'حالة النظام' : 'System Status'}
                  </p>
                  <p className="font-semibold text-green-600">
                    {isRTL ? 'نشط' : 'Active'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
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
