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
  const [itemForm, setItemForm] = useState({ name: '', description: '', price: '', categoryId: '', isAvailable: true });

  // Use cafeteriaId from user metadata
  const cafeteriaId = user?.cafeteriaId;

  // tRPC Queries
  const categoriesQuery = trpc.menu.getCategories.useQuery(
    { cafeteriaId: cafeteriaId || '' },
    { enabled: !!cafeteriaId }
  );

  const itemsQuery = trpc.menu.getMenuItems.useQuery(
    { cafeteriaId: cafeteriaId || '' },
    { enabled: !!cafeteriaId }
  );

  // tRPC Mutations
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
      setItemForm({ name: '', description: '', price: '', categoryId: '', isAvailable: true });
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

  const categories = (categoriesQuery.data || []).map(c => ({
    id: c.id,
    name: c.name,
    displayOrder: c.displayOrder,
    cafeteriaId: c.cafeteriaId
  }));

  const menuItems = (itemsQuery.data || []).map(i => ({
    id: i.id,
    name: i.name,
    description: i.description,
    price: i.price,
    categoryId: i.categoryId,
    categoryName: categories.find(c => c.id === i.categoryId)?.name,
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
    : menuItems.filter(i => i.categoryId === activeCategory);

  if (authLoading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
      <DashboardHeader showBackButton={true} showHomeButton={true} title={isRTL ? 'إدارة المنيو' : 'Menu Management'} onMenuClick={() => setMenuOpen(true)} />
      <DashboardNavigation isOpen={menuOpen} onClose={() => setMenuOpen(false)} items={navigationItems} />

      <main className="container mx-auto px-4 py-6 max-w-6xl">
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
          <div className="flex items-center justify-between mb-4 overflow-x-auto pb-2">
            <TabsList className="bg-white border">
              <TabsTrigger value="all">{isRTL ? 'الكل' : 'All'}</TabsTrigger>
              {categories.map(cat => (
                <TabsTrigger key={cat.id} value={cat.id} className="gap-2">
                  {cat.name}
                  <div className="flex gap-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Edit className="w-3 h-3 cursor-pointer" onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCategory(cat);
                      setCategoryForm({ name: cat.name });
                      setShowEditCategoryDialog(true);
                    }} />
                  </div>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value={activeCategory} className="mt-0">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={isRTL ? 'text-right' : ''}>{isRTL ? 'الصنف' : 'Item'}</TableHead>
                      <TableHead className={isRTL ? 'text-right' : ''}>{isRTL ? 'الفئة' : 'Category'}</TableHead>
                      <TableHead className={isRTL ? 'text-right' : ''}>{isRTL ? 'السعر' : 'Price'}</TableHead>
                      <TableHead className={isRTL ? 'text-right' : ''}>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                      <TableHead className={isRTL ? 'text-left' : 'text-right'}>{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8">{isRTL ? 'جاري التحميل...' : 'Loading...'}</TableCell></TableRow>
                    ) : filteredItems.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">{isRTL ? 'لا توجد أصناف' : 'No items found'}</TableCell></TableRow>
                    ) : (
                      filteredItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-medium">{item.name}</div>
                            {item.description && <div className="text-xs text-slate-500 truncate max-w-[200px]">{item.description}</div>}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-xs font-medium text-slate-600">
                              {item.categoryName || (isRTL ? 'بدون فئة' : 'No category')}
                            </span>
                          </TableCell>
                          <TableCell className="font-bold text-blue-600">{item.price}</TableCell>
                          <TableCell>
                            {item.isAvailable ? (
                              <span className="inline-flex items-center gap-1 text-green-600 text-xs font-bold">
                                <Eye className="w-3 h-3" /> {isRTL ? 'متاح' : 'Available'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-slate-400 text-xs font-bold">
                                <EyeOff className="w-3 h-3" /> {isRTL ? 'غير متاح' : 'Unavailable'}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className={isRTL ? 'text-left' : 'text-right'}>
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon" onClick={() => {
                                setSelectedItem(item);
                                setItemForm({
                                  name: item.name,
                                  description: item.description || '',
                                  price: item.price.toString(),
                                  categoryId: item.categoryId,
                                  isAvailable: item.isAvailable
                                });
                                setShowEditItemDialog(true);
                              }}>
                                <Edit className="w-4 h-4 text-slate-500" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => {
                                setSelectedItem(item);
                                setShowDeleteItemDialog(true);
                              }}>
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
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
            <Button onClick={handleAddCategory} disabled={createCategoryMutation.isLoading} className="bg-blue-600 hover:bg-blue-700 text-white">
              {createCategoryMutation.isLoading ? '...' : (isRTL ? 'إضافة' : 'Add')}
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
              <Button onClick={handleEditCategory} disabled={updateCategoryMutation.isLoading} className="bg-blue-600 hover:bg-blue-700 text-white">
                {updateCategoryMutation.isLoading ? '...' : (isRTL ? 'حفظ' : 'Save')}
              </Button>
            </div>
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
              <Input value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e?.target?.value || '' })} className="mt-1" />
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
              <Input type="number" step="0.01" value={itemForm.price} onChange={e => setItemForm({ ...itemForm, price: e?.target?.value || '' })} className="mt-1" />
            </div>
            <div>
              <Label>{isRTL ? 'الوصف' : 'Description'}</Label>
              <Textarea value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e?.target?.value || '' })} className="mt-1" rows={2} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={itemForm.isAvailable} onCheckedChange={v => setItemForm({ ...itemForm, isAvailable: v })} />
              <Label>{isRTL ? 'متاح للطلب' : 'Available for order'}</Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddItemDialog(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleAddItem} disabled={createItemMutation.isLoading || categories.length === 0} className="bg-blue-600 hover:bg-blue-700 text-white">
              {createItemMutation.isLoading ? '...' : (isRTL ? 'إضافة' : 'Add')}
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
              <Input value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e?.target?.value || '' })} className="mt-1" />
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
              <Input type="number" step="0.01" value={itemForm.price} onChange={e => setItemForm({ ...itemForm, price: e?.target?.value || '' })} className="mt-1" />
            </div>
            <div>
              <Label>{isRTL ? 'الوصف' : 'Description'}</Label>
              <Textarea value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e?.target?.value || '' })} className="mt-1" rows={2} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={itemForm.isAvailable} onCheckedChange={v => setItemForm({ ...itemForm, isAvailable: v })} />
              <Label>{isRTL ? 'متاح للطلب' : 'Available for order'}</Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowEditItemDialog(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleEditItem} disabled={updateItemMutation.isLoading} className="bg-blue-600 hover:bg-blue-700 text-white">
              {updateItemMutation.isLoading ? '...' : (isRTL ? 'حفظ' : 'Save')}
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
