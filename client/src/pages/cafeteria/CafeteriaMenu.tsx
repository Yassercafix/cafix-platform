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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  UtensilsCrossed, LayoutDashboard, Table2, Users, BarChart3, CreditCard, Settings,
  Plus, Edit, Trash2, Tag, DollarSign, Eye, EyeOff, AlertCircle, Image as ImageIcon, X
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
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
  imageUrl?: string;
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
  const [itemForm, setItemForm] = useState({ 
    name: '', 
    description: '', 
    price: '', 
    categoryId: '', 
    imageUrl: '',
    isAvailable: true 
  });

  const cafeteriaId = user?.cafeteriaId;

  const categoriesQuery = trpc.menu.getCategories.useQuery(
    { cafeteriaId: cafeteriaId || '' },
    { enabled: !!cafeteriaId }
  );

  const itemsQuery = trpc.menu.getMenuItems.useQuery(
    { cafeteriaId: cafeteriaId || '' },
    { enabled: !!cafeteriaId }
  );

  const utils = trpc.useContext();
  const createCategoryMutation = trpc.menu.createCategory.useMutation({
    onSuccess: () => {
      utils.menu.getCategories.invalidate();
      toast.success(isRTL ? 'تم إضافة الفئة بنجاح' : 'Category added successfully');
      setShowAddCategoryDialog(false);
      setCategoryForm({ name: '' });
    },
    onError: (err) => {
      toast.error(err.message || (isRTL ? 'خطأ في إضافة الفئة' : 'Error adding category'));
    }
  });

  const updateCategoryMutation = trpc.menu.updateCategory.useMutation({
    onSuccess: () => {
      utils.menu.getCategories.invalidate();
      toast.success(isRTL ? 'تم تحديث الفئة' : 'Category updated');
      setShowEditCategoryDialog(false);
    },
    onError: (err) => {
      toast.error(err.message || (isRTL ? 'خطأ في تحديث الفئة' : 'Error updating category'));
    }
  });

  const deleteCategoryMutation = trpc.menu.deleteCategory.useMutation({
    onSuccess: () => {
      utils.menu.getCategories.invalidate();
      toast.success(isRTL ? 'تم حذف الفئة' : 'Category deleted');
      setShowDeleteCategoryDialog(false);
    },
    onError: (err) => {
      toast.error(err.message || (isRTL ? 'خطأ في حذف الفئة' : 'Error deleting category'));
    }
  });

  const createItemMutation = trpc.menu.createMenuItem.useMutation({
    onSuccess: () => {
      utils.menu.getMenuItems.invalidate();
      toast.success(isRTL ? 'تم إضافة الصنف بنجاح' : 'Item added successfully');
      setShowAddItemDialog(false);
      setItemForm({ name: '', description: '', price: '', categoryId: '', imageUrl: '', isAvailable: true });
    },
    onError: (err) => {
      toast.error(err.message || (isRTL ? 'خطأ في إضافة الصنف' : 'Error adding item'));
    }
  });

  const updateItemMutation = trpc.menu.updateMenuItem.useMutation({
    onSuccess: () => {
      utils.menu.getMenuItems.invalidate();
      toast.success(isRTL ? 'تم تحديث الصنف' : 'Item updated');
      setShowEditItemDialog(false);
    },
    onError: (err) => {
      toast.error(err.message || (isRTL ? 'خطأ في تحديث الصنف' : 'Error updating item'));
    }
  });

  const deleteItemMutation = trpc.menu.deleteMenuItem.useMutation({
    onSuccess: () => {
      utils.menu.getMenuItems.invalidate();
      toast.success(isRTL ? 'تم حذف الصنف' : 'Item deleted');
      setShowDeleteItemDialog(false);
    },
    onError: (err) => {
      toast.error(err.message || (isRTL ? 'خطأ في حذف الصنف' : 'Error deleting item'));
    }
  });

  const categories = (categoriesQuery.data || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    displayOrder: c.displayOrder,
    cafeteriaId: c.cafeteriaId
  }));

  const menuItems = (itemsQuery.data || []).map((i: any) => ({
    id: i.id,
    name: i.name,
    description: i.description,
    price: i.price,
    imageUrl: i.imageUrl,
    categoryId: i.categoryId,
    categoryName: categories.find((c: any) => c.id === i.categoryId)?.name,
    isAvailable: i.available,
    cafeteriaId: cafeteriaId || ''
  }));

  const loading = categoriesQuery.isLoading || itemsQuery.isLoading;

  const navigationItems = [
    { label: isRTL ? 'لوحة التحكم' : 'Dashboard', path: '/dashboard/cafeteria-admin', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: isRTL ? 'المنيو' : 'Menu', path: '/dashboard/cafeteria-admin/menu', icon: <UtensilsCrossed className="w-5 h-5" /> },
    { label: isRTL ? 'الطاولات' : 'Tables', path: '/dashboard/cafeteria-admin/tables', icon: <Table2 className="w-5 h-5" /> },
    { label: isRTL ? 'الموظفين' : 'Staff', path: '/dashboard/cafeteria-admin/staff', icon: <Users className="w-5 h-5" /> },
    { label: isRTL ? 'التقارير' : 'Reports', path: '/dashboard/cafeteria-admin/reports', icon: <BarChart3 className="w-5 h-5" /> },
    { label: isRTL ? 'شحن النقاط' : 'Recharge', path: '/dashboard/cafeteria-admin/recharge', icon: <CreditCard className="w-5 h-5" /> },
    { label: isRTL ? 'الإعدادات' : 'Settings', path: '/dashboard/cafeteria-admin/settings', icon: <Settings className="w-5 h-5" /> },
  ];

  const handleAddCategory = async () => {
    if (!cafeteriaId) {
      toast.error(isRTL ? 'معرف الكافيتيريا مفقود' : 'Cafeteria ID is missing');
      return;
    }
    if (!categoryForm.name.trim()) {
      toast.error(isRTL ? 'أدخل اسم الفئة' : 'Enter category name');
      return;
    }
    createCategoryMutation.mutate({
      cafeteriaId,
      name: categoryForm.name.trim(),
    });
  };

  const handleEditCategory = async () => {
    if (!selectedCategory || !categoryForm.name.trim()) return;
    updateCategoryMutation.mutate({
      categoryId: selectedCategory.id,
      name: categoryForm.name.trim(),
    });
  };

  const handleDeleteCategory = async () => {
    if (!selectedCategory) return;
    deleteCategoryMutation.mutate({
      categoryId: selectedCategory.id,
    });
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
    createItemMutation.mutate({
      cafeteriaId,
      categoryId: itemForm.categoryId,
      name: itemForm.name.trim(),
      description: itemForm.description || undefined,
      price: parseFloat(itemForm.price),
      imageUrl: itemForm.imageUrl || undefined,
    });
  };

  const handleEditItem = async () => {
    if (!selectedItem) return;
    updateItemMutation.mutate({
      itemId: selectedItem.id,
      name: itemForm.name.trim(),
      description: itemForm.description || undefined,
      price: parseFloat(itemForm.price),
      categoryId: itemForm.categoryId,
      imageUrl: itemForm.imageUrl || undefined,
      available: itemForm.isAvailable,
    });
  };

  const handleDeleteItem = async () => {
    if (!selectedItem) return;
    deleteItemMutation.mutate({
      itemId: selectedItem.id,
    });
  };

  const filteredItems = activeCategory === 'all' 
    ? menuItems 
    : menuItems.filter((i: any) => i.categoryId === activeCategory);

  if (authLoading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
      <DashboardHeader showBackButton={true} showHomeButton={true} title={isRTL ? 'إدارة المنيو' : 'Menu Management'} onMenuClick={() => setMenuOpen(true)} />
      <DashboardNavigation isOpen={menuOpen} onClose={() => setMenuOpen(false)} items={navigationItems} />

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900">{isRTL ? 'قائمة الطعام' : 'Menu Items'}</h1>
            <p className="text-slate-500">{isRTL ? 'إدارة الفئات والأصناف المتاحة للطلب' : 'Manage categories and items available for order'}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowAddCategoryDialog(true)} variant="outline" className="gap-2">
              <Tag className="w-4 h-4" />
              {isRTL ? 'إضافة فئة' : 'Add Category'}
            </Button>
            <Button onClick={() => setShowAddItemDialog(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
              <Plus className="w-4 h-4" />
              {isRTL ? 'إضافة صنف' : 'Add Item'}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="all" value={activeCategory} onValueChange={setActiveCategory} className="w-full">
          <div className="flex items-center justify-between mb-6 overflow-x-auto pb-2">
            <TabsList className="bg-white border">
              <TabsTrigger value="all">{isRTL ? 'الكل' : 'All'}</TabsTrigger>
              {categories.map((cat: any) => (
                <TabsTrigger key={cat.id} value={cat.id} className="gap-2">
                  {cat.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value={activeCategory} className="mt-0">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-slate-500">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <Card className="text-center py-12">
                <UtensilsCrossed className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">{isRTL ? 'لا توجد أصناف' : 'No items found'}</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map((item: any) => (
                  <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    {/* Item Image */}
                    <div className="relative aspect-video bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden">
                      {item.imageUrl ? (
                        <img 
                          src={item.imageUrl} 
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-slate-400" />
                        </div>
                      )}
                      {!item.isAvailable && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="text-white font-bold text-sm">{isRTL ? 'غير متاح' : 'Unavailable'}</span>
                        </div>
                      )}
                    </div>

                    {/* Item Details */}
                    <CardContent className="p-4">
                      <div className="mb-3">
                        <h3 className="font-bold text-slate-900 text-base line-clamp-2">{item.name}</h3>
                        {item.description && (
                          <p className="text-xs text-slate-500 line-clamp-2 mt-1">{item.description}</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between mb-4">
                        <div className="flex flex-col">
                          <span className="text-2xl font-black text-blue-600">{item.price.toFixed(2)}</span>
                          <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-xs font-medium text-slate-600 mt-1 w-fit">
                            {item.categoryName || (isRTL ? 'بدون فئة' : 'No category')}
                          </span>
                        </div>
                        <div className="text-right">
                          {item.isAvailable ? (
                            <span className="inline-flex items-center gap-1 text-green-600 text-xs font-bold">
                              <Eye className="w-3 h-3" /> {isRTL ? 'متاح' : 'Available'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-400 text-xs font-bold">
                              <EyeOff className="w-3 h-3" /> {isRTL ? 'غير متاح' : 'Unavailable'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => {
                            setSelectedItem(item);
                            setItemForm({
                              name: item.name,
                              description: item.description || '',
                              price: item.price.toString(),
                              categoryId: item.categoryId,
                              imageUrl: item.imageUrl || '',
                              isAvailable: item.isAvailable
                            });
                            setShowEditItemDialog(true);
                          }}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          {isRTL ? 'تعديل' : 'Edit'}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => {
                            setSelectedItem(item);
                            setShowDeleteItemDialog(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Add Category Dialog */}
      <Dialog open={showAddCategoryDialog} onOpenChange={setShowAddCategoryDialog}>
        <DialogContent className="max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader><DialogTitle>{isRTL ? 'إضافة فئة جديدة' : 'Add New Category'}</DialogTitle></DialogHeader>
          <div className="py-4">
            <Label>{isRTL ? 'اسم الفئة' : 'Category Name'}</Label>
            <Input value={categoryForm.name} onChange={e => setCategoryForm({ name: e?.target?.value || '' })} className="mt-1" placeholder={isRTL ? 'مثال: المشروبات' : 'e.g. Drinks'} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddCategoryDialog(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleAddCategory} disabled={createCategoryMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
              {createCategoryMutation.isPending ? '...' : (isRTL ? 'إضافة' : 'Add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={showEditCategoryDialog} onOpenChange={setShowEditCategoryDialog}>
        <DialogContent className="max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader><DialogTitle>{isRTL ? 'تعديل الفئة' : 'Edit Category'}</DialogTitle></DialogHeader>
          <div className="py-4">
            <Label>{isRTL ? 'اسم الفئة' : 'Category Name'}</Label>
            <Input value={categoryForm.name} onChange={e => setCategoryForm({ name: e?.target?.value || '' })} className="mt-1" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteCategoryDialog(true)} className="text-red-600 border-red-200 hover:bg-red-50">
              {isRTL ? 'حذف' : 'Delete'}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowEditCategoryDialog(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
              <Button onClick={handleEditCategory} disabled={updateCategoryMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
                {updateCategoryMutation.isPending ? '...' : (isRTL ? 'حفظ' : 'Save')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog with Live Preview */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="max-w-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader><DialogTitle>{isRTL ? 'إضافة صنف جديد' : 'Add New Item'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            {/* Form */}
            <div className="space-y-4">
              <div>
                <Label>{isRTL ? 'اسم الصنف *' : 'Item Name *'}</Label>
                <Input value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e?.target?.value || '' })} className="mt-1" />
              </div>
              <div>
                <Label>{isRTL ? 'الفئة *' : 'Category *'}</Label>
                <Select value={itemForm.categoryId} onValueChange={v => setItemForm({ ...itemForm, categoryId: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={isRTL ? 'اختر فئة' : 'Select category'} /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {categories.length === 0 && (
                  <p className="text-[10px] text-red-500 mt-1">{isRTL ? 'يجب إضافة فئة أولاً' : 'Add a category first'}</p>
                )}
              </div>
              <div>
                <Label>{isRTL ? 'السعر *' : 'Price *'}</Label>
                <Input type="number" step="0.01" value={itemForm.price} onChange={e => setItemForm({ ...itemForm, price: e?.target?.value || '' })} className="mt-1" />
              </div>
              <div>
                <Label>{isRTL ? 'الوصف' : 'Description'}</Label>
                <Textarea value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e?.target?.value || '' })} className="mt-1" rows={2} />
              </div>
              <div>
                <Label>{isRTL ? 'رابط الصورة' : 'Image URL'}</Label>
                <Input value={itemForm.imageUrl} onChange={e => setItemForm({ ...itemForm, imageUrl: e?.target?.value || '' })} className="mt-1" placeholder="https://example.com/image.jpg" />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={itemForm.isAvailable} onCheckedChange={v => setItemForm({ ...itemForm, isAvailable: v })} />
                <Label>{isRTL ? 'متاح للطلب' : 'Available for order'}</Label>
              </div>
            </div>

            {/* Live Preview */}
            <div className="border rounded-lg p-4 bg-slate-50">
              <p className="text-xs font-bold text-slate-500 mb-3 uppercase">{isRTL ? 'معاينة مباشرة' : 'Live Preview'}</p>
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                {/* Preview Image */}
                <div className="relative aspect-square bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden">
                  {itemForm.imageUrl ? (
                    <img 
                      src={itemForm.imageUrl} 
                      alt="preview"
                      className="w-full h-full object-cover"
                      onError={() => {}}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-12 h-12 text-slate-300" />
                    </div>
                  )}
                </div>

                {/* Preview Details */}
                <div className="p-3">
                  <h4 className="font-bold text-slate-900 text-sm line-clamp-2 mb-1">
                    {itemForm.name || (isRTL ? 'اسم الصنف' : 'Item Name')}
                  </h4>
                  {itemForm.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-2">{itemForm.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-black text-blue-600">
                      {itemForm.price ? `${parseFloat(itemForm.price).toFixed(2)} ج.م` : '0.00 ج.م'}
                    </span>
                    <div className="w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center">
                      <Plus className="w-5 h-5 text-orange-600" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddItemDialog(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleAddItem} disabled={createItemMutation.isPending || categories.length === 0} className="bg-blue-600 hover:bg-blue-700 text-white">
              {createItemMutation.isPending ? '...' : (isRTL ? 'إضافة' : 'Add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog with Live Preview */}
      <Dialog open={showEditItemDialog} onOpenChange={setShowEditItemDialog}>
        <DialogContent className="max-w-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader><DialogTitle>{isRTL ? 'تعديل الصنف' : 'Edit Item'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            {/* Form */}
            <div className="space-y-4">
              <div>
                <Label>{isRTL ? 'اسم الصنف *' : 'Item Name *'}</Label>
                <Input value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e?.target?.value || '' })} className="mt-1" />
              </div>
              <div>
                <Label>{isRTL ? 'الفئة *' : 'Category *'}</Label>
                <Select value={itemForm.categoryId} onValueChange={v => setItemForm({ ...itemForm, categoryId: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={isRTL ? 'اختر فئة' : 'Select category'} /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{isRTL ? 'السعر *' : 'Price *'}</Label>
                <Input type="number" step="0.01" value={itemForm.price} onChange={e => setItemForm({ ...itemForm, price: e?.target?.value || '' })} className="mt-1" />
              </div>
              <div>
                <Label>{isRTL ? 'الوصف' : 'Description'}</Label>
                <Textarea value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e?.target?.value || '' })} className="mt-1" rows={2} />
              </div>
              <div>
                <Label>{isRTL ? 'رابط الصورة' : 'Image URL'}</Label>
                <Input value={itemForm.imageUrl} onChange={e => setItemForm({ ...itemForm, imageUrl: e?.target?.value || '' })} className="mt-1" placeholder="https://example.com/image.jpg" />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={itemForm.isAvailable} onCheckedChange={v => setItemForm({ ...itemForm, isAvailable: v })} />
                <Label>{isRTL ? 'متاح للطلب' : 'Available for order'}</Label>
              </div>
            </div>

            {/* Live Preview */}
            <div className="border rounded-lg p-4 bg-slate-50">
              <p className="text-xs font-bold text-slate-500 mb-3 uppercase">{isRTL ? 'معاينة مباشرة' : 'Live Preview'}</p>
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                {/* Preview Image */}
                <div className="relative aspect-square bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden">
                  {itemForm.imageUrl ? (
                    <img 
                      src={itemForm.imageUrl} 
                      alt="preview"
                      className="w-full h-full object-cover"
                      onError={() => {}}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-12 h-12 text-slate-300" />
                    </div>
                  )}
                </div>

                {/* Preview Details */}
                <div className="p-3">
                  <h4 className="font-bold text-slate-900 text-sm line-clamp-2 mb-1">
                    {itemForm.name || (isRTL ? 'اسم الصنف' : 'Item Name')}
                  </h4>
                  {itemForm.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-2">{itemForm.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-black text-blue-600">
                      {itemForm.price ? `${parseFloat(itemForm.price).toFixed(2)} ج.م` : '0.00 ج.م'}
                    </span>
                    <div className="w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center">
                      <Plus className="w-5 h-5 text-orange-600" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteItemDialog(true)} className="text-red-600 border-red-200 hover:bg-red-50">
              {isRTL ? 'حذف' : 'Delete'}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowEditItemDialog(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
              <Button onClick={handleEditItem} disabled={updateItemMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
                {updateItemMutation.isPending ? '...' : (isRTL ? 'حفظ' : 'Save')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Item Alert */}
      <AlertDialog open={showDeleteItemDialog} onOpenChange={setShowDeleteItemDialog}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRTL ? 'حذف الصنف' : 'Delete Item'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL ? 'هل أنت متأكد من حذف هذا الصنف؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this item? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem} className="bg-red-600 hover:bg-red-700">
              {isRTL ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Category Alert */}
      <AlertDialog open={showDeleteCategoryDialog} onOpenChange={setShowDeleteCategoryDialog}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRTL ? 'حذف الفئة' : 'Delete Category'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL ? 'هل أنت متأكد من حذف هذه الفئة؟ سيتم حذف جميع الأصناف المرتبطة بها.' : 'Are you sure you want to delete this category? All items in this category will be deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory} className="bg-red-600 hover:bg-red-700">
              {isRTL ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
