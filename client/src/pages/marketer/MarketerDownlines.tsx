import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTranslation } from '@/locales/useTranslation';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DashboardNavigation } from '@/components/DashboardNavigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Users, LayoutDashboard, Wallet, BarChart3, Plus, Store, Hash, Globe, Mail, Phone, ShieldCheck, UserPlus, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
// Inlined from server/utils/referenceCodeGenerator.ts (pure function — no server deps)
const OWNER_REFERENCE_CODE = "10";
function getMarketerDepth(code: string): number {
  if (code === OWNER_REFERENCE_CODE) return 0;
  const extra = code.length - OWNER_REFERENCE_CODE.length;
  return extra / 2;
}

interface SubMarketer {
  id: string;
  name: string;
  email: string;
  referenceCode: string;
  country: string;
  currency: string;
  createdAt: string;
}

interface SubCafeteria {
  id: string;
  name: string;
  referenceCode: string;
  country: string;
  currency: string;
  subscriptionStatus: string;
  createdAt: string;
}

export default function MarketerDownlines() {
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const { language } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [subMarketers, setSubMarketers] = useState<SubMarketer[]>([]);
  const [subCafeterias, setSubCafeterias] = useState<SubCafeteria[]>([]);
  
  const [showMarketerDialog, setShowMarketerDialog] = useState(false);
  const [showCafeteriaDialog, setShowCafeteriaDialog] = useState(false);

  const [marketerForm, setMarketerForm] = useState({ name: '', email: '', password: '' });
  const [cafeteriaForm, setCafeteriaForm] = useState({ name: '', email: '', password: '' });

  const isRTL = language === 'ar';

  const navigationItems = [
    { label: isRTL ? 'لوحة التحكم' : 'Dashboard', path: '/dashboard/marketer', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: isRTL ? 'أبنائي' : 'My Downlines', path: '/dashboard/marketer/downlines', icon: <Users className="w-5 h-5" /> },
    { label: isRTL ? 'عمولاتي' : 'My Commissions', path: '/dashboard/marketer/commissions', icon: <Wallet className="w-5 h-5" /> },
    { label: isRTL ? 'التقارير' : 'Reports', path: '/dashboard/marketer/reports', icon: <BarChart3 className="w-5 h-5" /> },
  ];

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Fetch Sub-Marketers from 'marketers' table
      const { data: mData, error: mError } = await supabase
        .from('marketers')
        .select('*')
        .eq('parentId', user.id);
      
      if (mError) throw mError;
      setSubMarketers((mData || []).map(m => ({
        id: m.id,
        name: m.name,
        email: m.email,
        referenceCode: m.referenceCode,
        country: m.country,
        currency: m.currency,
        createdAt: m.createdAt
      })));

      // Fetch Sub-Cafeterias
      const { data: cData, error: cError } = await supabase
        .from('cafeterias')
        .select('*')
        .eq('marketerId', user.id);
      
      if (cError) throw cError;
      setSubCafeterias((cData || []).map(c => ({
        id: c.id,
        name: c.name,
        referenceCode: c.referenceCode,
        country: c.country,
        currency: c.currency,
        subscriptionStatus: c.subscriptionStatus,
        createdAt: c.createdAt
      })));

    } catch (err: any) {
      console.error('Fetch error:', err);
      toast.error(isRTL ? 'خطأ في تحميل البيانات' : 'Error loading data');
    } finally {
      setLoading(false);
    }
  }, [user?.id, isRTL]);

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [authLoading, fetchData]);

  const handleAddMarketer = async () => {
    if (!marketerForm.name || !marketerForm.email || !marketerForm.password) {
      toast.error(isRTL ? 'يرجى ملء جميع الحقول' : 'Please fill all fields');
      return;
    }

    // Enforce Level 3 limit: Level 3 marketers cannot create other marketers
    const currentDepth = getMarketerDepth(user?.referenceCode || '');
    if (currentDepth >= 3) {
      toast.error(isRTL ? 'المسوقين من المستوى الثالث يمكنهم إضافة كافيتريات فقط' : 'Level 3 marketers can only add cafeterias');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Get Parent Data (Inheritance)
      const { data: parent } = await supabase
        .from('marketers')
        .select('id, referenceCode, country, currency, language')
        .eq('id', user?.id)
        .single();
      
      if (!parent) throw new Error("Parent marketer not found");

      // 2. Generate Reference Code (ParentCode + 2 digits)
      const { data: existing } = await supabase
        .from('marketers')
        .select('referenceCode')
        .like('referenceCode', `${parent.referenceCode}%`)
        .not('referenceCode', 'eq', parent.referenceCode)
        .order('referenceCode', { ascending: false })
        .limit(1);
      
      let nextNum = 1;
      if (existing && existing.length > 0 && existing[0].referenceCode) {
        const lastCode = existing[0].referenceCode;
        const lastTwo = lastCode.slice(-2);
        if (!isNaN(parseInt(lastTwo))) nextNum = parseInt(lastTwo) + 1;
      }
      const newRefCode = `${parent.referenceCode}${String(nextNum).padStart(2, '0')}`;

      const insertData = {
        name: marketerForm.name,
        email: marketerForm.email.trim().toLowerCase(),
        loginUsername: marketerForm.email.trim().toLowerCase(),
        passwordHash: marketerForm.password,
        parentId: parent.id,
        country: parent.country,
        currency: parent.currency,
        language: parent.language,
        referenceCode: newRefCode,
        createdAt: new Date().toISOString()
      };

      const { error } = await supabase.from('marketers').insert([insertData]);
      if (error) throw error;

      toast.success(isRTL ? 'تم إضافة المسوق بنجاح' : 'Marketer added successfully');
      setShowMarketerDialog(false);
      setMarketerForm({ name: '', email: '', password: '' });
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCafeteria = async () => {
    if (!cafeteriaForm.name || !cafeteriaForm.email || !cafeteriaForm.password) {
      toast.error(isRTL ? 'يرجى ملء جميع الحقول' : 'Please fill all fields');
      return;
    }
    setSubmitting(true);
    try {
      // 1. Get Parent Data (Inheritance)
      const { data: parent } = await supabase
        .from('marketers')
        .select('id, referenceCode, country, currency, language')
        .eq('id', user?.id)
        .single();
      
      if (!parent) throw new Error("Parent marketer not found");

      // 2. Generate Reference Code (ParentCode + P + 2 digits)
      const { data: existing } = await supabase
        .from('cafeterias')
        .select('referenceCode')
        .like('referenceCode', `${parent.referenceCode}P%`)
        .order('referenceCode', { ascending: false })
        .limit(1);
      
      let nextNum = 1;
      if (existing && existing.length > 0 && existing[0].referenceCode) {
        const lastCode = existing[0].referenceCode;
        const match = lastCode.match(/P(\d+)$/);
        if (match) nextNum = parseInt(match[1]) + 1;
      }
      const newRefCode = `${parent.referenceCode}P${String(nextNum).padStart(2, '0')}`;

      const insertData: any = {
        name: cafeteriaForm.name,
        loginUsername: cafeteriaForm.email.trim().toLowerCase(),
        passwordHash: cafeteriaForm.password,
        marketerId: parent.id,
        country: parent.country,
        currency: parent.currency,
        language: parent.language,
        referenceCode: newRefCode,
        pointsBalance: 0,
        subscriptionStatus: 'active',
        createdAt: new Date().toISOString()
      };

      const { error } = await supabase.from('cafeterias').insert([insertData]);
      
      if (error && error.message.includes('subscriptionPlan')) {
        delete insertData.subscriptionPlan;
        const { error: retryError } = await supabase.from('cafeterias').insert([insertData]);
        if (retryError) throw retryError;
      } else if (error) {
        throw error;
      }

      toast.success(isRTL ? 'تم إضافة الكافيتريا بنجاح' : 'Cafeteria added successfully');
      setShowCafeteriaDialog(false);
      setCafeteriaForm({ name: '', email: '', password: '' });
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  return (
    <div className={`min-h-screen bg-gray-50 pb-20 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <DashboardHeader showBackButton={true} showHomeButton={true} title={isRTL ? 'أبنائي' : 'My Downlines'} onMenuClick={() => setMenuOpen(true)} />
      <DashboardNavigation isOpen={menuOpen} onClose={() => setMenuOpen(false)} items={navigationItems} />

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="bg-white p-4 rounded-xl shadow-sm border mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{isRTL ? 'إدارة الشبكة' : 'Network Management'}</h2>
            <p className="text-sm text-slate-500">{isRTL ? 'إضافة مسوقين أو كافيتريات تابعة لك' : 'Add sub-marketers or cafeterias under you'}</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            {getMarketerDepth(user?.referenceCode || '') < 3 && (
              <Button onClick={() => setShowMarketerDialog(true)} className="flex-1 md:flex-none bg-purple-600 hover:bg-purple-700 text-white gap-2">
                <UserPlus className="w-4 h-4" /> {isRTL ? 'إضافة مسوق' : 'Add Marketer'}
              </Button>
            )}
            <Button onClick={() => setShowCafeteriaDialog(true)} className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white gap-2">
              <Plus className="w-4 h-4" /> {isRTL ? 'إضافة كافيتريا' : 'Add Cafeteria'}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="marketers" className="space-y-6">
          <TabsList className="bg-white shadow-sm border">
            <TabsTrigger value="marketers" className="gap-2"><Users className="w-4 h-4" /> {isRTL ? 'المسوقين' : 'Marketers'}</TabsTrigger>
            <TabsTrigger value="cafeterias" className="gap-2"><Store className="w-4 h-4" /> {isRTL ? 'الكافيتريات' : 'Cafeterias'}</TabsTrigger>
          </TabsList>

          <TabsContent value="marketers">
            <Card className="border-0 shadow-md overflow-hidden">
              <CardContent className="p-0">
                {loading ? (
                  <div className="text-center py-20"><RefreshCw className="w-8 h-8 animate-spin mx-auto text-purple-600" /></div>
                ) : subMarketers.length === 0 ? (
                  <div className="text-center py-20 text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    {isRTL ? 'لا يوجد مسوقين تابعين' : 'No sub-marketers found'}
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>{isRTL ? 'الرقم المرجعي' : 'Ref Code'}</TableHead>
                        <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                        <TableHead>{isRTL ? 'البلد' : 'Country'}</TableHead>
                        <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subMarketers.map(m => (
                        <TableRow key={m.id}>
                          <TableCell className="font-mono font-bold text-purple-600">{m.referenceCode}</TableCell>
                          <TableCell className="font-bold">{m.name}<div className="text-xs text-slate-400 font-normal">{m.email}</div></TableCell>
                          <TableCell><Badge variant="outline">{m.country}</Badge></TableCell>
                          <TableCell className="text-xs text-slate-500">{new Date(m.createdAt).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cafeterias">
            <Card className="border-0 shadow-md overflow-hidden">
              <CardContent className="p-0">
                {loading ? (
                  <div className="text-center py-20"><RefreshCw className="w-8 h-8 animate-spin mx-auto text-green-600" /></div>
                ) : subCafeterias.length === 0 ? (
                  <div className="text-center py-20 text-slate-400">
                    <Store className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    {isRTL ? 'لا يوجد كافيتريات تابعة' : 'No sub-cafeterias found'}
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>{isRTL ? 'الرقم المرجعي' : 'Ref Code'}</TableHead>
                        <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                        <TableHead>{isRTL ? 'البلد' : 'Country'}</TableHead>
                        <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subCafeterias.map(c => (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono font-bold text-green-600">{c.referenceCode}</TableCell>
                          <TableCell className="font-bold">{c.name}</TableCell>
                          <TableCell><Badge variant="outline">{c.country}</Badge></TableCell>
                          <TableCell><Badge className="bg-green-100 text-green-700">{c.subscriptionStatus}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Add Marketer Dialog */}
      <Dialog open={showMarketerDialog} onOpenChange={setShowMarketerDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{isRTL ? 'إضافة مسوق تابع' : 'Add Sub-Marketer'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{isRTL ? 'الاسم' : 'Name'}</Label>
              <Input value={marketerForm.name} onChange={e => setMarketerForm({...marketerForm, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'البريد الإلكتروني' : 'Email'}</Label>
              <Input type="email" value={marketerForm.email} onChange={e => setMarketerForm({...marketerForm, email: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'كلمة المرور' : 'Password'}</Label>
              <Input type="password" value={marketerForm.password} onChange={e => setMarketerForm({...marketerForm, password: e.target.value})} />
            </div>
            <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              {isRTL ? `سيرث المسوق البلد (${user?.country}) والعملة (${user?.currency}) تلقائياً` : `Will inherit Country (${user?.country}) and Currency (${user?.currency})`}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMarketerDialog(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleAddMarketer} disabled={submitting} className="bg-purple-600">{submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : (isRTL ? 'إضافة' : 'Add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Cafeteria Dialog */}
      <Dialog open={showCafeteriaDialog} onOpenChange={setShowCafeteriaDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{isRTL ? 'إضافة كافيتريا تابعة' : 'Add Sub-Cafeteria'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{isRTL ? 'اسم الكافيتريا' : 'Cafeteria Name'}</Label>
              <Input value={cafeteriaForm.name} onChange={e => setCafeteriaForm({...cafeteriaForm, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'البريد الإلكتروني للدخول' : 'Login Email'}</Label>
              <Input type="email" value={cafeteriaForm.email} onChange={e => setCafeteriaForm({...cafeteriaForm, email: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'كلمة المرور' : 'Password'}</Label>
              <Input type="password" value={cafeteriaForm.password} onChange={e => setCafeteriaForm({...cafeteriaForm, password: e.target.value})} />
            </div>
            <div className="p-3 bg-green-50 rounded-lg text-xs text-green-700 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              {isRTL ? `ستورث الكافيتريا البلد (${user?.country}) والعملة (${user?.currency}) تلقائياً` : `Will inherit Country (${user?.country}) and Currency (${user?.currency})`}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCafeteriaDialog(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleAddCafeteria} disabled={submitting} className="bg-green-600">{submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : (isRTL ? 'إضافة' : 'Add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
