import React, { useState, useEffect } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTranslation } from '@/locales/useTranslation';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DashboardNavigation } from '@/components/DashboardNavigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Users, LayoutDashboard, ShoppingCart, BarChart3, Lock, Unlock } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

interface StaffMember {
  id: string;
  name: string;
  role: string;
  loginUsername: string;
  canLogin: boolean;
  status: string;
}

export default function ManagerStaff() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const { language } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const isRTL = language === 'ar';
  const cafeteriaId = user?.cafeteriaId;

  const navigationItems = [
    { label: isRTL ? 'لوحة التحكم' : 'Dashboard', path: '/dashboard/manager', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: isRTL ? 'الطلبات' : 'Orders', path: '/dashboard/manager/orders', icon: <ShoppingCart className="w-5 h-5" /> },
    { label: isRTL ? 'الموظفين' : 'Staff', path: '/dashboard/manager/staff', icon: <Users className="w-5 h-5" /> },
    { label: isRTL ? 'التقارير' : 'Reports', path: '/dashboard/manager/reports', icon: <BarChart3 className="w-5 h-5" /> },
  ];

  const fetchStaff = async () => {
    if (!cafeteriaId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cafeteria_staff')
        .select('*')
        .eq('cafeteria_id', cafeteriaId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        role: s.role,
        loginUsername: s.login_username,
        canLogin: s.can_login !== false,
        status: s.status,
      }));

      setStaffList(mapped);
    } catch (err: any) {
      console.error('Error fetching staff:', err);
      toast.error(isRTL ? 'خطأ في تحميل بيانات الموظفين' : 'Error loading staff data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [cafeteriaId]);

  const handleToggleLogin = async (staffId: string, currentStatus: boolean) => {
    setUpdating(staffId);
    try {
      const { error } = await supabase
        .from('cafeteria_staff')
        .update({ can_login: !currentStatus })
        .eq('id', staffId);

      if (error) throw error;

      toast.success(
        !currentStatus
          ? (isRTL ? 'تم تفعيل تسجيل الدخول' : 'Login enabled')
          : (isRTL ? 'تم تعطيل تسجيل الدخول' : 'Login disabled')
      );

      fetchStaff();
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'خطأ في تحديث الحالة' : 'Error updating status'));
    } finally {
      setUpdating(null);
    }
  };

  const getRoleBadge = (role: string) => {
    const roleMap: { [key: string]: { label: string; color: string } } = {
      waiter: { label: isRTL ? 'نادل' : 'Waiter', color: 'bg-blue-100 text-blue-800' },
      chef: { label: isRTL ? 'شيف' : 'Chef', color: 'bg-orange-100 text-orange-800' },
      manager: { label: isRTL ? 'مدير' : 'Manager', color: 'bg-purple-100 text-purple-800' },
    };
    const roleInfo = roleMap[role] || { label: role, color: 'bg-gray-100 text-gray-800' };
    return <Badge className={`${roleInfo.color} border-0`}>{roleInfo.label}</Badge>;
  };

  return (
    <div className={`min-h-screen bg-gray-50 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <DashboardHeader showBackButton={true} showHomeButton={true}
        title={isRTL ? 'إدارة الموظفين' : 'Manage Staff'}
        icon={<Users className="w-5 h-5" />}
        onMenuToggle={setMenuOpen}
        menuOpen={menuOpen}
      />
      <div className="flex">
        <DashboardNavigation items={navigationItems} open={menuOpen} onClose={() => setMenuOpen(false)} />
        <main className="flex-1 p-4 md:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{isRTL ? 'الموظفون' : 'Staff Members'}</h2>
            <p className="text-sm text-gray-600 mt-1">
              {isRTL ? 'إدارة صلاحيات تسجيل الدخول للموظفين' : 'Manage staff login permissions'}
            </p>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="text-center py-12 text-gray-400">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
              ) : staffList.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">{isRTL ? 'لا يوجد موظفون' : 'No staff members found'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                        <TableHead>{isRTL ? 'الدور' : 'Role'}</TableHead>
                        <TableHead>{isRTL ? 'اسم المستخدم' : 'Username'}</TableHead>
                        <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                        <TableHead>{isRTL ? 'تسجيل الدخول' : 'Login'}</TableHead>
                        <TableHead>{isRTL ? 'الإجراءات' : 'Actions'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staffList.map((staff) => (
                        <TableRow key={staff.id} className="hover:bg-gray-50">
                          <TableCell className="font-semibold text-gray-900">{staff.name}</TableCell>
                          <TableCell>{getRoleBadge(staff.role)}</TableCell>
                          <TableCell className="text-sm text-gray-600">{staff.loginUsername}</TableCell>
                          <TableCell>
                            <Badge className="bg-green-100 text-green-800 border-0">
                              {isRTL ? 'نشط' : 'Active'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {staff.canLogin ? (
                                <Unlock className="w-4 h-4 text-green-600" />
                              ) : (
                                <Lock className="w-4 h-4 text-red-600" />
                              )}
                              <span className="text-sm">
                                {staff.canLogin
                                  ? (isRTL ? 'مفعل' : 'Enabled')
                                  : (isRTL ? 'معطل' : 'Disabled')}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleLogin(staff.id, staff.canLogin)}
                              disabled={updating === staff.id}
                              className={staff.canLogin ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
                            >
                              {updating === staff.id
                                ? '...'
                                : (staff.canLogin
                                  ? (isRTL ? 'تعطيل' : 'Disable')
                                  : (isRTL ? 'تفعيل' : 'Enable'))}
                            </Button>
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
