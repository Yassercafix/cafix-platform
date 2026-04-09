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
import { trpc } from '@/lib/trpc';
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

  const [showAddSectionDialog, setShowAddSectionDialog] = useState(false);
  const [showAddTableDialog, setShowAddTableDialog] = useState(false);
  const [showEditTableDialog, setShowEditTableDialog] = useState(false);
  const [showDeleteTableDialog, setShowDeleteTableDialog] = useState(false);
  const [showQRPreviewDialog, setShowQRPreviewDialog] = useState(false);

  const [selectedTable, setSelectedTable] = useState<TableItem | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const [sectionForm, setSectionForm] = useState({ name: '' });
  const [tableForm, setTableForm] = useState({ tableNumber: '', capacity: '4', sectionId: '' });

  const cafeteriaId = user?.cafeteriaId;

  // tRPC Queries
  const sectionsQuery = trpc.tables.getSections.useQuery(
    { cafeteriaId: cafeteriaId || '' },
    { enabled: !!cafeteriaId }
  );

  const tablesQuery = trpc.tables.getTables.useQuery(
    { cafeteriaId: cafeteriaId || '' },
    { enabled: !!cafeteriaId }
  );

  // tRPC Mutations
  const utils = trpc.useContext();
  
  const createSectionMutation = trpc.tables.createSection.useMutation({
    onSuccess: () => {
      utils.tables.getSections.invalidate();
      toast.success(isRTL ? 'تم إضافة القسم بنجاح' : 'Section added successfully');
      setShowAddSectionDialog(false);
      setSectionForm({ name: '' });
    },
    onError: (err) => {
      toast.error(err.message || (isRTL ? 'خطأ في إضافة القسم' : 'Error adding section'));
    }
  });

  const createTableMutation = trpc.tables.createTable.useMutation({
    onSuccess: () => {
      utils.tables.getTables.invalidate();
      toast.success(isRTL ? 'تم إضافة الطاولة بنجاح' : 'Table added successfully');
      setShowAddTableDialog(false);
      setTableForm({ tableNumber: '', capacity: '4', sectionId: '' });
    },
    onError: (err) => {
      toast.error(err.message || (isRTL ? 'خطأ في إضافة الطاولة' : 'Error adding table'));
    }
  });

  const deleteTableMutation = trpc.tables.deleteTable.useMutation({
    onSuccess: () => {
      utils.tables.getTables.invalidate();
      toast.success(isRTL ? 'تم حذف الطاولة بنجاح' : 'Table deleted successfully');
      setShowDeleteTableDialog(false);
      setSelectedTable(null);
    },
    onError: (err) => {
      toast.error(err.message || (isRTL ? 'خطأ في حذف الطاولة' : 'Error deleting table'));
    }
  });

  const sections = (sectionsQuery.data || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    cafeteriaId: s.cafeteriaId
  }));

  const tables = (tablesQuery.data || []).map((t: any) => ({
    id: t.id,
    tableNumber: t.tableNumber,
    capacity: t.capacity,
    status: t.status,
    sectionId: t.sectionId,
    sectionName: sections.find((s: any) => s.id === t.sectionId)?.name,
    tableToken: t.tableToken,
    cafeteriaId: t.cafeteriaId
  }));

  const loading = sectionsQuery.isLoading || tablesQuery.isLoading;

  const navigationItems = [
    { label: isRTL ? 'لوحة التحكم' : 'Dashboard', path: '/dashboard/cafeteria-admin', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: isRTL ? 'المنيو' : 'Menu', path: '/dashboard/cafeteria-admin/menu', icon: <UtensilsCrossed className="w-5 h-5" /> },
    { label: isRTL ? 'الطاولات' : 'Tables', path: '/dashboard/cafeteria-admin/tables', icon: <Table2 className="w-5 h-5" /> },
    { label: isRTL ? 'الموظفين' : 'Staff', path: '/dashboard/cafeteria-admin/staff', icon: <Users className="w-5 h-5" /> },
    { label: isRTL ? 'التقارير' : 'Reports', path: '/dashboard/cafeteria-admin/reports', icon: <BarChart3 className="w-5 h-5" /> },
    { label: isRTL ? 'شحن النقاط' : 'Recharge', path: '/dashboard/cafeteria-admin/recharge', icon: <CreditCard className="w-5 h-5" /> },
    { label: isRTL ? 'الإعدادات' : 'Settings', path: '/dashboard/cafeteria-admin/settings', icon: <Settings className="w-5 h-5" /> },
  ];

  const handleAddSection = async () => {
    if (!cafeteriaId) return;
    if (!sectionForm.name.trim()) {
      toast.error(isRTL ? 'أدخل اسم القسم' : 'Enter section name');
      return;
    }
    createSectionMutation.mutate({
      cafeteriaId,
      name: sectionForm.name.trim(),
    });
  };

  const handleAddTable = async () => {
    if (!cafeteriaId) return;
    if (!tableForm.tableNumber || !tableForm.sectionId) {
      toast.error(isRTL ? 'يرجى ملء جميع الحقول' : 'Please fill all fields');
      return;
    }
    createTableMutation.mutate({
      cafeteriaId,
      sectionId: tableForm.sectionId,
      tableNumber: parseInt(tableForm.tableNumber),
      capacity: parseInt(tableForm.capacity),
    });
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
    deleteTableMutation.mutate({
      tableId: selectedTable.id,
    });
  };

  const printAllQRs = async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const qrCodes = await Promise.all(tables.map(async (t: any) => {
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
          ${Array.from({ length: Math.ceil(qrCodes.length / 4) }).map((_, pageIdx) => `
            <div class="page">
              ${qrCodes.slice(pageIdx * 4, (pageIdx + 1) * 4).map(qr => `
                <div class="qr-container">
                  <div class="cafeteria-name">${user?.name || 'Cafeteria'}</div>
                  <img src="${qr.url}" class="qr-image" />
                  <div class="table-number">${isRTL ? 'طاولة' : 'Table'} ${qr.number}</div>
                </div>
              `).join('')}
            </div>
          `).join('')}
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
          <div className="flex gap-2">
            <Button onClick={() => setShowAddSectionDialog(true)} variant="outline" className="gap-2">
              <Layers className="w-4 h-4" />
              {isRTL ? 'إضافة قسم' : 'Add Section'}
            </Button>
            <Button onClick={() => setShowAddTableDialog(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
              <Plus className="w-4 h-4" />
              {isRTL ? 'إضافة طاولة' : 'Add Table'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">{isRTL ? 'إجمالي الطاولات' : 'Total Tables'}</p>
                  <h3 className="text-3xl font-bold mt-1">{tables.length}</h3>
                </div>
                <div className="bg-blue-500 p-3 rounded-lg"><Table2 className="w-6 h-6" /></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">{isRTL ? 'الأقسام' : 'Sections'}</p>
                  <h3 className="text-3xl font-bold mt-1 text-slate-900">{sections.length}</h3>
                </div>
                <div className="bg-slate-100 p-3 rounded-lg text-slate-600"><Layers className="w-6 h-6" /></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <Button onClick={printAllQRs} variant="outline" className="w-full h-full py-4 flex-col gap-2 border-dashed border-2">
                <Printer className="w-6 h-6 text-blue-600" />
                <span className="font-bold text-slate-700">{isRTL ? 'طباعة جميع الباركودات' : 'Print All QR Codes'}</span>
              </Button>
            </CardContent>
          </Card>
        </div>

        {sections.length === 0 ? (
          <Card className="border-dashed border-2 bg-slate-50">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-white p-4 rounded-full shadow-sm mb-4"><Layers className="w-8 h-8 text-slate-300" /></div>
              <h3 className="text-lg font-bold text-slate-900">{isRTL ? 'لا توجد أقسام بعد' : 'No sections yet'}</h3>
              <p className="text-slate-500 max-w-xs mt-1">{isRTL ? 'يجب إضافة قسم واحد على الأقل (مثل: الصالة الرئيسية) لتتمكن من إضافة الطاولات' : 'Add at least one section (e.g. Main Hall) to start adding tables'}</p>
              <Button onClick={() => setShowAddSectionDialog(true)} className="mt-6 bg-blue-600 hover:bg-blue-700 text-white">{isRTL ? 'إضافة أول قسم' : 'Add First Section'}</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {sections.map((section: any) => {
              const sectionTables = tables.filter((t: any) => t.sectionId === section.id);
              return (
                <div key={section.id}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <div className="w-2 h-6 bg-blue-600 rounded-full"></div>
                      {section.name}
                      <span className="text-sm font-normal text-slate-400 ml-2">({sectionTables.length} {isRTL ? 'طاولة' : 'tables'})</span>
                    </h2>
                  </div>
                  
                  {sectionTables.length === 0 ? (
                    <div className="bg-white border rounded-xl p-8 text-center">
                      <p className="text-slate-400 text-sm">{isRTL ? 'لا توجد طاولات في هذا القسم' : 'No tables in this section'}</p>
                      <Button variant="link" onClick={() => {
                        setTableForm({ ...tableForm, sectionId: section.id });
                        setShowAddTableDialog(true);
                      }} className="text-blue-600 font-bold">{isRTL ? 'إضافة طاولة' : 'Add Table'}</Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {sectionTables.map((table: any) => (
                        <Card key={table.id} className="overflow-hidden hover:shadow-md transition-shadow group">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-4">
                              <div className="bg-blue-50 text-blue-700 w-10 h-10 rounded-lg flex items-center justify-center font-black text-lg">
                                {table.tableNumber}
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                                  setSelectedTable(table);
                                  setShowDeleteTableDialog(true);
                                }}>
                                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                </Button>
                              </div>
                            </div>
                            
                            <div className="space-y-1 mb-4">
                              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{isRTL ? 'السعة' : 'Capacity'}</p>
                              <p className="text-sm font-bold text-slate-700">{table.capacity} {isRTL ? 'أشخاص' : 'Persons'}</p>
                            </div>

                            <Button onClick={() => generateQR(table)} variant="outline" className="w-full gap-2 text-xs font-bold border-blue-100 text-blue-600 hover:bg-blue-50 hover:border-blue-200">
                              <QrCode className="w-3.5 h-3.5" />
                              {isRTL ? 'باركود الطلب' : 'Order QR'}
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add Section Dialog */}
      <Dialog open={showAddSectionDialog} onOpenChange={setShowAddSectionDialog}>
        <DialogContent className="max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader><DialogTitle>{isRTL ? 'إضافة قسم جديد' : 'Add New Section'}</DialogTitle></DialogHeader>
          <div className="py-4">
            <Label>{isRTL ? 'اسم القسم' : 'Section Name'}</Label>
            <Input value={sectionForm.name} onChange={e => setSectionForm({ name: e.target.value })} className="mt-1" placeholder={isRTL ? 'مثال: الصالة الرئيسية، التراس' : 'e.g. Main Hall, Terrace'} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddSectionDialog(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleAddSection} disabled={createSectionMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
              {createSectionMutation.isPending ? '...' : (isRTL ? 'إضافة' : 'Add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Table Dialog */}
      <Dialog open={showAddTableDialog} onOpenChange={setShowAddTableDialog}>
        <DialogContent className="max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader><DialogTitle>{isRTL ? 'إضافة طاولة جديدة' : 'Add New Table'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{isRTL ? 'رقم الطاولة' : 'Table Number'}</Label>
              <Input type="number" value={tableForm.tableNumber} onChange={e => setTableForm({ ...tableForm, tableNumber: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>{isRTL ? 'القسم' : 'Section'}</Label>
              <Select value={tableForm.sectionId} onValueChange={v => setTableForm({ ...tableForm, sectionId: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={isRTL ? 'اختر القسم' : 'Select section'} /></SelectTrigger>
                <SelectContent>
                  {sections.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{isRTL ? 'السعة (عدد الأشخاص)' : 'Capacity (Persons)'}</Label>
              <Input type="number" value={tableForm.capacity} onChange={e => setTableForm({ ...tableForm, capacity: e.target.value })} className="mt-1" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddTableDialog(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleAddTable} disabled={createTableMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
              {createTableMutation.isPending ? '...' : (isRTL ? 'إضافة' : 'Add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Preview Dialog */}
      <Dialog open={showQRPreviewDialog} onOpenChange={setShowQRPreviewDialog}>
        <DialogContent className="max-w-sm" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader><DialogTitle>{isRTL ? 'باركود الطاولة' : 'Table QR Code'}</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center justify-center py-6">
            <div className="bg-white p-4 rounded-2xl shadow-sm border mb-4">
              <img src={qrDataUrl} alt="QR Code" className="w-48 h-48" />
            </div>
            <h3 className="text-xl font-black text-slate-900">{isRTL ? 'طاولة' : 'Table'} {selectedTable?.tableNumber}</h3>
            <p className="text-slate-500 text-sm">{selectedTable?.sectionName}</p>
          </div>
          <DialogFooter className="sm:justify-center gap-2">
            <Button onClick={() => {
              const link = document.createElement('a');
              link.href = qrDataUrl;
              link.download = `table-${selectedTable?.tableNumber}-qr.png`;
              link.click();
            }} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
              <Download className="w-4 h-4" />
              {isRTL ? 'تحميل الصورة' : 'Download PNG'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Table Alert */}
      <AlertDialog open={showDeleteTableDialog} onOpenChange={setShowDeleteTableDialog}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRTL ? 'حذف الطاولة' : 'Delete Table'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL ? `هل أنت متأكد من حذف الطاولة رقم ${selectedTable?.tableNumber}؟ لا يمكن التراجع عن هذا الإجراء.` : `Are you sure you want to delete table ${selectedTable?.tableNumber}? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTable} className="bg-red-600 hover:bg-red-700">{isRTL ? 'حذف' : 'Delete'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
