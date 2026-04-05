import React, { useState, useEffect } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTranslation } from '@/locales/useTranslation';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DashboardNavigation } from '@/components/DashboardNavigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  UtensilsCrossed, LayoutDashboard, Table2, Users, BarChart3, CreditCard, Settings,
  Plus, Edit, Trash2, Tag, DollarSign, Eye, EyeOff, AlertCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

interface Category {
  id: string;
  name: string;
  displayOrder: number;
  cafeteriaId: string;
}

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  categoryId: string;
  categoryName?: string;
  isAvailable: boolean;
  cafeteriaId: string;
}

export default function CafeteriaMenu() {
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const { language } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isRTL = language === 'ar';

  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false);
  const [showEditCategoryDialog, setShowEditCategoryDialog] = useState(false);
  const [showDeleteCategoryDialog, setShowDeleteCategoryDialog] = useState(false);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [showEditItemDialog, setShowEditItemDialog] = useState(false);
  const [showDeleteItemDialog, setShowDeleteItemDialog] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [categoryForm, setCategoryForm] = useState({ name: '' });
  const [itemForm, setItemForm] = useState({ name: '', description: '', price: '', categoryId: '', isAvailable: true });

  // Use cafeteriaId from user metadata
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

  const fetchData = async () => {
    if (!cafeteriaId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Fetch categories
      const { data: catData, error: catError } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('cafeteria_id', cafeteriaId)
        .order('display_order');
      
      if (catError) throw catError;

      // Fetch items
      const { data: itemsData, error: itemsError } = await supabase
        .from('menu_items')
        .select('*, menu_categories(name)')
        .eq('cafeteria_id', cafeteriaId)
        .order('name');
      
      if (itemsError) throw itemsError;

      setCategories((catData || []).map((c: any) => ({
        id: c.id, name: c.name, displayOrder: c.display_order || 0, cafeteriaId: c.cafeteria_id,
      })));
      
      setMenuItems((itemsData || []).map((i: any) => ({
        id: i.id,
        name: i.name,
        description: i.description,
        price: Number(i.price),
        categoryId: i.category_id,
        categoryName: i.menu_categories?.name,
        isAvailable: i.is_available !== false,
        cafeteriaId: i.cafeteria_id,
      })));
    } catch (err: any) {
      console.error('Error fetching menu:', err);
      toast.error(isRTL ? 'خطأ في تحميل المنيو' : 'Error loading menu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && cafeteriaId) {
      fetchData();
    }
  }, [cafeteriaId, authLoading]);

  const handleAddCategory = async () => {
    if (!cafeteriaId) {
      toast.error(isRTL ? 'معرف الكافيتيريا مفقود' : 'Cafeteria ID is missing');
      return;
    }
    if (!categoryForm.name.trim()) {
      toast.error(isRTL ? 'أدخل اسم الفئة' : 'Enter category name');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.from('menu_categories').insert({
        id: crypto.randomUUID ? crypto.randomUUID() : undefined,
        cafeteria_id: cafeteriaId,
        name: categoryForm.name.trim(),
        display_order: categories.length,
        created_at: new Date().toISOString(),
      }).select();

      if (error) throw error;
      
      toast.success(isRTL ? 'تم إضافة الفئة بنجاح' : 'Category added successfully');
      setShowAddCategoryDialog(false);
      setCategoryForm({ name: '' });
      fetchData();
    } catch (err: any) {
      console.error('Add category error:', err);
      toast.error(err.message || (isRTL ? 'خطأ في إضافة الفئة' : 'Error adding category'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditCategory = async () => {
    if (!selectedCategory || !categoryForm.name.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('menu_categories')
        .update({ name: categoryForm.name.trim() })
        .eq('id', selectedCategory.id);
      
      if (error) throw error;
      
      toast.success(isRTL ? 'تم تحديث الفئة' : 'Category updated');
      setShowEditCategoryDialog(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'خطأ في تحديث الفئة' : 'Error updating category'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!selectedCategory) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('menu_categories').delete().eq('id', selectedCategory.id);
      if (error) throw error;
      toast.success(isRTL ? 'تم حذف الفئة' : 'Category deleted');
      setShowDeleteCategoryDialog(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'خطأ في حذف الفئة' : 'Error deleting category'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddItem = async () => {
    if (!cafeteriaId) {
      toast.error(isRTL ? 'معرف الكافيتيريا مفقود' : 'Cafeteria ID is missing');
      return;
    }
    if (!itemForm.name.trim() || !itemForm.price || !itemForm.categoryId) {
      toast.error(isRTL ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('menu_items').insert({
        id: crypto.randomUUID ? crypto.randomUUID() : undefined,
        cafeteria_id: cafeteriaId,
        category_id: itemForm.categoryId,
        name: itemForm.name.trim(),
        description: itemForm.description || null,
        price: parseFloat(itemForm.price),
        is_available: itemForm.isAvailable,
        created_at: new Date().toISOString(),
      });
      
      if (error) throw error;
      
      toast.success(isRTL ? 'تم إضافة الصنف بنجاح' : 'Item added successfully');
      setShowAddItemDialog(false);
      setItemForm({ name: '', description: '', price: '', categoryId: '', isAvailable: true });
      fetchData();
    } catch (err: any) {
      console.error('Add item error:', err);
      toast.error(err.message || (isRTL ? 'خطأ في إضافة الصنف' : 'Error adding item'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditItem = async () => {
    if (!selectedItem) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('menu_items')
        .update({
          name: itemForm.name.trim(),
          description: itemForm.description || null,
          price: parseFloat(itemForm.price),
          category_id: itemForm.categoryId,
          is_available: itemForm.isAvailable,
        })
        .eq('id', selectedItem.id);
      
      if (error) throw error;
      
      toast.success(isRTL ? 'تم تحديث الصنف' : 'Item updated');
      setShowEditItemDialog(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'خطأ في تحديث الصنف' : 'Error updating item'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedItem) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('menu_items').delete().eq('id', selectedItem.id);
      if (error) throw error;
      toast.success(isRTL ? 'تم حذف الصنف' : 'Item deleted');
      setShowDeleteItemDialog(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'خطأ في حذف الصنف' : 'Error deleting item'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      const { error } = await supabase
        .from('menu_items')
        .update({ is_available: !item.isAvailable })
        .eq('id', item.id);
      if (error) throw error;
      toast.success(isRTL ? 'تم تحديث توفر الصنف' : 'Item availability updated');
      fetchData();
    } catch (err: any) {
      toast.error(isRTL ? 'خطأ في تحديث الصنف' : 'Error updating item');
    }
  };

  const openEditItemDialog = (item: MenuItem) => {
    setSelectedItem(item);
    setItemForm({
      name: item.name,
      description: item.description || '',
      price: String(item.price),
      categoryId: item.categoryId,
      isAvailable: item.isAvailable,
    });
    setShowEditItemDialog(true);
  };

  const openEditCategoryDialog = (category: Category) => {
    setSelectedCategory(category);
    setCategoryForm({ name: category.name });
    setShowEditCategoryDialog(true);
  };

  const filteredItems = activeCategory === 'all' 
    ? menuItems 
    : menuItems.filter(item => item.categoryId === activeCategory);

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }

  if (!cafeteriaId) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">{isRTL ? 'خطأ في الصلاحيات' : 'Permission Error'}</h1>
        <p className="text-slate-600 max-w-md">
          {isRTL 
            ? 'لم يتم العثور على معرف الكافيتيريا الخاص بحسابك. يرجى التواصل مع الإدارة لتحديث بيانات حسابك.' 
            : 'No cafeteria ID found for your account. Please contact administration to update your account details.'}
        </p>
        <Button onClick={() => window.location.href = '/'} className="mt-6 bg-blue-600 text-white">
          {isRTL ? 'العودة للرئيسية' : 'Back to Home'}
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
      <DashboardHeader 
        title={isRTL ? 'إدارة المنيو' : 'Menu Management'} 
        onMenuClick={() => setMenuOpen(true)} 
        showBackButton={true}
        showHomeButton={true}
      />
      <DashboardNavigation isOpen={menuOpen} onClose={() => setMenuOpen(false)} items={navigationItems} />

      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{isRTL ? 'قائمة الطعام' : 'Food Menu'}</h1>
            <p className="text-slate-500">{isRTL ? 'إدارة الأصناف والفئات والأسعار' : 'Manage items, categories and prices'}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowAddCategoryDialog(true)} variant="outline" className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> {isRTL ? 'إضافة فئة' : 'Add Category'}
            </Button>
            <Button onClick={() => setShowAddItemDialog(true)} className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
              <Plus className="w-4 h-4" /> {isRTL ? 'إضافة صنف' : 'Add Item'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Categories Sidebar */}
          <Card className="lg:col-span-1 h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Tag className="w-5 h-5 text-blue-600" /> {isRTL ? 'الفئات' : 'Categories'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setActiveCategory('all')}
                  className={`w-full text-start px-4 py-2 rounded-md transition-colors ${activeCategory === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-slate-100 text-slate-600'}`}
                >
                  {isRTL ? 'الكل' : 'All Items'}
                </button>
                {categories.map(cat => (
                  <div key={cat.id} className="group flex items-center justify-between px-1">
                    <button
                      onClick={() => setActiveCategory(cat.id)}
                      className={`flex-1 text-start px-3 py-2 rounded-md transition-colors ${activeCategory === cat.id ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-slate-100 text-slate-600'}`}
                    >
                      {cat.name}
                    </button>
                    <div className="hidden group-hover:flex items-center gap-1">
                      <button onClick={() => openEditCategoryDialog(cat)} className="p-1 text-slate-400 hover:text-blue-600"><Edit className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { setSelectedCategory(cat); setShowDeleteCategoryDialog(true); }} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
                {categories.length === 0 && !loading && (
                  <p className="text-xs text-center py-4 text-slate-400">{isRTL ? 'لا توجد فئات' : 'No categories found'}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Items List */}
          <div className="lg:col-span-3 space-y-4">
            {loading ? (
              <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>
            ) : filteredItems.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredItems.map(item => (
                  <Card key={item.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardContent className="p-0">
                      <div className="p-4 flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-slate-900">{item.name}</h3>
                            {!item.isAvailable && (
                              <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase font-bold">
                                {isRTL ? 'غير متوفر' : 'Unavailable'}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 line-clamp-2 mb-2">{item.description || (isRTL ? 'لا يوجد وصف' : 'No description')}</p>
                          <div className="flex items-center gap-4">
                            <span className="text-blue-600 font-bold flex items-center gap-0.5">
                              {item.price.toFixed(2)} <span className="text-xs font-normal text-slate-400">USD</span>
                            </span>
                            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                              {item.categoryName || isRTL ? 'فئة عامة' : 'General'}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button 
                            onClick={() => handleToggleAvailability(item)}
                            className={`p-2 rounded-full transition-colors ${item.isAvailable ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                            title={item.isAvailable ? (isRTL ? 'إيقاف التوفر' : 'Make unavailable') : (isRTL ? 'تفعيل التوفر' : 'Make available')}
                          >
                            {item.isAvailable ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                          <button 
                            onClick={() => openEditItemDialog(item)}
                            className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => { setSelectedItem(item); setShowDeleteItemDialog(true); }}
                            className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <UtensilsCrossed className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900">{isRTL ? 'لا توجد أصناف' : 'No items found'}</h3>
                <p className="text-slate-500 mb-6">{isRTL ? 'ابدأ بإضافة أصناف جديدة لقائمة الطعام' : 'Start by adding new items to your menu'}</p>
                <Button onClick={() => setShowAddItemDialog(true)} className="bg-blue-600 text-white">
                  <Plus className="w-4 h-4 mr-2" /> {isRTL ? 'إضافة أول صنف' : 'Add First Item'}
                </Button>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Add Category Dialog */}
      <Dialog open={showAddCategoryDialog} onOpenChange={setShowAddCategoryDialog}>
        <DialogContent className="max-w-sm" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader><DialogTitle>{isRTL ? 'إضافة فئة جديدة' : 'Add New Category'}</DialogTitle></DialogHeader>
          <div className="py-2">
            <Label>{isRTL ? 'اسم الفئة *' : 'Category Name *'}</Label>
            <Input 
              value={categoryForm.name} 
              onChange={e => setCategoryForm({ name: e.target.value })} 
              className="mt-1" 
              placeholder={isRTL ? 'مثال: مشروبات باردة' : 'e.g. Cold Drinks'}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddCategoryDialog(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleAddCategory} disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              {submitting ? '...' : (isRTL ? 'إضافة' : 'Add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={showEditCategoryDialog} onOpenChange={setShowEditCategoryDialog}>
        <DialogContent className="max-w-sm" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader><DialogTitle>{isRTL ? 'تعديل الفئة' : 'Edit Category'}</DialogTitle></DialogHeader>
          <div className="py-2">
            <Label>{isRTL ? 'اسم الفئة *' : 'Category Name *'}</Label>
            <Input value={categoryForm.name} onChange={e => setCategoryForm({ name: e.target.value })} className="mt-1" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowEditCategoryDialog(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleEditCategory} disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              {submitting ? '...' : (isRTL ? 'حفظ' : 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader><DialogTitle>{isRTL ? 'إضافة صنف جديد' : 'Add New Item'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{isRTL ? 'اسم الصنف *' : 'Item Name *'}</Label>
              <Input value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>{isRTL ? 'الفئة *' : 'Category *'}</Label>
              <Select value={itemForm.categoryId} onValueChange={v => setItemForm({ ...itemForm, categoryId: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={isRTL ? 'اختر فئة' : 'Select category'} /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {categories.length === 0 && (
                <p className="text-[10px] text-red-500 mt-1">{isRTL ? 'يجب إضافة فئة أولاً' : 'Add a category first'}</p>
              )}
            </div>
            <div>
              <Label>{isRTL ? 'السعر *' : 'Price *'}</Label>
              <Input type="number" step="0.01" value={itemForm.price} onChange={e => setItemForm({ ...itemForm, price: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>{isRTL ? 'الوصف' : 'Description'}</Label>
              <Textarea value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e.target.value })} className="mt-1" rows={2} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={itemForm.isAvailable} onCheckedChange={v => setItemForm({ ...itemForm, isAvailable: v })} />
              <Label>{isRTL ? 'متاح للطلب' : 'Available for order'}</Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddItemDialog(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleAddItem} disabled={submitting || categories.length === 0} className="bg-blue-600 hover:bg-blue-700 text-white">
              {submitting ? '...' : (isRTL ? 'إضافة' : 'Add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={showEditItemDialog} onOpenChange={setShowEditItemDialog}>
        <DialogContent className="max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader><DialogTitle>{isRTL ? 'تعديل الصنف' : 'Edit Item'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{isRTL ? 'اسم الصنف *' : 'Item Name *'}</Label>
              <Input value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>{isRTL ? 'الفئة *' : 'Category *'}</Label>
              <Select value={itemForm.categoryId} onValueChange={v => setItemForm({ ...itemForm, categoryId: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{isRTL ? 'السعر *' : 'Price *'}</Label>
              <Input type="number" step="0.01" value={itemForm.price} onChange={e => setItemForm({ ...itemForm, price: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>{isRTL ? 'الوصف' : 'Description'}</Label>
              <Textarea value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e.target.value })} className="mt-1" rows={2} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={itemForm.isAvailable} onCheckedChange={v => setItemForm({ ...itemForm, isAvailable: v })} />
              <Label>{isRTL ? 'متاح للطلب' : 'Available for order'}</Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowEditItemDialog(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleEditItem} disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              {submitting ? '...' : (isRTL ? 'حفظ' : 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Category */}
      <AlertDialog open={showDeleteCategoryDialog} onOpenChange={setShowDeleteCategoryDialog}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRTL ? 'حذف الفئة' : 'Delete Category'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL ? `سيتم حذف الفئة "${selectedCategory?.name}" وجميع أصنافها.` : `Delete category "${selectedCategory?.name}" and all its items?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory} className="bg-red-600 hover:bg-red-700">{isRTL ? 'حذف' : 'Delete'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Item */}
      <AlertDialog open={showDeleteItemDialog} onOpenChange={setShowDeleteItemDialog}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRTL ? 'حذف الصنف' : 'Delete Item'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL ? `هل تريد حذف "${selectedItem?.name}"؟` : `Delete "${selectedItem?.name}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem} className="bg-red-600 hover:bg-red-700">{isRTL ? 'حذف' : 'Delete'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
