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
import {
  Settings, LayoutDashboard, UtensilsCrossed, Table2, Users, BarChart3, CreditCard,
  Store, Globe, Percent, Shield, Save, MapPin, Phone, Hash, AlertCircle, Clock, LogOut, DollarSign, Loader2, Check
} from 'lucide-react';
import { trpcVanilla as trpc } from '@/lib/trpcVanilla';
import { toast } from 'sonner';

interface CafeteriaInfo {
  id: string;
  name: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  currency: string;
  country: string;
  taxRate: number;
  serviceCharge: number;
  referenceCode?: string;
  autoLogoutMinutes?: number;
}

const countries = [
  { code: 'EG', name: 'Egypt', arName: 'مصر', currency: 'EGP', phoneCode: '+20' },
  { code: 'SA', name: 'Saudi Arabia', arName: 'السعودية', currency: 'SAR', phoneCode: '+966' },
  { code: 'AE', name: 'UAE', arName: 'الإمارات', currency: 'AED', phoneCode: '+971' },
  { code: 'KW', name: 'Kuwait', arName: 'الكويت', currency: 'KWD', phoneCode: '+965' },
  { code: 'JO', name: 'Jordan', arName: 'الأردن', currency: 'JOD', phoneCode: '+962' },
];

// Strict English number validation
const isEnglishNumber = (value: string): boolean => {
  return /^[0-9]*\.?[0-9]*$/.test(value) && !/[٠-٩]/.test(value);
};

// Validate coordinates
const isValidLatitude = (lat: number): boolean => lat >= -90 && lat <= 90;
const isValidLongitude = (lon: number): boolean => lon >= -180 && lon <= 180;

export default function CafeteriaSettings() {
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const { language } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isRTL = language === 'ar';

  const [cafeteriaInfo, setCafeteriaInfo] = useState<CafeteriaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingTab, setSavingTab] = useState<string | null>(null);

  const [generalForm, setGeneralForm] = useState({
    name: '',
    phone: '',
    phoneCode: '+20',
  });

  const [locationForm, setLocationForm] = useState({
    latitude: '',
    longitude: '',
    latError: '',
    lonError: '',
  });

  const [billingForm, setBillingForm] = useState({
    currency: 'EGP',
    country: 'EG',
  });

  const [taxServiceForm, setTaxServiceForm] = useState({
    taxRate: '0',
    serviceCharge: '0',
    taxError: '',
    serviceError: '',
  });

  const [securityForm, setSecurityForm] = useState({
    autoLogoutMinutes: '120',
    autoLogoutError: '',
  });

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

  // Fetch cafeteria details
  const fetchCafeteriaInfo = useCallback(async () => {
    if (!cafeteriaId) return;
    setLoading(true);
    try {
      const result = await trpc.cafeterias.getCafeteriaDetails.query({
        cafeteriaId,
      });

      setCafeteriaInfo(result as any);
      
      // Update forms with fetched data
      setGeneralForm({
        name: result.name || '',
        phone: result.phone || '',
        phoneCode: '+20',
      });

      setLocationForm({
        latitude: result.latitude ? String(result.latitude) : '',
        longitude: result.longitude ? String(result.longitude) : '',
        latError: '',
        lonError: '',
      });

      setBillingForm({
        currency: result.currency || 'EGP',
        country: result.country || 'EG',
      });

      setTaxServiceForm({
        taxRate: result.taxRate ? String(result.taxRate) : '0',
        serviceCharge: result.serviceCharge ? String(result.serviceCharge) : '0',
        taxError: '',
        serviceError: '',
      });

      setSecurityForm({
        autoLogoutMinutes: result.autoLogoutMinutes ? String(result.autoLogoutMinutes) : '120',
        autoLogoutError: '',
      });
    } catch (err: any) {
      console.error('Error fetching cafeteria info:', err);
      toast.error(isRTL ? 'خطأ في تحميل البيانات' : 'Error loading data');
    } finally {
      setLoading(false);
    }
  }, [cafeteriaId, isRTL]);

  useEffect(() => {
    if (!authLoading && cafeteriaId) {
      fetchCafeteriaInfo();
    }
  }, [cafeteriaId, authLoading, fetchCafeteriaInfo]);

  // Save general settings
  const saveGeneralSettings = async () => {
    if (!cafeteriaId || !generalForm.name) {
      toast.error(isRTL ? 'يرجى ملء الحقول المطلوبة' : 'Please fill required fields');
      return;
    }

    setSavingTab('general');
    try {
      const result = await trpc.cafeterias.updateSettings.mutate({
        cafeteriaId,
        name: generalForm.name,
        phone: generalForm.phone || undefined,
      });

      setCafeteriaInfo(result as any);
      toast.success(isRTL ? 'تم حفظ الإعدادات' : 'Settings saved');
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'خطأ في الحفظ' : 'Error saving'));
    } finally {
      setSavingTab(null);
    }
  };

  // Save location settings
  const saveLocationSettings = async () => {
    let hasError = false;
    const newErrors = { latError: '', lonError: '' };

    if (locationForm.latitude) {
      const lat = parseFloat(locationForm.latitude);
      if (!isEnglishNumber(locationForm.latitude) || isNaN(lat) || !isValidLatitude(lat)) {
        newErrors.latError = isRTL ? 'خط العرض يجب أن يكون بين -90 و 90' : 'Latitude must be between -90 and 90';
        hasError = true;
      }
    }

    if (locationForm.longitude) {
      const lon = parseFloat(locationForm.longitude);
      if (!isEnglishNumber(locationForm.longitude) || isNaN(lon) || !isValidLongitude(lon)) {
        newErrors.lonError = isRTL ? 'خط الطول يجب أن يكون بين -180 و 180' : 'Longitude must be between -180 and 180';
        hasError = true;
      }
    }

    setLocationForm(prev => ({ ...prev, ...newErrors }));

    if (hasError) {
      toast.error(isRTL ? 'يرجى التحقق من الإحداثيات' : 'Please check coordinates');
      return;
    }

    setSavingTab('location');
    try {
      const result = await trpc.cafeterias.updateSettings.mutate({
        cafeteriaId,
        latitude: locationForm.latitude ? parseFloat(locationForm.latitude) : undefined,
        longitude: locationForm.longitude ? parseFloat(locationForm.longitude) : undefined,
      });

      setCafeteriaInfo(result as any);
      toast.success(isRTL ? 'تم حفظ الموقع' : 'Location saved');
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'خطأ في الحفظ' : 'Error saving'));
    } finally {
      setSavingTab(null);
    }
  };

  // Save tax and service settings
  const saveTaxServiceSettings = async () => {
    let hasError = false;
    const newErrors = { taxError: '', serviceError: '' };

    const taxRate = parseFloat(taxServiceForm.taxRate);
    if (!isEnglishNumber(taxServiceForm.taxRate) || isNaN(taxRate) || taxRate < 0 || taxRate > 1) {
      newErrors.taxError = isRTL ? 'معدل الضريبة يجب أن يكون بين 0 و 1' : 'Tax rate must be between 0 and 1';
      hasError = true;
    }

    const serviceCharge = parseFloat(taxServiceForm.serviceCharge);
    if (!isEnglishNumber(taxServiceForm.serviceCharge) || isNaN(serviceCharge) || serviceCharge < 0 || serviceCharge > 1) {
      newErrors.serviceError = isRTL ? 'رسوم الخدمة يجب أن تكون بين 0 و 1' : 'Service charge must be between 0 and 1';
      hasError = true;
    }

    setTaxServiceForm(prev => ({ ...prev, ...newErrors }));

    if (hasError) {
      toast.error(isRTL ? 'يرجى التحقق من القيم' : 'Please check values');
      return;
    }

    setSavingTab('taxservice');
    try {
      const result = await trpc.cafeterias.updateSettings.mutate({
        cafeteriaId,
        taxRate: taxRate,
        serviceCharge: serviceCharge,
      });

      setCafeteriaInfo(result as any);
      toast.success(isRTL ? 'تم حفظ الإعدادات' : 'Settings saved');
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'خطأ في الحفظ' : 'Error saving'));
    } finally {
      setSavingTab(null);
    }
  };

  // Save security settings
  const saveSecuritySettings = async () => {
    let hasError = false;
    const newErrors = { autoLogoutError: '' };

    const minutes = parseInt(securityForm.autoLogoutMinutes);
    if (!isEnglishNumber(securityForm.autoLogoutMinutes) || isNaN(minutes) || minutes < 1) {
      newErrors.autoLogoutError = isRTL ? 'يجب أن تكون القيمة أكبر من 0' : 'Value must be greater than 0';
      hasError = true;
    }

    setSecurityForm(prev => ({ ...prev, ...newErrors }));

    if (hasError) {
      toast.error(isRTL ? 'يرجى التحقق من القيم' : 'Please check values');
      return;
    }

    setSavingTab('security');
    try {
      const result = await trpc.cafeterias.updateSettings.mutate({
        cafeteriaId,
        autoLogoutMinutes: minutes,
      });

      setCafeteriaInfo(result as any);
      toast.success(isRTL ? 'تم حفظ الإعدادات' : 'Settings saved');
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'خطأ في الحفظ' : 'Error saving'));
    } finally {
      setSavingTab(null);
    }
  };

  // Calculate tax and service for preview
  const calculatePreview = () => {
    const baseAmount = 100;
    const tax = baseAmount * parseFloat(taxServiceForm.taxRate || '0');
    const service = baseAmount * parseFloat(taxServiceForm.serviceCharge || '0');
    return {
      base: baseAmount,
      tax: tax.toFixed(2),
      service: service.toFixed(2),
      total: (baseAmount + tax + service).toFixed(2),
    };
  };

  if (authLoading || loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }

  const preview = calculatePreview();

  return (
    <div className={`min-h-screen bg-gray-50 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <DashboardHeader showBackButton={true} showHomeButton={true} title={isRTL ? 'إعدادات الكافيتريا' : 'Cafeteria Settings'} onMenuClick={() => setMenuOpen(true)} />
      <DashboardNavigation isOpen={menuOpen} onClose={() => setMenuOpen(false)} items={navigationItems} />

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <Card className="mb-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white border-0 shadow-lg">
          <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Store className="w-12 h-12" />
              <div>
                <h1 className="text-2xl font-bold">{cafeteriaInfo?.name || 'Cafeteria'}</h1>
                <p className="text-blue-100">{isRTL ? 'رمز المرجع' : 'Reference Code'}: {cafeteriaInfo?.referenceCode || 'N/A'}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-100">{isRTL ? 'الحالة' : 'Status'}</p>
              <p className="text-lg font-semibold">{isRTL ? 'نشط' : 'Active'}</p>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-white border shadow-sm">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Store className="w-4 h-4" />
              <span className="hidden sm:inline">{isRTL ? 'عام' : 'General'}</span>
            </TabsTrigger>
            <TabsTrigger value="location" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span className="hidden sm:inline">{isRTL ? 'الموقع' : 'Location'}</span>
            </TabsTrigger>
            <TabsTrigger value="billing" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">{isRTL ? 'الفواتير' : 'Billing'}</span>
            </TabsTrigger>
            <TabsTrigger value="taxservice" className="flex items-center gap-2">
              <Percent className="w-4 h-4" />
              <span className="hidden sm:inline">{isRTL ? 'الضرائب' : 'Taxes'}</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">{isRTL ? 'الأمان' : 'Security'}</span>
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>{isRTL ? 'معلومات عامة' : 'General Information'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-gray-700">{isRTL ? 'اسم الكافيتريا *' : 'Cafeteria Name *'}</Label>
                  <Input
                    value={generalForm.name}
                    onChange={(e) => setGeneralForm({ ...generalForm, name: e.target.value })}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label className="text-gray-700">{isRTL ? 'رقم الهاتف' : 'Phone Number'}</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={generalForm.phoneCode}
                      disabled
                      className="w-20"
                    />
                    <Input
                      value={generalForm.phone}
                      onChange={(e) => setGeneralForm({ ...generalForm, phone: e.target.value })}
                      placeholder={isRTL ? 'أدخل رقم الهاتف' : 'Enter phone number'}
                    />
                  </div>
                </div>

                <Button
                  onClick={saveGeneralSettings}
                  disabled={savingTab === 'general'}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                >
                  {savingTab === 'general' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isRTL ? 'حفظ' : 'Save'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Location Tab */}
          <TabsContent value="location">
            <Card>
              <CardHeader>
                <CardTitle>{isRTL ? 'الموقع' : 'Location'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-700">
                    {isRTL 
                      ? 'استخدم خدمات الخرائط للحصول على إحداثيات GPS دقيقة. مثال: خط العرض 30.0444، خط الطول 31.2357'
                      : 'Use map services to get accurate GPS coordinates. Example: Latitude 30.0444, Longitude 31.2357'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-700">{isRTL ? 'خط العرض' : 'Latitude'}</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="-90 to 90"
                      value={locationForm.latitude}
                      onChange={(e) => setLocationForm({ ...locationForm, latitude: e.target.value, latError: '' })}
                      className={`mt-2 ${locationForm.latError ? 'border-red-500' : ''}`}
                    />
                    {locationForm.latError && <p className="text-red-500 text-sm mt-1">{locationForm.latError}</p>}
                  </div>

                  <div>
                    <Label className="text-gray-700">{isRTL ? 'خط الطول' : 'Longitude'}</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="-180 to 180"
                      value={locationForm.longitude}
                      onChange={(e) => setLocationForm({ ...locationForm, longitude: e.target.value, lonError: '' })}
                      className={`mt-2 ${locationForm.lonError ? 'border-red-500' : ''}`}
                    />
                    {locationForm.lonError && <p className="text-red-500 text-sm mt-1">{locationForm.lonError}</p>}
                  </div>
                </div>

                <Button
                  onClick={saveLocationSettings}
                  disabled={savingTab === 'location'}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                >
                  {savingTab === 'location' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isRTL ? 'حفظ' : 'Save'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing">
            <Card>
              <CardHeader>
                <CardTitle>{isRTL ? 'معلومات الفواتير' : 'Billing Information'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-gray-700">{isRTL ? 'الدولة' : 'Country'}</Label>
                  <Input
                    value={countries.find(c => c.code === billingForm.country)?.name || 'N/A'}
                    disabled
                    className="mt-2 bg-gray-100"
                  />
                </div>

                <div>
                  <Label className="text-gray-700">{isRTL ? 'العملة' : 'Currency'}</Label>
                  <Input
                    value={billingForm.currency}
                    disabled
                    className="mt-2 bg-gray-100"
                  />
                </div>

                <p className="text-sm text-gray-600">{isRTL ? 'هذه الحقول محدثة تلقائياً بناءً على بيانات حسابك' : 'These fields are auto-updated based on your account'}</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tax & Service Tab */}
          <TabsContent value="taxservice">
            <Card>
              <CardHeader>
                <CardTitle>{isRTL ? 'الضرائب والرسوم' : 'Taxes & Service Charges'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-gray-700">{isRTL ? 'معدل الضريبة' : 'Tax Rate'}</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={taxServiceForm.taxRate}
                        onChange={(e) => setTaxServiceForm({ ...taxServiceForm, taxRate: e.target.value, taxError: '' })}
                        className={taxServiceForm.taxError ? 'border-red-500' : ''}
                      />
                      <span className="flex items-center text-gray-600">%</span>
                    </div>
                    {taxServiceForm.taxError && <p className="text-red-500 text-sm mt-1">{taxServiceForm.taxError}</p>}
                  </div>

                  <div>
                    <Label className="text-gray-700">{isRTL ? 'رسوم الخدمة' : 'Service Charge'}</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={taxServiceForm.serviceCharge}
                        onChange={(e) => setTaxServiceForm({ ...taxServiceForm, serviceCharge: e.target.value, serviceError: '' })}
                        className={taxServiceForm.serviceError ? 'border-red-500' : ''}
                      />
                      <span className="flex items-center text-gray-600">%</span>
                    </div>
                    {taxServiceForm.serviceError && <p className="text-red-500 text-sm mt-1">{taxServiceForm.serviceError}</p>}
                  </div>
                </div>

                {/* Preview */}
                <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-4">{isRTL ? 'معاينة الحساب' : 'Calculation Preview'}</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{isRTL ? 'المبلغ الأساسي' : 'Base Amount'}:</span>
                      <span className="font-medium">{preview.base}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{isRTL ? 'الضريبة' : 'Tax'} ({(parseFloat(taxServiceForm.taxRate || '0') * 100).toFixed(2)}%):</span>
                      <span className="font-medium text-blue-600">+{preview.tax}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{isRTL ? 'رسوم الخدمة' : 'Service'} ({(parseFloat(taxServiceForm.serviceCharge || '0') * 100).toFixed(2)}%):</span>
                      <span className="font-medium text-blue-600">+{preview.service}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between">
                      <span className="font-semibold text-gray-800">{isRTL ? 'الإجمالي' : 'Total'}:</span>
                      <span className="font-bold text-green-600">{preview.total}</span>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={saveTaxServiceSettings}
                  disabled={savingTab === 'taxservice'}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                >
                  {savingTab === 'taxservice' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isRTL ? 'حفظ' : 'Save'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>{isRTL ? 'إعدادات الأمان' : 'Security Settings'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-700">
                    {isRTL 
                      ? 'سيتم تسجيل الخروج التلقائي للمستخدمين بعد فترة عدم النشاط المحددة'
                      : 'Users will be automatically logged out after the specified inactivity period'}
                  </p>
                </div>

                <div>
                  <Label className="text-gray-700">{isRTL ? 'مدة تسجيل الخروج التلقائي (دقائق)' : 'Auto-logout Duration (minutes)'}</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="120"
                    value={securityForm.autoLogoutMinutes}
                    onChange={(e) => setSecurityForm({ ...securityForm, autoLogoutMinutes: e.target.value, autoLogoutError: '' })}
                    className={`mt-2 ${securityForm.autoLogoutError ? 'border-red-500' : ''}`}
                  />
                  {securityForm.autoLogoutError && <p className="text-red-500 text-sm mt-1">{securityForm.autoLogoutError}</p>}
                </div>

                <Button
                  onClick={saveSecuritySettings}
                  disabled={savingTab === 'security'}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                >
                  {savingTab === 'security' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isRTL ? 'حفظ' : 'Save'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
