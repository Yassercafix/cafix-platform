import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTranslation } from '@/locales/useTranslation';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DashboardNavigation } from '@/components/DashboardNavigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard, LayoutDashboard, UtensilsCrossed, Table2, Users, BarChart3, Settings, Plus, Trash2, Upload, FileText, Image as ImageIcon, Hash, Globe, Wallet, Loader2, AlertCircle, X } from 'lucide-react';
import { trpcVanilla as trpc } from '@/lib/trpcVanilla';
import { trpc as trpcReact } from '@/lib/trpc';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

interface RechargeRequest {
  id: string;
  cafeteriaId: string;
  amount: number;
  status: string;
  paymentMethod?: string;
  paidCurrency?: string;
  notes?: string;
  createdAt: Date;
  processedAt?: Date;
}

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'mobile_wallet', label: 'Mobile Wallet' },
];

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'EGP', symbol: 'ج.م', name: 'Egyptian Pound' },
  { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'KWD', symbol: 'د.ك', name: 'Kuwaiti Dinar' },
  { code: 'JOD', symbol: 'د.ا', name: 'Jordanian Dinar' },
];

// Strict English number validation
const isEnglishNumber = (value: string): boolean => {
  return /^[0-9]*\.?[0-9]*$/.test(value) && !/[٠-٩]/.test(value);
};

export default function CafeteriaRecharge() {
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const { language } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [requests, setRequests] = useState<RechargeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RechargeRequest | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [amountError, setAmountError] = useState('');

  const [formData, setFormData] = useState({
    amount: '',
    paymentMethod: 'bank_transfer',
    currency: 'USD',
    notes: '',
  });

  const { data: instructionsData } = trpcReact.system.getPaymentInstructions.useQuery();

  const isRTL = language === 'ar';
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

  const fetchRequests = useCallback(async () => {
    if (!cafeteriaId) return;
    setLoading(true);
    try {
      const result = await trpc.recharges.getRequests.query({
        cafeteriaId,
        limit: 50,
        offset: 0,
      });

      const mapped = (result.requests || []).map((r: any) => ({
        id: r.id,
        cafeteriaId: r.cafeteriaId,
        amount: r.amount,
        status: r.status,
        paymentMethod: r.paymentMethod,
        paidCurrency: r.paidCurrency,
        notes: r.notes,
        createdAt: new Date(r.createdAt),
        processedAt: r.processedAt ? new Date(r.processedAt) : undefined,
      }));

      setRequests(mapped);
    } catch (err: any) {
      console.error('Error fetching recharge requests:', err);
      toast.error(isRTL ? 'خطأ في تحميل الطلبات' : 'Error loading requests');
    } finally {
      setLoading(false);
    }
  }, [cafeteriaId, isRTL]);

  useEffect(() => {
    if (!authLoading && cafeteriaId) {
      fetchRequests();
    }
  }, [cafeteriaId, authLoading, fetchRequests]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Validate English numbers only
    if (value && !isEnglishNumber(value)) {
      setAmountError(isRTL ? 'يجب استخدام الأرقام الإنجليزية فقط' : 'English numbers only');
      return;
    }
    
    setAmountError('');
    setFormData({ ...formData, amount: value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files);
      const totalSize = uploadedFiles.reduce((sum, f) => sum + f.size, 0) + 
                       newFiles.reduce((sum, f) => sum + f.size, 0);

      if (totalSize > 50 * 1024 * 1024) {
        toast.error(isRTL ? 'إجمالي حجم الملفات كبير جداً (الحد الأقصى 50 ميجابايت)' : 'Total file size too large (Max 50MB)');
        return;
      }

      for (const file of newFiles) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(isRTL ? `حجم الملف ${file.name} كبير جداً (الحد الأقصى 10 ميجابايت)` : `File ${file.name} too large (Max 10MB)`);
          return;
        }
        
        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
        if (!validTypes.includes(file.type)) {
          toast.error(isRTL ? `نوع الملف ${file.name} غير مدعوم` : `File type ${file.type} not supported`);
          return;
        }
      }

      setUploadedFiles([...uploadedFiles, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const handleAddRequest = async () => {
    if (!cafeteriaId || !formData.amount) {
      toast.error(isRTL ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields');
      return;
    }

    // Validate amount format (English numbers only)
    if (!isEnglishNumber(formData.amount)) {
      setAmountError(isRTL ? 'يجب استخدام الأرقام الإنجليزية فقط' : 'English numbers only');
      return;
    }

    const amountNum = parseFloat(formData.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error(isRTL ? 'المبلغ يجب أن يكون رقماً موجباً' : 'Amount must be a positive number');
      return;
    }

    setSubmitting(true);
    try {
      // Upload files to Supabase Storage
      const attachmentUrls: string[] = [];
      const BUCKET_NAME = 'recharge-attachments';

      for (const file of uploadedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${cafeteriaId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = fileName;

        const { error: uploadError, data } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw new Error(isRTL ? `فشل تحميل الملف: ${file.name}` : `Failed to upload file: ${file.name}`);
        }

        // Store the path/key instead of full URL for better flexibility
        attachmentUrls.push(data.path);
      }

      // Create recharge request with storage paths
      const result = await trpc.recharges.createRequest.mutate({
        cafeteriaId,
        amount: amountNum,
        paymentMethod: formData.paymentMethod,
        paidCurrency: formData.currency,
        notes: formData.notes,
        attachmentUrls: attachmentUrls.length > 0 ? attachmentUrls : undefined,
      });

      if (result.success) {
        toast.success(isRTL ? 'تم إرسال طلب الشحن بنجاح' : 'Recharge request submitted successfully');
        setShowDialog(false);
        setFormData({ amount: '', paymentMethod: 'bank_transfer', currency: 'USD', notes: '' });
        setUploadedFiles([]);
        setAmountError('');
        fetchRequests();
      }
    } catch (err: any) {
      console.error('Submit request error:', err);
      toast.error(err.message || (isRTL ? 'خطأ في إرسال الطلب' : 'Error submitting request'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRequest = async () => {
    if (!selectedRequest) return;
    setSubmitting(true);
    try {
      const result = await trpc.recharges.deleteRequest.mutate({
        rechargeRequestId: selectedRequest.id,
      });

      if (result.success) {
        toast.success(isRTL ? 'تم حذف الطلب' : 'Request deleted');
        setShowDeleteDialog(false);
        setSelectedRequest(null);
        fetchRequests();
      }
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'خطأ في حذف الطلب' : 'Error deleting request'));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-0">{isRTL ? 'معلق' : 'Pending'}</Badge>;
      case 'under_review':
        return <Badge className="bg-blue-100 text-blue-800 border-0">{isRTL ? 'قيد المراجعة' : 'Under Review'}</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 border-0">{isRTL ? 'موافق عليه' : 'Approved'}</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 border-0">{isRTL ? 'مرفوض' : 'Rejected'}</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-0">{status}</Badge>;
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      <DashboardHeader 
        title="Recharge"
        onMenuClick={() => setMenuOpen(!menuOpen)} 
      />

      <div className="flex flex-1 overflow-hidden">
        <DashboardNavigation 
          items={navigationItems} 
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {isRTL ? 'شحن النقاط' : 'Recharge Points'}
                </h1>
                <p className="text-gray-500">
                  {isRTL ? 'إدارة طلبات شحن الرصيد والنقاط' : 'Manage your balance and point recharge requests'}
                </p>
              </div>
              <Button onClick={() => setShowDialog(true)} className="w-full md:w-auto">
                <Plus className="w-4 h-4 mr-2 ml-2" />
                {isRTL ? 'طلب شحن جديد' : 'New Recharge Request'}
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-medium">
                  {isRTL ? 'سجل الطلبات' : 'Request History'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                  </div>
                ) : requests.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>{isRTL ? 'لا توجد طلبات شحن حالياً' : 'No recharge requests found'}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                          <TableHead>{isRTL ? 'المبلغ' : 'Amount'}</TableHead>
                          <TableHead>{isRTL ? 'العملة' : 'Currency'}</TableHead>
                          <TableHead>{isRTL ? 'وسيلة الدفع' : 'Payment Method'}</TableHead>
                          <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                          <TableHead className="text-right">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {requests.map((request) => (
                          <TableRow key={request.id}>
                            <TableCell className="whitespace-nowrap">
                              {request.createdAt.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US')}
                            </TableCell>
                            <TableCell className="font-medium">
                              {request.amount.toLocaleString()}
                            </TableCell>
                            <TableCell>{request.paidCurrency || 'USD'}</TableCell>
                            <TableCell>
                              {PAYMENT_METHODS.find(m => m.value === request.paymentMethod)?.label || request.paymentMethod || '-'}
                            </TableCell>
                            <TableCell>{getStatusBadge(request.status)}</TableCell>
                            <TableCell className="text-right">
                              {request.status === 'pending' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => {
                                    setSelectedRequest(request);
                                    setShowDeleteDialog(true);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
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
          </div>
        </main>
      </div>

      {/* New Request Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{isRTL ? 'طلب شحن نقاط جديد' : 'New Recharge Request'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {instructionsData?.instructions && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
                <h4 className="font-bold text-blue-900 flex items-center gap-2 text-sm">
                  <CreditCard className="w-4 h-4" />
                  {isRTL ? 'تعليمات الدفع' : 'Payment Instructions'}
                </h4>
                <p className="text-xs text-blue-800 whitespace-pre-wrap leading-relaxed">
                  {instructionsData.instructions}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="amount">{isRTL ? 'المبلغ' : 'Amount'}</Label>
              <div className="relative">
                <Input
                  id="amount"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={handleAmountChange}
                  className={amountError ? 'border-red-500' : ''}
                />
                <div className={`absolute inset-y-0 ${isRTL ? 'left-3' : 'right-3'} flex items-center pointer-events-none text-gray-400`}>
                  <Hash className="w-4 h-4" />
                </div>
              </div>
              {amountError && <p className="text-xs text-red-500 mt-1">{amountError}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currency">{isRTL ? 'العملة' : 'Currency'}</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(v) => setFormData({ ...formData, currency: v })}
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} ({c.symbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="method">{isRTL ? 'وسيلة الدفع' : 'Payment Method'}</Label>
                <Select
                  value={formData.paymentMethod}
                  onValueChange={(v) => setFormData({ ...formData, paymentMethod: v })}
                >
                  <SelectTrigger id="method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{isRTL ? 'المرفقات (صور أو PDF)' : 'Attachments (Images or PDF)'}</Label>
              <div 
                className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer relative"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                  accept="image/jpeg,image/png,image/gif,application/pdf"
                />
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-500">
                  {isRTL ? 'انقر لتحميل الملفات' : 'Click to upload files'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {isRTL ? 'الحد الأقصى 10 ميجابايت للملف' : 'Max 10MB per file'}
                </p>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="space-y-2 mt-3">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded border text-sm">
                      <div className="flex items-center overflow-hidden">
                        {file.type.includes('image') ? (
                          <ImageIcon className="w-4 h-4 mr-2 ml-2 text-blue-500 flex-shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 mr-2 ml-2 text-red-500 flex-shrink-0" />
                        )}
                        <span className="truncate max-w-[200px]">{file.name}</span>
                        <span className="text-gray-400 text-xs ml-2 mr-2">
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-gray-400 hover:text-red-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(index);
                        }}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{isRTL ? 'ملاحظات إضافية' : 'Additional Notes'}</Label>
              <Input
                id="notes"
                placeholder={isRTL ? 'أي معلومات إضافية عن الدفع...' : 'Any additional payment info...'}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={submitting}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleAddRequest} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 ml-2 animate-spin" />
                  {isRTL ? 'جاري الإرسال...' : 'Submitting...'}
                </>
              ) : (
                isRTL ? 'إرسال الطلب' : 'Submit Request'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRTL ? 'هل أنت متأكد من حذف الطلب؟' : 'Are you sure you want to delete this request?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL 
                ? 'لا يمكن التراجع عن هذا الإجراء. سيتم حذف طلب الشحن نهائياً.' 
                : 'This action cannot be undone. This will permanently delete your recharge request.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={handleDeleteRequest}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 ml-2 animate-spin" />
                  {isRTL ? 'جاري الحذف...' : 'Deleting...'}
                </>
              ) : (
                isRTL ? 'تأكيد الحذف' : 'Confirm Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
