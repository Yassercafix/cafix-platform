import React, { useState, useEffect } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTranslation } from '@/locales/useTranslation';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DashboardNavigation } from '@/components/DashboardNavigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table2, LayoutDashboard, ShoppingCart, QrCode, CheckCircle, Clock, AlertCircle, Users } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

interface Table {
  id: string;
  tableNumber: number;
  capacity: number;
  status: string;
  sectionName?: string;
  tableToken?: string;
}

export default function WaiterTables() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const { language } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const isRTL = language === 'ar';
  const cafeteriaId = user?.cafeteriaId;

  const navigationItems = [
    { label: isRTL ? 'لوحة التحكم' : 'Dashboard', path: '/dashboard/waiter', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: isRTL ? 'الطاولات' : 'Tables', path: '/dashboard/waiter/tables', icon: <Table2 className="w-5 h-5" /> },
    { label: isRTL ? 'الطلبات' : 'Orders', path: '/dashboard/waiter/orders', icon: <ShoppingCart className="w-5 h-5" /> },
  ];

  const fetchTables = async () => {
    if (!cafeteriaId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cafeteria_tables')
        .select('*, sections(name)')
        .eq('cafeteria_id', cafeteriaId)
        .order('table_number');

      if (error) throw error;

      const mapped = (data || []).map((t: any) => ({
        id: t.id,
        tableNumber: t.table_number,
        capacity: t.capacity,
        status: t.status,
        sectionName: t.sections?.name,
        tableToken: t.table_token,
      }));

      setTables(mapped);
    } catch (err: any) {
      console.error('Error fetching tables:', err);
      toast.error(isRTL ? 'خطأ في تحميل الطاولات' : 'Error loading tables');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
    const interval = setInterval(fetchTables, 10000);
    return () => clearInterval(interval);
  }, [cafeteriaId]);

  const handleUpdateTableStatus = async (tableId: string, newStatus: string) => {
    setUpdating(tableId);
    try {
      const { error } = await supabase
        .from('cafeteria_tables')
        .update({ status: newStatus })
        .eq('id', tableId);

      if (error) throw error;

      toast.success(isRTL ? 'تم تحديث حالة الطاولة' : 'Table status updated');
      fetchTables();
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'خطأ في تحديث الحالة' : 'Error updating status'));
    } finally {
      setUpdating(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800';
      case 'occupied':
        return 'bg-orange-100 text-orange-800';
      case 'reserved':
        return 'bg-blue-100 text-blue-800';
      case 'cleaning':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available':
        return isRTL ? 'فارغة' : 'Available';
      case 'occupied':
        return isRTL ? 'مشغولة' : 'Occupied';
      case 'reserved':
        return isRTL ? 'محجوزة' : 'Reserved';
      case 'cleaning':
        return isRTL ? 'قيد التنظيف' : 'Cleaning';
      default:
        return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
        return <CheckCircle className="w-4 h-4" />;
      case 'occupied':
        return <Users className="w-4 h-4" />;
      case 'reserved':
        return <Clock className="w-4 h-4" />;
      case 'cleaning':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const availableTables = tables.filter(t => t.status === 'available').length;
  const occupiedTables = tables.filter(t => t.status === 'occupied').length;

  return (
    <div className={`min-h-screen bg-gray-50 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <DashboardHeader showBackButton={true} showHomeButton={true}
        title={isRTL ? 'الطاولات' : 'Tables'}
        icon={<Table2 className="w-5 h-5" />}
        onMenuToggle={setMenuOpen}
        menuOpen={menuOpen}
      />
      <div className="flex">
        <DashboardNavigation items={navigationItems} open={menuOpen} onClose={() => setMenuOpen(false)} />
        <main className="flex-1 p-4 md:p-8">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
              <CardContent className="p-4">
                <p className="text-3xl font-bold">{tables.length}</p>
                <p className="text-xs opacity-80">{isRTL ? 'إجمالي الطاولات' : 'Total Tables'}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
              <CardContent className="p-4">
                <p className="text-3xl font-bold">{availableTables}</p>
                <p className="text-xs opacity-80">{isRTL ? 'طاولات فارغة' : 'Available'}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0">
              <CardContent className="p-4">
                <p className="text-3xl font-bold">{occupiedTables}</p>
                <p className="text-xs opacity-80">{isRTL ? 'طاولات مشغولة' : 'Occupied'}</p>
              </CardContent>
            </Card>
          </div>

          {/* Tables Grid */}
          {loading ? (
            <div className="text-center py-12 text-gray-400">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
          ) : tables.length === 0 ? (
            <div className="text-center py-12">
              <Table2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">{isRTL ? 'لا توجد طاولات' : 'No tables found'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {tables.map((table) => (
                <Card
                  key={table.id}
                  className={`cursor-pointer transition-all hover:shadow-lg border-2 ${
                    table.status === 'available'
                      ? 'border-green-200 bg-green-50'
                      : table.status === 'occupied'
                      ? 'border-orange-200 bg-orange-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <CardContent className="p-4 text-center">
                    <div className="mb-3">
                      <p className="text-3xl font-bold text-gray-900">{table.tableNumber}</p>
                      <p className="text-xs text-gray-600">{table.sectionName}</p>
                    </div>
                    <div className="mb-3">
                      <Badge className={`${getStatusColor(table.status)} border-0 flex items-center justify-center gap-1 w-full`}>
                        {getStatusIcon(table.status)}
                        {getStatusLabel(table.status)}
                      </Badge>
                    </div>
                    <div className="mb-3">
                      <p className="text-xs text-gray-600">
                        {isRTL ? 'السعة' : 'Capacity'}: {table.capacity}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-center">
                      {table.status !== 'available' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateTableStatus(table.id, 'available')}
                          disabled={updating === table.id}
                          className="text-xs"
                        >
                          {updating === table.id ? '...' : (isRTL ? 'تحرير' : 'Clear')}
                        </Button>
                      )}
                      {table.status === 'available' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateTableStatus(table.id, 'occupied')}
                          disabled={updating === table.id}
                          className="text-xs"
                        >
                          {updating === table.id ? '...' : (isRTL ? 'احتلال' : 'Occupy')}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
