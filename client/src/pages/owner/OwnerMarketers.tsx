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
import { AddMarketerDialog } from '@/components/AddMarketerDialog';
import {
  Users, LayoutDashboard, Store, Wallet, BarChart3, Settings,
  Plus, Edit, Trash2, Mail, Phone, RefreshCw, ArrowLeft, Home, AlertCircle, Globe, Coins, Languages, Search
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

interface Marketer {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  referenceCode?: string;
  country?: string;
  currency?: string;
  status?: 'active' | 'frozen';
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

export default function OwnerMarketers() {
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const { language } = useTranslation();
  const [, setLocation] = useLocation();
  const isRTL = language === 'ar';

  const [marketers, setMarketers] = useState<Marketer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedMarketer, setSelectedMarketer] = useState<Marketer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const freezeMutation = trpc.marketers.freezeMarketer.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? 'تم تجميد المسوق بنجاح' : 'Marketer frozen successfully');
      fetchMarketers();
    },
    onError: (err) => {
      toast.error(err.message);
    }
  });

  const unfreezeMutation = trpc.marketers.unfreezeMarketer.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? 'تم إلغاء تجميد المسوق بنجاح' : 'Marketer unfrozen successfully');
      fetchMarketers();
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

  const fetchMarketers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('marketers')
        .select('*')
        .order('createdAt', { ascending: false });

      if (error) throw error;
      setMarketers(data || []);
    } catch (err: any) {
      console.error('Error fetching marketers:', err);
      toast.error(isRTL ? 'خطأ في تحميل المسوقين' : 'Error loading marketers');
    } finally {
      setLoading(false);
    }
  }, [isRTL]);

  useEffect(() => {
    if (!authLoading) {
      fetchMarketers();
    }
  }, [authLoading, fetchMarketers]);

  const filteredCountries = countries.filter(c => 
    (isRTL ? c.arName : c.name).toLowerCase().includes(countrySearch.toLowerCase())
  );

  const isSystemOwner = user?.email === 'owner@cafeteria.com' || user?.role === 'owner';

  return (
    <div className={`min-h-screen bg-slate-50 pb-20 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <DashboardHeader 
        title={isRTL ? 'إدارة المسوقين' : 'Marketers Management'} 
        onMenuClick={() => setMenuOpen(true)} 
        showBackButton={true}
        showHomeButton={true}
      />
      <DashboardNavigation isOpen={menuOpen} onClose={() => setMenuOpen(false)} items={navigationItems} />

      <AddMarketerDialog 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog} 
        isOwner={isSystemOwner}
        onSuccess={fetchMarketers}
      />

      <main className="p-4 max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800">{isRTL ? 'المسوقين' : 'Marketers'}</h2>
          <Button onClick={() => setShowAddDialog(true)} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="w-4 h-4 mr-2" />
            {isRTL ? 'إضافة مسوق' : 'Add Marketer'}
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                {isRTL ? 'قائمة المسوقين' : 'Marketers List'}
              </CardTitle>
              <div className="relative w-full md:w-72">
                <Input
                  placeholder={isRTL ? 'بحث عن مسوق...' : 'Search marketers...'}
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
                    <TableHead>{isRTL ? 'البريد الإلكتروني' : 'Email'}</TableHead>
                    <TableHead>{isRTL ? 'البلد/العملة' : 'Country/Currency'}</TableHead>
                    <TableHead className="text-right">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-10"><RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-600" /></TableCell></TableRow>
                  ) : marketers.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-10 text-slate-500">{isRTL ? 'لا يوجد مسوقين' : 'No marketers found'}</TableCell></TableRow>
                  ) : (
                    marketers.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase())).map((marketer) => (
                      <TableRow key={marketer.id}>
                        <TableCell className="font-mono font-bold text-purple-600">{marketer.referenceCode || '---'}</TableCell>
                        <TableCell className="font-bold">{marketer.name}</TableCell>
                        <TableCell>{marketer.email}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{marketer.country}</Badge>
                            <span className="text-xs text-slate-500">{marketer.currency}</span>
                            {marketer.status === 'frozen' && (
                              <Badge variant="destructive" className="bg-red-100 text-red-600 border-red-200">
                                {isRTL ? 'مجمد' : 'Frozen'}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {marketer.status === 'frozen' ? (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-green-600 border-green-200 hover:bg-green-50"
                                onClick={() => unfreezeMutation.mutate({ marketerId: marketer.id })}
                                disabled={unfreezeMutation.isPending}
                              >
                                {isRTL ? 'إلغاء التجميد' : 'Unfreeze'}
                              </Button>
                            ) : (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-amber-600 border-amber-200 hover:bg-amber-50"
                                onClick={() => freezeMutation.mutate({ marketerId: marketer.id })}
                                disabled={freezeMutation.isPending}
                              >
                                {isRTL ? 'تجميد' : 'Freeze'}
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => { setSelectedMarketer(marketer); setShowEditDialog(true); }}><Edit className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-red-600" onClick={() => { setSelectedMarketer(marketer); setShowDeleteDialog(true); }}><Trash2 className="w-4 h-4" /></Button>
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
    </div>
  );
}
