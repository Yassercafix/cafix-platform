import React, { useState, useEffect } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTranslation } from '@/locales/useTranslation';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { 
  Settings, Shield, Bell, Globe, Database, Save, 
  LogOut, Languages, CreditCard, LayoutDashboard, Users, Store, Coins, BarChart3,
  ArrowLeft, Home, Clock
} from 'lucide-react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DashboardNavigation } from '@/components/DashboardNavigation';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

export default function OwnerSettings() {
  const { user, logout } = useAuth({ redirectOnUnauthenticated: true });
  const { language, setLanguage } = useTranslation();
  const [, setLocation] = useLocation();
  const isRTL = language === 'ar';
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [freeMonths, setFreeMonths] = useState(0);

  // Queries
  const { data: instructionsData, isLoading: loadingInstructions } = trpc.system.getPaymentInstructions.useQuery();
  const { data: freeMonthsData, isLoading: loadingFreeMonths } = trpc.system.getGlobalFreeMonths.useQuery();

  // Mutations
  const setInstructionsMutation = trpc.system.setPaymentInstructions.useMutation({
    onSuccess: () => toast.success(isRTL ? 'تم حفظ تعليمات الدفع' : 'Payment instructions saved'),
    onError: (err) => toast.error(err.message)
  });

  const setFreeMonthsMutation = trpc.system.setGlobalFreeMonths.useMutation({
    onSuccess: () => toast.success(isRTL ? 'تم حفظ إعدادات الفترة المجانية' : 'Free period settings saved'),
    onError: (err) => toast.error(err.message)
  });

  useEffect(() => {
    if (instructionsData) setPaymentInstructions(instructionsData.instructions);
    if (freeMonthsData) setFreeMonths(freeMonthsData.months);
  }, [instructionsData, freeMonthsData]);

  const navigationItems = [
    { label: isRTL ? 'لوحة التحكم' : 'Dashboard', path: '/dashboard/owner', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: isRTL ? 'المسوقين' : 'Marketers', path: '/dashboard/owner/marketers', icon: <Users className="w-5 h-5" /> },
    { label: isRTL ? 'الكافيتريات' : 'Cafeterias', path: '/dashboard/owner/cafeterias', icon: <Store className="w-5 h-5" /> },
    { label: isRTL ? 'حاسبة النقاط' : 'Calculator', path: '/dashboard/owner/calculator', icon: <Coins className="w-5 h-5" /> },
    { label: isRTL ? 'التقارير' : 'Reports', path: '/dashboard/owner/reports', icon: <BarChart3 className="w-5 h-5" /> },
    { label: isRTL ? 'الإعدادات' : 'Settings', path: '/dashboard/owner/settings', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <div className={`min-h-screen bg-slate-50 pb-20 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <DashboardHeader 
        title={isRTL ? 'إعدادات النظام' : 'System Settings'} 
        onMenuClick={() => setMenuOpen(true)} 
        showBackButton={true}
        showHomeButton={true}
      />
      <DashboardNavigation isOpen={menuOpen} onClose={() => setMenuOpen(false)} items={navigationItems} />

      <main className="p-4 max-w-4xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-3 md:grid-cols-5 w-full bg-white shadow-sm border border-slate-200 h-auto p-1 rounded-xl">
            <TabsTrigger value="general" className="rounded-lg py-2.5 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600">
              <Settings className="w-4 h-4 mr-2" />
              <span className="hidden md:inline">{isRTL ? 'عام' : 'General'}</span>
            </TabsTrigger>
            <TabsTrigger value="payment" className="rounded-lg py-2.5 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600">
              <CreditCard className="w-4 h-4 mr-2" />
              <span className="hidden md:inline">{isRTL ? 'الدفع' : 'Payment'}</span>
            </TabsTrigger>
            <TabsTrigger value="free" className="rounded-lg py-2.5 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600">
              <Clock className="w-4 h-4 mr-2" />
              <span className="hidden md:inline">{isRTL ? 'الفترة المجانية' : 'Free Period'}</span>
            </TabsTrigger>
            <TabsTrigger value="language" className="rounded-lg py-2.5 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600">
              <Languages className="w-4 h-4 mr-2" />
              <span className="hidden md:inline">{isRTL ? 'اللغة' : 'Language'}</span>
            </TabsTrigger>
            <TabsTrigger value="account" className="rounded-lg py-2.5 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600">
              <Shield className="w-4 h-4 mr-2" />
              <span className="hidden md:inline">{isRTL ? 'الحساب' : 'Account'}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card className="border-0 shadow-xl bg-white">
              <CardHeader>
                <CardTitle>{isRTL ? 'الإعدادات العامة' : 'General Settings'}</CardTitle>
                <CardDescription>{isRTL ? 'تخصيص معلومات النظام الأساسية' : 'Basic system information'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{isRTL ? 'اسم الشركة' : 'Company Name'}</Label>
                  <Input defaultValue="Cafeteria V2 System" />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? 'البريد الإلكتروني للدعم' : 'Support Email'}</Label>
                  <Input defaultValue="support@cafeteria.com" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payment">
            <Card className="border-0 shadow-xl bg-white">
              <CardHeader>
                <CardTitle>{isRTL ? 'تعليمات الدفع' : 'Payment Instructions'}</CardTitle>
                <CardDescription>{isRTL ? 'هذه التعليمات ستظهر للكافيتريات عند طلب الشحن' : 'These instructions will be shown to cafeterias when requesting recharge'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{isRTL ? 'نص التعليمات' : 'Instruction Text'}</Label>
                  <Textarea 
                    placeholder={isRTL ? 'أدخل تفاصيل الحسابات البنكية أو طرق الدفع المتاحة...' : 'Enter bank account details or available payment methods...'}
                    className="min-h-[200px]"
                    value={paymentInstructions}
                    onChange={(e) => setPaymentInstructions(e.target.value)}
                  />
                </div>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700" 
                  onClick={() => setInstructionsMutation.mutate({ instructions: paymentInstructions })}
                  disabled={setInstructionsMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isRTL ? 'حفظ التعليمات' : 'Save Instructions'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="free">
            <Card className="border-0 shadow-xl bg-white">
              <CardHeader>
                <CardTitle>{isRTL ? 'الفترة المجانية العالمية' : 'Global Free Period'}</CardTitle>
                <CardDescription>{isRTL ? 'عدد الأشهر المجانية للكافيتريات الجديدة عند التسجيل' : 'Number of free months for new cafeterias upon registration'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{isRTL ? 'عدد الأشهر' : 'Number of Months'}</Label>
                  <Input 
                    type="number" 
                    value={freeMonths} 
                    onChange={(e) => setFreeMonths(parseInt(e.target.value) || 0)} 
                  />
                </div>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => setFreeMonthsMutation.mutate({ months: freeMonths })}
                  disabled={setFreeMonthsMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isRTL ? 'حفظ الإعدادات' : 'Save Settings'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="language">
            <Card className="border-0 shadow-xl bg-white">
              <CardHeader>
                <CardTitle>{isRTL ? 'إعدادات اللغة' : 'Language Settings'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Button 
                    variant={language === 'ar' ? 'default' : 'outline'} 
                    onClick={() => setLanguage('ar')}
                    className="flex-1"
                  >
                    العربية
                  </Button>
                  <Button 
                    variant={language === 'en' ? 'default' : 'outline'} 
                    onClick={() => setLanguage('en')}
                    className="flex-1"
                  >
                    English
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account">
            <Card className="border-0 shadow-xl bg-white border-red-100">
              <CardHeader>
                <CardTitle className="text-red-600">{isRTL ? 'إدارة الحساب' : 'Account Management'}</CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" className="w-full" onClick={() => logout()}>
                  <LogOut className="w-4 h-4 mr-2" />
                  {isRTL ? 'تسجيل الخروج' : 'Logout'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
