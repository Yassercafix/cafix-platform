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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import {
  Table2, LayoutDashboard, UtensilsCrossed, Users, BarChart3, CreditCard, Settings,
  Plus, Edit, Trash2, QrCode, Layers, AlertCircle, Printer, Download, FileText
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import QRCode from 'qrcode';

interface Section {
  id: string;
  name: string;
  cafeteriaId: string;
}

interface TableItem {
  id: string;
  tableNumber: number;
  capacity: number;
  status: string;
  sectionId: string;
  sectionName?: string;
  tableToken: string;
  cafeteriaId: string;
}

export default function CafeteriaTables() {
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const { language } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isRTL = language === 'ar';

  const [sections, setSections] = useState<Section[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddSectionDialog, setShowAddSectionDialog] = useState(false);
  const [showAddTableDialog, setShowAddTableDialog] = useState(false);
  const [showEditTableDialog, setShowEditTableDialog] = useState(false);
  const [showDeleteTableDialog, setShowDeleteTableDialog] = useState(false);
  const [showQRPreviewDialog, setShowQRPreviewDialog] = useState(false);

  const [selectedTable, setSelectedTable] = useState<TableItem | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const [sectionForm, setSectionForm] = useState({ name: '' });
  const [tableForm, setTableForm] = useState({ tableNumber: '', capacity: '4', sectionId: '' });

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

  const fetchData = useCallback(async () => {
    if (!cafeteriaId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [sectionsRes, tablesRes] = await Promise.all([
        supabase.from('sections').select('*').eq('cafeteria_id', cafeteriaId).order('display_order'),
        supabase.from('cafeteria_tables').select('*, sections(name)').eq('cafeteria_id', cafeteriaId).order('table_number'),
      ]);

      if (sectionsRes.error) throw sectionsRes.error;
      if (tablesRes.error) throw tablesRes.error;

      setSections((sectionsRes.data || []).map((s: any) => ({
        id: s.id, name: s.name, cafeteriaId: s.cafeteria_id,
      })));
      
      setTables((tablesRes.data || []).map((t: any) => ({
        id: t.id,
        tableNumber: t.table_number,
        capacity: t.capacity,
        status: t.status,
        sectionId: t.section_id,
        sectionName: t.sections?.name,
        tableToken: t.table_token,
        cafeteriaId: t.cafeteria_id,
      })));
    } catch (err: any) {
      console.error('Error fetching tables:', err);
      toast.error(isRTL ? 'خطأ في تحميل البيانات' : 'Error loading data');
    } finally {
      setLoading(false);
    }
  }, [cafeteriaId, isRTL]);

  useEffect(() => {
    if (!authLoading && cafeteriaId) {
      fetchData();
    }
  }, [cafeteriaId, authLoading, fetchData]);

  const handleAddSection = async () => {
    if (!cafeteriaId) return;
    if (!sectionForm.name.trim()) {
      toast.error(isRTL ? 'أدخل اسم القسم' : 'Enter section name');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('sections').insert({
        id: crypto.randomUUID ? crypto.randomUUID() : undefined,
        cafeteria_id: cafeteriaId,
        name: sectionForm.name.trim(),
        display_order: sections.length,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success(isRTL ? 'تم إضافة القسم بنجاح' : 'Section added successfully');
      setShowAddSectionDialog(false);
      setSectionForm({ name: '' });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'خطأ في إضافة القسم' : 'Error adding section'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddTable = async () => {
    if (!cafeteriaId) return;
    if (!tableForm.tableNumber || !tableForm.sectionId) {
      toast.error(isRTL ? 'يرجى ملء جميع الحقول' : 'Please fill all fields');
      return;
    }
    setSubmitting(true);
    try {
      const tableToken = Math.random().toString(36).substring(2, 34);
      const { error } = await supabase.from('cafeteria_tables').insert({
        id: crypto.randomUUID ? crypto.randomUUID() : undefined,
        cafeteria_id: cafeteriaId,
        section_id: tableForm.sectionId,
        table_number: parseInt(tableForm.tableNumber),
        capacity: parseInt(tableForm.capacity),
        status: 'available',
        table_token: tableToken,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success(isRTL ? 'تم إضافة الطاولة بنجاح' : 'Table added successfully');
      setShowAddTableDialog(false);
      setTableForm({ tableNumber: '', capacity: '4', sectionId: '' });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'خطأ في إضافة الطاولة' : 'Error adding table'));
    } finally {
      setSubmitting(false);
    }
  };

  const generateQR = async (table: TableItem) => {
    try {
      const orderUrl = `${window.location.origin}/order/${table.tableToken}`;
      const url = await QRCode.toDataURL(orderUrl, { width: 512, margin: 2 });
      setQrDataUrl(url);
      setSelectedTable(table);
      setShowQRPreviewDialog(true);
    } catch (err) {
      toast.error(isRTL ? 'خطأ في توليد الباركود' : 'Error generating QR');
    }
  };

  const handleDeleteTable = async () => {
    if (!selectedTable) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('cafeteria_tables').delete().eq('id', selectedTable.id);
      if (error) throw error;
      toast.success(isRTL ? 'تم حذف الطاولة بنجاح' : 'Table deleted successfully');
      setShowDeleteTableDialog(false);
      setSelectedTable(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'خطأ في حذف الطاولة' : 'Error deleting table'));
    } finally {
      setSubmitting(false);
    }
  };

  const printAllQRs = async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const qrCodes = await Promise.all(tables.map(async (t) => {
      const url = await QRCode.toDataURL(`${window.location.origin}/order/${t.tableToken}`, { width: 400, margin: 2 });
      return { url, number: t.tableNumber };
    }));

    const html = `
      <html>
        <head>
          <title>Table QR Codes</title>
          <style>
            @page { size: A4; margin: 0; }
            body { margin: 0; font-family: sans-serif; }
            .page { width: 210mm; height: 297mm; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; page-break-after: always; }
            .qr-container { display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px dashed #ccc; padding: 20px; }
            .qr-image { width: 140mm; height: 140mm; object-fit: contain; }
            .table-number { font-size: 48pt; font-weight: bold; margin-top: 20px; color: #333; }
            .cafeteria-name { font-size: 18pt; color: #666; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          \${Array.from({ length: Math.ceil(qrCodes.length / 4) }).map((_, pageIdx) => \`
            <div class="page">
              \${qrCodes.slice(pageIdx * 4, (pageIdx + 1) * 4).map(qr => \`
                <div class="qr-container">
                  <div class="cafeteria-name">\${user?.name || 'Cafeteria'}</div>
                  <img src="\${qr.url}" class="qr-image" />
                  <div class="table-number">\${isRTL ? 'طاولة' : 'Table'} \${qr.number}</div>
                </div>
              \`).join('')}
            </div>
          \`).join('')}
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (authLoading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
      <DashboardHeader showBackButton={true} showHomeButton={true} title={isRTL ? 'إدارة الطاولات' : 'Tables Management'} onMenuClick={() => setMenuOpen(true)} />
      <DashboardNavigation isOpen={menuOpen} onClose={() => setMenuOpen(false)} items={navigationItems} />

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900">{isRTL ? 'الطاولات والأقسام' : 'Tables & Sections'}</h1>
            <p className="text-slate-500">{isRTL ? 'تنظيم طاولات الكافيتيريا وتوليد باركود الطلب' : 'Organize tables and generate order QR codes'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={printAllQRs} variant="outline" className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50">
              <Printer className="w-4 h-4" /> {isRTL ? 'طباعة الكل (PDF)' : 'Print All (PDF)'}
            </Button>
            <Button onClick={() => setShowAddSectionDialog(true)} variant="outline" className="gap-2">
              <Layers className="w-4 h-4" /> {isRTL ? 'إضافة قسم' : 'Add Section'}
            </Button>
            <Button onClick={() => setShowAddTableDialog(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-md">
              <Plus className="w-4 h-4" /> {isRTL ? 'إضافة طاولة' : 'Add Table'}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-400"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
        ) : tables.length === 0 ? (
          <Card className="border-dashed border-2 bg-transparent py-20 text-center">
            <Table2 className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">{isRTL ? 'لا توجد طاولات مضافة حالياً' : 'No tables added yet'}</p>
            <Button onClick={() => setShowAddTableDialog(true)} variant="link" className="text-blue-600 mt-2">{isRTL ? 'أضف أول طاولة الآن' : 'Add your first table now'}</Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {tables.map((table) => (
              <Card key={table.id} className="group hover:shadow-xl transition-all border-0 shadow-md overflow-hidden rounded-2xl">
                <CardHeader className="bg-slate-50 pb-4 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-2xl font-black text-blue-600 border border-slate-100">
                      {table.tableNumber}
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold">{isRTL ? 'طاولة' : 'Table'} {table.tableNumber}</CardTitle>
                      <Badge variant="outline" className="text-[10px] py-0 h-5 bg-white">{table.sectionName || (isRTL ? 'بدون قسم' : 'No Section')}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" onClick={() => generateQR(table)} className="h-8 w-8 text-blue-600 hover:bg-blue-50"><QrCode className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { setSelectedTable(table); setShowDeleteTableDialog(true); }} className="h-8 w-8 text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {table.capacity} {isRTL ? 'أشخاص' : 'Persons'}</span>
                    <Badge className={table.status === 'available' ? 'bg-green-100 text-green-700 border-0' : 'bg-red-100 text-red-700 border-0'}>
                      {isRTL ? (table.status === 'available' ? 'متاحة' : 'مشغولة') : table.status}
                    </Badge>
                  </div>
                  <Button onClick={() => generateQR(table)} className="w-full bg-slate-900 hover:bg-black text-white gap-2 rounded-xl">
                    <QrCode className="w-4 h-4" /> {isRTL ? 'عرض الباركود' : 'View QR Code'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* QR Preview Dialog */}
      <Dialog open={showQRPreviewDialog} onOpenChange={setShowQRPreviewDialog}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader><DialogTitle className="text-center">{isRTL ? `باركود طاولة ${selectedTable?.tableNumber}` : `QR Code Table ${selectedTable?.tableNumber}`}</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center justify-center py-6 space-y-6">
            <div className="p-4 bg-white rounded-3xl shadow-inner border-8 border-slate-50">
              <img src={qrDataUrl} alt="QR Code" className="w-64 h-64" />
            </div>
            <div className="text-center">
              <p className="text-slate-500 text-sm mb-4">{isRTL ? 'امسح الكود للبدء في الطلب' : 'Scan to start ordering'}</p>
              <div className="flex gap-2">
                <Button onClick={() => {
                  const link = document.createElement('a');
                  link.download = `table-${selectedTable?.tableNumber}-qr.png`;
                  link.href = qrDataUrl;
                  link.click();
                }} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 rounded-xl">
                  <Download className="w-4 h-4" /> {isRTL ? 'تحميل الصورة' : 'Download Image'}
                </Button>
                <Button onClick={() => window.print()} variant="outline" className="gap-2 rounded-xl">
                  <Printer className="w-4 h-4" /> {isRTL ? 'طباعة' : 'Print'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Section Dialog */}
      <Dialog open={showAddSectionDialog} onOpenChange={setShowAddSectionDialog}>
        <DialogContent className={isRTL ? 'rtl' : 'ltr'} dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader><DialogTitle>{isRTL ? 'إضافة قسم جديد' : 'Add New Section'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{isRTL ? 'اسم القسم' : 'Section Name'}</Label>
              <Input value={sectionForm.name} onChange={e => setSectionForm({ name: e.target.value })} placeholder={isRTL ? 'مثال: الصالة الرئيسية' : 'e.g. Main Hall'} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddSectionDialog(false)} className="flex-1">{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleAddSection} disabled={submitting} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">{submitting ? '...' : (isRTL ? 'إضافة' : 'Add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Table Dialog */}
      <Dialog open={showAddTableDialog} onOpenChange={setShowAddTableDialog}>
        <DialogContent className={isRTL ? 'rtl' : 'ltr'} dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader><DialogTitle>{isRTL ? 'إضافة طاولة جديدة' : 'Add New Table'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isRTL ? 'رقم الطاولة' : 'Table Number'}</Label>
                <Input type="number" value={tableForm.tableNumber} onChange={e => setTableForm({ ...tableForm, tableNumber: e.target.value })} placeholder="1" />
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? 'السعة (أشخاص)' : 'Capacity'}</Label>
                <Input type="number" value={tableForm.capacity} onChange={e => setTableForm({ ...tableForm, capacity: e.target.value })} placeholder="4" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'القسم' : 'Section'}</Label>
              <select 
                value={tableForm.sectionId} 
                onChange={e => setTableForm({ ...tableForm, sectionId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">{isRTL ? 'اختر القسم' : 'Select Section'}</option>
                {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddTableDialog(false)} className="flex-1">{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleAddTable} disabled={submitting} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">{submitting ? '...' : (isRTL ? 'إضافة' : 'Add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Table Alert */}
      <AlertDialog open={showDeleteTableDialog} onOpenChange={setShowDeleteTableDialog}>
        <AlertDialogContent className={isRTL ? 'rtl' : 'ltr'} dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRTL ? 'هل أنت متأكد؟' : 'Are you sure?'}</AlertDialogTitle>
            <AlertDialogDescription>{isRTL ? 'سيتم حذف الطاولة نهائياً ولن يتمكن العملاء من الطلب عبر الباركود الخاص بها.' : 'This will permanently delete the table and customers will no longer be able to order using its QR code.'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="flex-1">{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTable} className="flex-1 bg-red-600 hover:bg-red-700 text-white">{isRTL ? 'حذف' : 'Delete'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
