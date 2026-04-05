import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTranslation } from '@/locales/useTranslation';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Wallet, LayoutDashboard, Store, Users, BarChart3, Settings,
  Plus, Minus, RefreshCw, TrendingUp, TrendingDown, ArrowLeft, Home,
  CheckCircle2, XCircle, Clock, Image as ImageIcon, Hash, Globe, ExternalLink
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

interface PointsTransaction {
  id: string;
  cafeteria_id: string;
  cafeteria_name?: string;
  amount: number;
  type: 'add' | 'deduct';
  reason: string;
  created_at: string;
}

interface RechargeRequest {
  id: string;
  cafeteria_id: string;
  cafeteria_name?: string;
  amount: number;
  points: number;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  notes?: string;
  receipt_url?: string;
  country?: string;
  currency?: string;
  reference_code?: string;
}

export default function OwnerPoints() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const { language } = useTranslation();
  const [, setLocation] = useLocation();
  const isRTL = language === 'ar';

  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [rechargeRequests, setRechargeRequests] = useState<RechargeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'add' | 'deduct'>('all');

  const [formData, setFormData] = useState({
    cafeteria_id: '',
    amount: '',
    type: 'add' as 'add' | 'deduct',
    reason: '',
  });

  const [cafeterias, setCafeterias] = useState<any[]>([]);

  const fetchTransactions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('points_transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
    }
  }, []);

  const fetchRechargeRequests = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('recharge_requests')
        .select('*, cafeterias(name)')
        .order('requested_at', { ascending: false });

      if (error) throw error;
      
      const mapped = (data || []).map((r: any) => ({
        ...r,
        cafeteria_name: r.cafeterias?.name
      }));
      
      setRechargeRequests(mapped);
    } catch (err: any) {
      console.error('Error fetching recharge requests:', err);
    }
  }, []);

  const fetchCafeterias = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('cafeterias')
        .select('id, name')
        .eq('subscriptionStatus', 'active');

      if (error) throw error;
      setCafeterias(data || []);
    } catch (err: any) {
      console.error('Error fetching cafeterias:', err);
    }
  }, []);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchTransactions(), fetchRechargeRequests(), fetchCafeterias()]);
    setLoading(false);
  }, [fetchTransactions, fetchRechargeRequests, fetchCafeterias]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleAddTransaction = async () => {
    if (!formData.cafeteria_id || !formData.amount || !formData.reason.trim()) {
      toast.error(isRTL ? 'جميع الحقول مطلوبة' : 'All fields are required');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('points_transactions').insert([
        {
          cafeteria_id: formData.cafeteria_id,
          amount: parseInt(formData.amount),
          type: formData.type,
          reason: formData.reason,
        },
      ]);

      if (error) throw error;
      toast.success(isRTL ? 'تم تسجيل المعاملة بنجاح' : 'Transaction recorded successfully');
      setShowAddDialog(false);
      setFormData({ cafeteria_id: '', amount: '', type: 'add', reason: '' });
      fetchTransactions();
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'خطأ في تسجيل المعاملة' : 'Error recording transaction'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveRequest = async (request: RechargeRequest) => {
    setSubmitting(true);
    try {
      // 1. Update request status
      const { error: updateError } = await supabase
        .from('recharge_requests')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', request.id);

      if (updateError) throw updateError;

      // 2. Add points transaction
      const { error: transError } = await supabase.from('points_transactions').insert([
        {
          cafeteria_id: request.cafeteria_id,
          amount: request.points,
          type: 'add',
          reason: `Approved Recharge Request #${request.id.slice(0, 8)}`,
        },
      ]);

      if (transError) throw transError;

      toast.success(isRTL ? 'تمت الموافقة وشحن النقاط' : 'Approved and points recharged');
      loadAllData();
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'خطأ في المعالجة' : 'Error processing'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectRequest = async (id: string) => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('recharge_requests')
        .update({ status: 'rejected' })
        .eq('id', id);

      if (error) throw error;
      toast.success(isRTL ? 'تم رفض الطلب' : 'Request rejected');
      fetchRechargeRequests();
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'خطأ في المعالجة' : 'Error processing'));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch = t.reason.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || t.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className={`min-h-screen bg-slate-50 pb-20 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <header className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="px-4 py-4 flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg shadow-md"><Wallet className="w-6 h-6 text-white" /></div>
            <h1 className="text-xl font-bold text-slate-900">{isRTL ? 'إدارة النقاط والشحن' : 'Points & Recharge Management'}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={loadAllData} className="text-slate-600 hover:text-blue-600"><RefreshCw className="w-5 h-5" /></Button>
            <Button variant="ghost" size="icon" onClick={() => setLocation('/dashboard/owner')} className="text-slate-600 hover:text-blue-600"><Home className="w-5 h-5" /></Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 max-w-7xl mx-auto">
        <Tabs defaultValue="requests" className="space-y-6">
          <TabsList className="grid grid-cols-2 w-full max-w-md mx-auto bg-white shadow-sm border">
            <TabsTrigger value="requests" className="gap-2"><Clock className="w-4 h-4" /> {isRTL ? 'طلبات الشحن' : 'Recharge Requests'}</TabsTrigger>
            <TabsTrigger value="history" className="gap-2"><TrendingUp className="w-4 h-4" /> {isRTL ? 'سجل المعاملات' : 'Transaction History'}</TabsTrigger>
          </TabsList>

          {/* Recharge Requests Tab */}
          <TabsContent value="requests">
            <Card className="border-0 shadow-md overflow-hidden">
              <CardContent className="p-0">
                {loading ? (
                  <div className="text-center py-20 text-gray-400"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
                ) : rechargeRequests.length === 0 ? (
                  <div className="text-center py-20">
                    <Clock className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                    <p className="text-gray-500">{isRTL ? 'لا توجد طلبات شحن حالياً' : 'No recharge requests found'}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead>{isRTL ? 'الكافيتريا' : 'Cafeteria'}</TableHead>
                          <TableHead>{isRTL ? 'البيانات' : 'Details'}</TableHead>
                          <TableHead>{isRTL ? 'المبلغ' : 'Amount'}</TableHead>
                          <TableHead>{isRTL ? 'النقاط' : 'Points'}</TableHead>
                          <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                          <TableHead className="text-center">{isRTL ? 'الإيصال' : 'Receipt'}</TableHead>
                          <TableHead className="text-center">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rechargeRequests.map((req) => (
                          <TableRow key={req.id} className="hover:bg-gray-50/50">
                            <TableCell>
                              <div className="font-bold text-gray-900">{req.cafeteria_name || '---'}</div>
                              <div className="text-[10px] text-gray-500">{new Date(req.requested_at).toLocaleString(isRTL ? 'ar-SA' : 'en-US')}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1 text-[10px] font-mono text-blue-600 font-bold"><Hash className="w-3 h-3" /> {req.reference_code || '---'}</div>
                                <div className="flex items-center gap-1 text-[10px] text-gray-500"><Globe className="w-3 h-3" /> {req.country || '---'}</div>
                              </div>
                            </TableCell>
                            <TableCell className="font-bold">{req.amount} <span className="text-[10px] text-gray-500 font-normal">{req.currency}</span></TableCell>
                            <TableCell><Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100">{req.points} Pts</Badge></TableCell>
                            <TableCell>
                              <Badge className={`${req.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : req.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} border-0`}>
                                {isRTL ? (req.status === 'pending' ? 'معلق' : req.status === 'approved' ? 'مقبول' : 'مرفوض') : req.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {req.receipt_url ? (
                                <a href={req.receipt_url} target="_blank" rel="noreferrer" className="inline-flex p-2 bg-gray-100 rounded-lg text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"><ImageIcon className="w-4 h-4" /></a>
                              ) : <span className="text-gray-300">-</span>}
                            </TableCell>
                            <TableCell className="text-center">
                              {req.status === 'pending' && (
                                <div className="flex items-center justify-center gap-2">
                                  <Button size="sm" onClick={() => handleApproveRequest(req)} disabled={submitting} className="bg-green-600 hover:bg-green-700 text-white h-8 px-3"><CheckCircle2 className="w-4 h-4 mr-1" /> {isRTL ? 'قبول' : 'Approve'}</Button>
                                  <Button size="sm" variant="outline" onClick={() => handleRejectRequest(req.id)} disabled={submitting} className="text-red-600 border-red-200 hover:bg-red-50 h-8 px-3"><XCircle className="w-4 h-4 mr-1" /> {isRTL ? 'رفض' : 'Reject'}</Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transaction History Tab */}
          <TabsContent value="history">
            <div className="flex flex-col md:flex-row gap-3 mb-6">
              <Input placeholder={isRTL ? 'ابحث عن معاملة...' : 'Search transaction...'} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1" />
              <Button onClick={() => setShowAddDialog(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-md"><Plus className="w-4 h-4" /> {isRTL ? 'تسجيل معاملة يدوية' : 'Manual Transaction'}</Button>
            </div>
            <Card className="border-0 shadow-md overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>{isRTL ? 'الكافيتريا' : 'Cafeteria'}</TableHead>
                        <TableHead>{isRTL ? 'النوع' : 'Type'}</TableHead>
                        <TableHead>{isRTL ? 'المبلغ' : 'Amount'}</TableHead>
                        <TableHead>{isRTL ? 'السبب' : 'Reason'}</TableHead>
                        <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.map((transaction) => (
                        <TableRow key={transaction.id} className="hover:bg-gray-50/50">
                          <TableCell className="font-semibold text-gray-900">{transaction.cafeteria_name || transaction.cafeteria_id}</TableCell>
                          <TableCell><Badge className={`${transaction.type === 'add' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} border-none text-xs font-bold`}>{isRTL ? (transaction.type === 'add' ? 'إضافة' : 'خصم') : transaction.type}</Badge></TableCell>
                          <TableCell className="font-bold text-lg"><span className={transaction.type === 'add' ? 'text-green-600' : 'text-red-600'}>{transaction.type === 'add' ? '+' : '-'}{transaction.amount}</span></TableCell>
                          <TableCell className="text-gray-600 text-sm">{transaction.reason}</TableCell>
                          <TableCell className="text-gray-500 text-sm">{new Date(transaction.created_at).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Manual Transaction Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className={isRTL ? 'rtl' : 'ltr'} dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader><DialogTitle>{isRTL ? 'تسجيل معاملة نقاط يدوية' : 'Manual Points Transaction'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{isRTL ? 'الكافيتريا' : 'Cafeteria'}</Label>
              <select value={formData.cafeteria_id} onChange={(e) => setFormData({ ...formData, cafeteria_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer">
                <option value="">{isRTL ? 'اختر كافيتريا' : 'Select cafeteria'}</option>
                {cafeterias.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isRTL ? 'النوع' : 'Type'}</Label>
                <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as 'add' | 'deduct' })} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer">
                  <option value="add">{isRTL ? 'إضافة' : 'Add'}</option>
                  <option value="deduct">{isRTL ? 'خصم' : 'Deduct'}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? 'عدد النقاط' : 'Points'}</Label>
                <Input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="1000" min="1" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'السبب' : 'Reason'}</Label>
              <Input value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} placeholder={isRTL ? 'سبب المعاملة' : 'Reason for transaction'} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddDialog(false)} className="flex-1">{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleAddTransaction} disabled={submitting} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">{submitting ? '...' : (isRTL ? 'تسجيل' : 'Record')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
