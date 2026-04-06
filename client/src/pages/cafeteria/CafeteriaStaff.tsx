import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTranslation } from '@/locales/useTranslation';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DashboardNavigation } from '@/components/DashboardNavigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  Users, LayoutDashboard, UtensilsCrossed, Table2, BarChart3, CreditCard, Settings,
  Plus, Edit, Trash2, Lock, Unlock, ChefHat, UserCheck, Phone, Mail, ShieldCheck, ShieldAlert
} from 'lucide-react';
import { trpcVanilla as trpc } from '@/lib/trpcVanilla';
import { toast } from 'sonner';

interface StaffMember {
  id: string;
  name: string;
  role: string;
  loginUsername: string;
  phone?: string;
  status: string;
  canLogin: boolean;
  cafeteriaId: string;
  referenceCode?: string;
}

export default function CafeteriaStaff() {
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const { language } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isRTL = language === 'ar';

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    role: 'waiter',
    loginUsername: '',
    password: '',
    phone: '',
  });

  const cafeteriaId = user?.cafeteriaId;

  const navigationItems = [
    { label: isRTL ? 'لوحة التحكم' : 'Dashboard', path: '/dashboard/cafeteria-admin', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: isRTL ? 'المنيو' : 'Menu', path: '/dashboard/cafeteria-admin/menu', icon: <UtensilsCrossed className="w-5 h-5" /> },
    { label: isRTL ? 'الطاولات' : 'Tables', path: '/dashboard/cafeteria-admin/tables', icon: <Table2 className="w-5 h-5" /> },
    { label: isRTL ? 'الموظفين' : 'Staff', path: '/dashboard/cafeteria-admin/staff', icon: <Users className="w-5 h-5" /> },
    { label: isRTL ? 'التقارير' : 'Reports', path: '/dashboard/cafeteria-admin/reports', icon: <BarChart3 className="w-5 h-5" /> },
    { label: isRTL ? 'شحن النقاط' : 'Recharge', path: '/dashboard/cafeteria-admin/recharge', icon: <CreditCard className="w-5 h-5" /> },
    { label: isRTL ? 'الإعدادات' : 'Settings', path: '/dashboard/cafeteria-admin/settings', icon: <Settings className="w-5 h-5" /> },
  ];

  const fetchStaff = useCallback(async () => {
    if (!cafeteriaId) return;
    setLoading(true);
    try {
      const data = await trpc.staff.getStaff.query({ cafeteriaId });
      const mapped: StaffMember[] = (data || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        role: s.role,
        loginUsername: s.loginUsername,
        phone: s.phone,
        status: s.status,
        canLogin: s.canLogin,
        cafeteriaId: s.cafeteriaId,
        referenceCode: s.referenceCode,
      }));
      setStaffList(mapped);
    } catch (err: any) {
      toast.error(isRTL ? 'خطأ في تحميل بيانات الموظفين' : 'Error loading staff data');
    } finally {
      setLoading(false);
    }
  }, [cafeteriaId, isRTL]);

  useEffect(() => {
    if (!authLoading && cafeteriaId) {
      fetchStaff();
    }
  }, [cafeteriaId, authLoading, fetchStaff]);

  const handleAddStaff = async () => {
    if (!cafeteriaId) return;
    if (!formData.name || !formData.loginUsername || !formData.password) {
      toast.error(isRTL ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields');
      return;
    }
    if (formData.password.length < 6) {
      toast.error(isRTL ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters');
      return;
    }
    setSubmitting(true);
    try {
      await trpc.staff.createStaff.mutate({
        cafeteriaId,
        name: formData.name,
        role: formData.role as 'cafeteria_admin' | 'manager' | 'waiter' | 'chef',
        loginUsername: formData.loginUsername.trim().toLowerCase(),
        password: formData.password,
        phone: formData.phone || undefined,
      });
      toast.success(isRTL ? 'تم إضافة الموظف بنجاح' : 'Staff member added successfully');
      setShowAddDialog(false);
      setFormData({ name: '', role: 'waiter', loginUsername: '', password: '', phone: '' });
      fetchStaff();
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || (isRTL ? 'خطأ في إضافة الموظف' : 'Error adding staff');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLogin = async (staff: StaffMember) => {
    try {
      await trpc.staff.toggleStaffLogin.mutate({
        staffId: staff.id,
        enable: !staff.canLogin,
      });
      toast.success(
        staff.canLogin
          ? (isRTL ? 'تم تعطيل تسجيل الدخول' : 'Login disabled')
          : (isRTL ? 'تم تفعيل تسجيل الدخول' : 'Login enabled')
      );
      fetchStaff();
    } catch (err: any) {
      toast.error(isRTL ? 'خطأ في تغيير الصلاحية' : 'Error toggling login');
    }
  };

  const handleDeleteStaff = async () => {
    if (!selectedStaff) return;
    setSubmitting(true);
    try {
      await trpc.staff.deleteStaff.mutate({ staffId: selectedStaff.id });
      toast.success(isRTL ? 'تم حذف الموظف' : 'Staff member deleted');
      setShowDeleteDialog(false);
      fetchStaff();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || (isRTL ? 'خطأ في حذف الموظف' : 'Error deleting staff'));
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const roleMap: Record<string, { label: string; labelAr: string; color: string }> = {
      cafeteria_admin: { label: 'Admin', labelAr: 'مدير كافيتريا', color: 'bg-purple-100 text-purple-700' },
      manager: { label: 'Manager', labelAr: 'مدير', color: 'bg-blue-100 text-blue-700' },
      waiter: { label: 'Waiter', labelAr: 'نادل', color: 'bg-green-100 text-green-700' },
      chef: { label: 'Chef', labelAr: 'شيف', color: 'bg-orange-100 text-orange-700' },
    };
    const r = roleMap[role] || { label: role, labelAr: role, color: 'bg-gray-100 text-gray-700' };
    return (
      <Badge className={`${r.color} border-0 font-bold`}>
        {isRTL ? r.labelAr : r.label}
      </Badge>
    );
  };

  if (authLoading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  return (
    <div className={`min-h-screen bg-slate-50 pb-20 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <DashboardHeader showBackButton={true} showHomeButton={true} title={isRTL ? 'إدارة الموظفين' : 'Staff Management'} onMenuClick={() => setMenuOpen(true)} />
      <DashboardNavigation isOpen={menuOpen} onClose={() => setMenuOpen(false)} items={navigationItems} />

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900">{isRTL ? 'طاقم العمل' : 'Staff Members'}</h1>
            <p className="text-slate-500">{isRTL ? 'إدارة الموظفين وصلاحيات تسجيل الدخول الخاصة بهم' : 'Manage staff members and their login permissions'}</p>
          </div>
          <Button onClick={() => setShowAddDialog(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-md">
            <Plus className="w-4 h-4" /> {isRTL ? 'إضافة موظف جديد' : 'Add New Staff'}
          </Button>
        </div>

        <Card className="border-0 shadow-md overflow-hidden rounded-2xl">
          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-20 text-slate-400"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
            ) : staffList.length === 0 ? (
              <div className="text-center py-20">
                <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-500">{isRTL ? 'لا يوجد موظفين مضافين حالياً' : 'No staff members found'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>{isRTL ? 'الموظف' : 'Staff Member'}</TableHead>
                      <TableHead>{isRTL ? 'الدور' : 'Role'}</TableHead>
                      <TableHead>{isRTL ? 'اسم المستخدم' : 'Username'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'صلاحية الدخول' : 'Login Permission'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffList.map((staff) => (
                      <TableRow key={staff.id} className="hover:bg-slate-50/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-bold">
                              {staff.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{staff.name}</div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3" /> {staff.phone || '---'}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getRoleBadge(staff.role)}</TableCell>
                        <TableCell className="font-mono text-xs text-slate-600">{staff.loginUsername}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Switch
                              checked={staff.canLogin}
                              onCheckedChange={() => handleToggleLogin(staff)}
                              className="data-[state=checked]:bg-green-500"
                            />
                            <span className={`text-[10px] font-bold ${staff.canLogin ? 'text-green-600' : 'text-red-600'}`}>
                              {staff.canLogin ? (isRTL ? 'مسموح' : 'Allowed') : (isRTL ? 'محظور' : 'Blocked')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button size="icon" variant="ghost" onClick={() => { setSelectedStaff(staff); setShowDeleteDialog(true); }} className="text-red-600 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
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

      {/* Add Staff Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className={isRTL ? 'rtl' : 'ltr'} dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5 text-blue-600" /> {isRTL ? 'إضافة موظف جديد' : 'Add New Staff'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>{isRTL ? 'الاسم الكامل' : 'Full Name'}</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="John Doe" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isRTL ? 'الدور الوظيفي' : 'Role'}</Label>
                <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="waiter">{isRTL ? 'نادل' : 'Waiter'}</option>
                  <option value="chef">{isRTL ? 'شيف' : 'Chef'}</option>
                  <option value="manager">{isRTL ? 'مدير' : 'Manager'}</option>
                </select>
              </div>
              <div className="space-y-2"><Label>{isRTL ? 'رقم الهاتف' : 'Phone'}</Label><Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="0123456789" /></div>
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'البريد الإلكتروني (اسم المستخدم)' : 'Email (Login Username)'}</Label>
              <Input
                type="email"
                value={formData.loginUsername}
                onChange={e => setFormData({...formData, loginUsername: e.target.value})}
                placeholder="staff@example.com"
              />
              <p className="text-[10px] text-slate-400">{isRTL ? 'يجب أن يكون بريداً إلكترونياً صحيحاً لتسجيل الدخول' : 'Must be a valid email address for login'}</p>
            </div>
            <div className="space-y-2"><Label>{isRTL ? 'كلمة المرور' : 'Password'}</Label><Input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} /></div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 flex gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <p className="text-[10px] text-blue-700">{isRTL ? 'سيتم إنشاء حساب تسجيل دخول كامل لهذا الموظف تلقائياً.' : 'A full login account will be created automatically for this staff member.'}</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddDialog(false)} className="flex-1">{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleAddStaff} disabled={submitting} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">{submitting ? '...' : (isRTL ? 'إضافة' : 'Add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Staff Alert */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className={isRTL ? 'rtl' : 'ltr'} dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRTL ? 'هل أنت متأكد؟' : 'Are you sure?'}</AlertDialogTitle>
            <AlertDialogDescription>{isRTL ? 'سيتم حذف الموظف نهائياً وإلغاء صلاحية دخوله للنظام.' : 'This will permanently delete the staff member and revoke their login access.'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="flex-1">{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStaff} className="flex-1 bg-red-600 hover:bg-red-700 text-white">{isRTL ? 'حذف' : 'Delete'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
