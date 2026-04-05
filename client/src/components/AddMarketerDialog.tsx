import React, { useState } from 'react';
import { useTranslation } from '@/locales/useTranslation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, RefreshCw, Globe, Coins, Languages } from 'lucide-react';
import { trpcVanilla as trpc } from '@/lib/trpcVanilla';
import { toast } from 'sonner';

interface AddMarketerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  isOwner?: boolean;
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

export function AddMarketerDialog({ open, onOpenChange, onSuccess, isOwner = false }: AddMarketerDialogProps) {
  const { language } = useTranslation();
  const isRTL = language === 'ar';
  const [submitting, setSubmitting] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    country: "SA",
    currency: "SAR",
    language: "ar",
  });

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

  const handleCountryInputChange = (value: string) => {
    const selected = countries.find(c => (isRTL ? c.arName : c.name) === value);
    if (selected) {
      handleCountryChange(selected.code);
    }
  };

  const handleAddMarketer = async () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error(isRTL ? 'الاسم والبريد الإلكتروني مطلوبان' : 'Name and email are required');
      return;
    }

    if (formData.password.length < 8) {
      toast.error(isRTL ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' : 'Password must be at least 8 characters');
      return;
    }

    setSubmitting(true);
    try {
      if (isOwner) {
        // Owner creates a level 1 marketer directly
        await trpc.marketers.createLevel1Marketer.mutate({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          loginUsername: formData.email.trim().toLowerCase(),
          password: formData.password,
          country: formData.country,
          currency: formData.currency,
          language: formData.language,
        });
      } else {
        // For non-owner (child marketer), we need parent's reference code
        const me = await trpc.authSupabase.me.query();
        if (!me?.referenceCode) throw new Error(isRTL ? 'لم يتم العثور على الرمز المرجعي للمسوق الأب' : 'Parent reference code not found');

        await trpc.marketers.createChildMarketer.mutate({
          parentMarketerCode: me.referenceCode,
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          loginUsername: formData.email.trim().toLowerCase(),
          password: formData.password,
        });
      }

      toast.success(isRTL ? 'تم إضافة المسوق بنجاح' : 'Marketer added successfully');
      onOpenChange(false);
      setFormData({ name: '', email: '', password: '', country: 'SA', currency: 'SAR', language: 'ar' });
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Add marketer error:', err);
      const errorMsg = err?.data?.message || err?.message || (isRTL ? 'خطأ في إضافة المسوق' : 'Error adding marketer');
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCountries = countries.filter(c => 
    (isRTL ? c.arName : c.name).toLowerCase().includes(countrySearch.toLowerCase())
  );

  const currentCountryName = countries.find(c => c.code === formData.country)?.[isRTL ? 'arName' : 'name'] || '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-purple-600" />
            {isRTL ? 'إضافة مسوق جديد' : 'Add New Marketer'}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label>{isRTL ? 'الاسم الكامل *' : 'Full Name *'}</Label>
            <Input 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
              placeholder={isRTL ? 'اسم المسوق' : 'Marketer Name'} 
            />
          </div>
          <div className="space-y-2">
            <Label>{isRTL ? 'البريد الإلكتروني *' : 'Email *'}</Label>
            <Input 
              value={formData.email} 
              onChange={e => setFormData({...formData, email: e.target.value})} 
              placeholder="email@example.com" 
            />
          </div>
          <div className="space-y-2">
            <Label>{isRTL ? 'كلمة المرور * (8 أحرف على الأقل)' : 'Password * (at least 8 characters)'}</Label>
            <Input 
              type="password" 
              value={formData.password} 
              onChange={e => setFormData({...formData, password: e.target.value})} 
              placeholder="********" 
            />
          </div>

          {isOwner && (
            <>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Globe className="w-4 h-4" /> {isRTL ? 'البلد' : 'Country'}</Label>
                <div className="relative">
                  <input
                    type="text"
                    list="marketer-countries-list-dialog"
                    value={currentCountryName}
                    onChange={(e) => handleCountryInputChange(e.target.value)}
                    onInput={(e) => setCountrySearch(e.currentTarget.value)}
                    placeholder={isRTL ? 'ابدأ بكتابة اسم البلد...' : 'Start typing country name...'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    autoComplete="off"
                  />
                  <datalist id="marketer-countries-list-dialog">
                    {filteredCountries.map(c => (
                      <option key={c.code} value={isRTL ? c.arName : c.name} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Coins className="w-4 h-4" /> {isRTL ? 'العملة' : 'Currency'}</Label>
                <Input value={formData.currency} disabled className="bg-slate-50 font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Languages className="w-4 h-4" /> {isRTL ? 'اللغة' : 'Language'}</Label>
                <Input value={formData.language === 'ar' ? (isRTL ? 'العربية' : 'Arabic') : (isRTL ? 'الإنجليزية' : 'English')} disabled className="bg-slate-50" />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <Button onClick={handleAddMarketer} disabled={submitting} className="bg-purple-600 hover:bg-purple-700">
            {submitting ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
            {isRTL ? 'حفظ' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
