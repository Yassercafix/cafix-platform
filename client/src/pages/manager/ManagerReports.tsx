import React, { useState, useEffect } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTranslation } from '@/locales/useTranslation';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DashboardNavigation } from '@/components/DashboardNavigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart3, LayoutDashboard, ShoppingCart, Users, Download, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

interface OrderReport {
  id: string;
  tableNumber: number;
  totalAmount: number;
  itemCount: number;
  status: string;
  createdAt: string;
}

export default function ManagerReports() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const { language } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reports, setReports] = useState<OrderReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const isRTL = language === 'ar';
  const cafeteriaId = user?.cafeteriaId;

  const navigationItems = [
    { label: isRTL ? 'لوحة التحكم' : 'Dashboard', path: '/dashboard/manager', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: isRTL ? 'الطلبات' : 'Orders', path: '/dashboard/manager/orders', icon: <ShoppingCart className="w-5 h-5" /> },
    { label: isRTL ? 'الموظفين' : 'Staff', path: '/dashboard/manager/staff', icon: <Users className="w-5 h-5" /> },
    { label: isRTL ? 'التقارير' : 'Reports', path: '/dashboard/manager/reports', icon: <BarChart3 className="w-5 h-5" /> },
  ];

  const fetchReports = async () => {
    if (!cafeteriaId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select('id, table_number, total_amount, status, created_at')
        .eq('cafeteria_id', cafeteriaId);

      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }
      if (dateTo) {
        query = query.lte('created_at', dateTo);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((o: any) => ({
        id: o.id,
        tableNumber: o.table_number,
        totalAmount: o.total_amount,
        itemCount: 0,
        status: o.status,
        createdAt: o.created_at,
      }));

      setReports(mapped);
    } catch (err: any) {
      console.error('Error fetching reports:', err);
      toast.error(isRTL ? 'خطأ في تحميل التقارير' : 'Error loading reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [cafeteriaId]);

  const handleExport = () => {
    const csv = [
      ['Table', 'Amount', 'Status', 'Date'],
      ...reports.map(r => [
        r.tableNumber,
        r.totalAmount.toFixed(2),
        r.status,
        new Date(r.createdAt).toLocaleDateString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reports-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const totalRevenue = reports.reduce((acc, r) => acc + r.totalAmount, 0);
  const totalOrders = reports.length;
  const completedOrders = reports.filter(r => r.status === 'completed').length;

  return (
    <div className={`min-h-screen bg-gray-50 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <DashboardHeader showBackButton={true} showHomeButton={true}
        title={isRTL ? 'التقارير' : 'Reports'}
        icon={<BarChart3 className="w-5 h-5" />}
        onMenuToggle={setMenuOpen}
        menuOpen={menuOpen}
      />
      <div className="flex">
        <DashboardNavigation items={navigationItems} open={menuOpen} onClose={() => setMenuOpen(false)} />
        <main className="flex-1 p-4 md:p-8">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
              <CardContent className="p-4">
                <p className="text-3xl font-bold">{totalRevenue.toFixed(2)}</p>
                <p className="text-xs opacity-80">{isRTL ? 'إجمالي الإيرادات' : 'Total Revenue'}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
              <CardContent className="p-4">
                <p className="text-3xl font-bold">{totalOrders}</p>
                <p className="text-xs opacity-80">{isRTL ? 'إجمالي الطلبات' : 'Total Orders'}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
              <CardContent className="p-4">
                <p className="text-3xl font-bold">{completedOrders}</p>
                <p className="text-xs opacity-80">{isRTL ? 'الطلبات المكتملة' : 'Completed Orders'}</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label>{isRTL ? 'من التاريخ' : 'From Date'}</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <Label>{isRTL ? 'إلى التاريخ' : 'To Date'}</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button
                    onClick={fetchReports}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isRTL ? 'بحث' : 'Search'}
                  </Button>
                </div>
                <div className="flex items-end gap-2">
                  <Button
                    onClick={handleExport}
                    variant="outline"
                    className="flex-1 gap-2"
                  >
                    <Download className="w-4 h-4" />
                    {isRTL ? 'تصدير' : 'Export'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reports Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="text-center py-12 text-gray-400">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
              ) : reports.length === 0 ? (
                <div className="text-center py-12">
                  <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">{isRTL ? 'لا توجد تقارير' : 'No reports found'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>{isRTL ? 'رقم الطاولة' : 'Table #'}</TableHead>
                        <TableHead>{isRTL ? 'المبلغ' : 'Amount'}</TableHead>
                        <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                        <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                        <TableHead>{isRTL ? 'الوقت' : 'Time'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports.map((report) => (
                        <TableRow key={report.id} className="hover:bg-gray-50">
                          <TableCell className="font-bold text-lg">{report.tableNumber}</TableCell>
                          <TableCell className="font-semibold text-green-600">{report.totalAmount.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge className={report.status === 'completed' ? 'bg-green-100 text-green-800 border-0' : 'bg-gray-100 text-gray-800 border-0'}>
                              {report.status === 'completed' ? (isRTL ? 'مكتمل' : 'Completed') : report.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {new Date(report.createdAt).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {new Date(report.createdAt).toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
