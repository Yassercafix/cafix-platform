import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTranslation } from '@/locales/useTranslation';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DashboardNavigation } from '@/components/DashboardNavigation';
import {
  Store, LayoutDashboard, Users, Wallet, BarChart3, Settings,
  Plus, Edit, Trash2, Eye, RefreshCw, ArrowLeft, Home, AlertCircle, Globe, Coins, Languages, MapPin, Search
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import bcryptjs from 'bcryptjs';
import { trpc } from '@/lib/trpc';

interface Cafeteria {
  id: string;
  name: string;
  location?: string;
  loginUsername?: string;
  subscriptionStatus: string;
  status?: 'active' | 'frozen';
  createdAt: string;
  pointsBalance?: number;
  freeOperationEndDate?: string;
  referenceCode?: string;
  country?: string;
  currency?: string;
  language?: string;
}

const countries = [
  { code: 'EG', name: 'Egypt', arName: 'مصر', currency: 'EGP', language: 'ar' },
  { code: 'SA', name: 'Saudi Arabia', arName: 'السعودية', currency: 'SAR', language: 'ar' },
  { code: 'AE', name: 'UAE', arName: 'الإمارات', currency: 'AED', language: 'ar' },
  { code: 'KW', name: 'Kuwait', arName: 'الكويت', currency: 'KWD', language: 'ar' },
  { code: 'JO', name: 'Jordan', arName: 'الأردن', currency: 'JOD', language: 'ar' },
  { code: 'US', name: 'USA', arName: 'الولايات المتحدة', currency: 'USD', language: 'en' },
  { code: 'GB', name: 'UK', arName: 'المملكة المتحدة', currency: 'GBP', language: 'en' },
].sort((a, b) => a.arName.localeCompare(b.arName));

export default function OwnerCafeterias() {
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const { language } = useTranslation();
  const [, setLocation] = useLocation();
  const isRTL = language === 'ar';

  const [cafeterias, setCafeterias] = useState<Cafeteria[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedCafeteria, setSelectedCafeteria] = useState<Cafeteria | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    location: '',
    loginUsername: '',
    password: '',
    country: 'SA',
    currency: 'SAR',
    language: 'ar',
  });

  const freezeMutation = trpc.cafeterias.freezeCafeteria.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? 'تم تجميد الكافيتريا بنجاح' : 'Cafeteria frozen successfully');
      fetchCafeterias();
    },
    onError: (err) => {
      toast.error(err.message);
    }
  });

  const unfreezeMutation = trpc.cafeterias.unfreezeCafeteria.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? 'تم إلغاء تجميد الكافيتريا بنجاح' : 'Cafeteria unfrozen successfully');
      fetchCafeterias();
    },
    onError: (err) => {
      toast.error(err.message);
    }
  });

  const navigationItems = [
    { label: isRTL ? 'لوحة التحكم' : 'Dashboard', path: '/dashboard/owner', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: isRTL ? 'المسوقين' : 'Marketers', path: '/dashboard/owner/marketers', icon: <Users className="w-5 h-5" /> },
    { label: isRTL ? 'الكافيتريات' : 'Cafeterias', path: '/dashboard/owner/cafeterias', icon: <Store className="w-5 h-5" /> },
    { label: isRTL ? 'حاسبة النقاط' : 'Calculator', path: '/dashboard/owner/calculator', icon: <Coins className="w-5 h-5" /> },
    { label: isRTL ? 'التقارير' : 'Reports', path: '/dashboard/owner/reports', icon: <BarChart3 className="w-5 h-5" /> },
    { label: isRTL ? 'الإعدادات' : 'Settings', path: '/dashboard/owner/settings', icon: <Settings className="w-5 h-5" /> },
  ];

  const listCafeteriasQuery = trpc.marketers.listCafeterias.useQuery(undefined, {
    enabled: !authLoading,
  });

  const fetchCafeterias = useCallback(async () => {
    listCafeteriasQuery.refetch();
  }, [listCafeteriasQuery]);

  useEffect(() => {
    if (listCafeteriasQuery.data) {
      setCafeterias(listCafeteriasQuery.data as any);
    }
  }, [listCafeteriasQuery.data]);

  useEffect(() => {
    setLoading(listCafeteriasQuery.isLoading);
  }, [listCafeteriasQuery.isLoading]);

  useEffect(() => {
    if (listCafeteriasQuery.error) {
      console.error('Error fetching cafeterias:', listCafeteriasQuery.error);
      toast.error(isRTL ? 'خطأ في تحميل الكافيتريات' : 'Error loading cafeterias');
    }
  }, [listCafeteriasQuery.error, isRTL]);

  useEffect(() => {
    if (!authLoading) {
      fetchCafeterias();
    }
  }, [authLoading, fetchCafeterias]);

  const handleCountryChange = (code: string) => {
    const selected = countries.find(c => c.code === code);
    if (selected) {
      setFormData(prev => ({
        ...prev,
        country: selected.code,
        currency: selected.currency,
        language: selected.language
      }));
    }
  };

  const handleAddCafeteria = async () => {
    if (!formData.name.trim()) {
      toast.error(isRTL ? 'اسم الكافيتريا مطلوب' : 'Cafeteria name is required');
      return;
    }

    if (!formData.loginUsername.trim()) {
      toast.error(isRTL ? 'بريد إلكتروني مطلوب' : 'Email is required');
      return;
    }

    if (formData.password.length < 6) {
      toast.error(isRTL ? 'كلمة المرور قصيرة جداً' : 'Password too short');
      return;
    }

    setSubmitting(true);
    try {
      let parentRefCode = '10';
      let marketerId = 'owner';
      
      const isSystemOwner = user?.email === 'owner@cafeteria.com' || user?.role === 'owner';
      
      if (!isSystemOwner) {
        const { data: marketer } = await supabase
          .from('marketers')
          .select('id, referenceCode, country, currency, language')
          .eq('email', user?.email)
          .single();
        
        if (marketer) {
          parentRefCode = marketer.referenceCode;
          marketerId = marketer.id;
          formData.country = marketer.country;
          formData.currency = marketer.currency;
          formData.language = marketer.language;
        }
      }

      const { data: existing } = await supabase
        .from('cafeterias')
        .select('referenceCode')
        .like('referenceCode', `${parentRefCode}P%`)
        .order('referenceCode', { ascending: false })
        .limit(1);
      
      let nextNum = 1;
      if (existing && existing.length > 0 && existing[0].referenceCode) {
        const lastCode = existing[0].referenceCode;
        const match = lastCode.match(/P(\d+)$/);
        if (match) nextNum = parseInt(match[1]) + 1;
      }
      const newRefCode = `${parentRefCode}P${String(nextNum).padStart(2, '0')}`;

      const salt = await bcryptjs.genSalt(10);
      const hashedPassword = await bcryptjs.hash(formData.password, salt);

      const insertData: any = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
        name: formData.name.trim(),
        location: formData.location.trim() || null,
        loginUsername: formData.loginUsername.trim().toLowerCase(),
        passwordHash: hashedPassword,
        marketerId,
        referenceCode: newRefCode,
        country: formData.country,
        currency: formData.currency,
        language: formData.language,
        pointsBalance: 0,
        subscriptionStatus: 'active',
        status: 'active',
        createdAt: new Date().toISOString(),
      };

      const { error } = await supabase.from('cafeterias').insert([insertData]);
      if (error) throw error;
      
      toast.success(isRTL ? 'تم إضافة الكافيتريا بنجاح' : 'Cafeteria added successfully');
      setShowAddDialog(false);
      setFormData({ name: '', location: '', loginUsername: '', password: '', country: 'SA', currency: 'SAR', language: 'ar' });
      fetchCafeterias();
    } catch (err: any) {
      console.error('Add cafeteria error:', err);
      toast.error(err.message || (isRTL ? 'خطأ في إضافة الكافيتريا' : 'Error adding cafeteria'));
    } finally {
      setSubmitting(false);
    }
  };

  const isSystemOwner = user?.email === 'owner@cafeteria.com' || user?.role === 'owner';

  return (
    <div className={`min-h-screen bg-slate-50 pb-20 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <DashboardHeader 
        title={isRTL ? 'إدارة الكافيتريات' : 'Cafeterias Management'} 
        onMenuClick={() => setMenuOpen(true)} 
        showBackButton={true}
        showHomeButton={true}
      />
      <DashboardNavigation isOpen={menuOpen} onClose={() => setMenuOpen(false)} items={navigationItems} />

      <main className="p-4 max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800">{isRTL ? 'الكافيتريات' : 'Cafeterias'}</h2>
          <Button onClick={() => setShowAddDialog(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            {isRTL ? 'إضافة كافيتريا' : 'Add Cafeteria'}
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Store className="w-5 h-5 text-blue-600" />
                {isRTL ? 'قائمة الكافيتريات' : 'Cafeterias List'}
              </CardTitle>
              <div className="relative w-full md:w-72">
                <Input
                  placeholder={isRTL ? 'بحث عن كافيتريا...' : 'Search cafeterias...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? 'الرقم المرجعي' : 'Ref Code'}</TableHead>
                    <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                    <TableHead>{isRTL ? 'البلد/العملة' : 'Country/Currency'}</TableHead>
                    <TableHead>{isRTL ? 'الرصيد' : 'Balance'}</TableHead>
                    <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead className="text-right">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-10"><RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600" /></TableCell></TableRow>
                  ) : cafeterias.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-slate-500">{isRTL ? 'لا يوجد كافيتريات' : 'No cafeterias found'}</TableCell></TableRow>
                  ) : (
                    cafeterias.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())).map((cafeteria) => (
                      <TableRow key={cafeteria.id}>
                        <TableCell className="font-mono font-bold text-blue-600">{cafeteria.referenceCode || '---'}</TableCell>
                        <TableCell className="font-bold">{cafeteria.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{cafeteria.country}</Badge>
                            <span className="text-xs text-slate-500">{cafeteria.currency}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-green-600">{cafeteria.pointsBalance || 0}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={cafeteria.subscriptionStatus === 'active' ? 'default' : 'secondary'} className={cafeteria.subscriptionStatus === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}>
                              {cafeteria.subscriptionStatus}
                            </Badge>
                            {cafeteria.status === 'frozen' && (
                              <Badge variant="destructive" className="bg-red-100 text-red-600 border-red-200">
                                {isRTL ? 'مجمد' : 'Frozen'}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {cafeteria.status === 'frozen' ? (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-green-600 border-green-200 hover:bg-green-50"
                                onClick={() => unfreezeMutation.mutate({ cafeteriaId: cafeteria.id })}
                                disabled={unfreezeMutation.isPending}
                              >
                                {isRTL ? 'إلغاء التجميد' : 'Unfreeze'}
                              </Button>
                            ) : (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-amber-600 border-amber-200 hover:bg-amber-50"
                                onClick={() => freezeMutation.mutate({ cafeteriaId: cafeteria.id })}
                                disabled={freezeMutation.isPending}
                              >
                                {isRTL ? 'تجميد' : 'Freeze'}
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => { setSelectedCafeteria(cafeteria); setShowEditDialog(true); }}><Edit className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-red-600" onClick={() => { setSelectedCafeteria(cafeteria); setShowDeleteDialog(true); }}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Add Dialog Simplified */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{isRTL ? 'إضافة كافيتريا جديدة' : 'Add New Cafeteria'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{isRTL ? 'اسم الكافيتريا' : 'Cafeteria Name'}</Label>
              <Input value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'البريد الإلكتروني' : 'Email Address'}</Label>
              <Input type="email" value={formData.loginUsername} onChange={(e) => setFormData(prev => ({ ...prev, loginUsername: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'كلمة المرور' : 'Password'}</Label>
              <Input type="password" value={formData.password} onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isRTL ? 'البلد' : 'Country'}</Label>
                <select 
                  className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm"
                  value={formData.country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                >
                  {countries.map(c => <option key={c.code} value={c.code}>{isRTL ? c.arName : c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? 'العملة' : 'Currency'}</Label>
                <Input value={formData.currency} disabled />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleAddCafeteria} disabled={submitting}>{isRTL ? 'حفظ' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
