import React, { useState, useEffect } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTranslation } from '@/locales/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  LayoutDashboard, Store, Users, Wallet, BarChart3, Settings,
  Activity, ShieldCheck, Plus, ChevronRight,
  AlertCircle, CheckCircle2, Coins
} from 'lucide-react';
import { Link } from 'wouter';
import { supabase } from '@/lib/supabaseClient';
import { trpc } from '@/lib/trpc';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DashboardNavigation } from '@/components/DashboardNavigation';
import { AddMarketerDialog } from '@/components/AddMarketerDialog';

export default function OwnerDashboard() {
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const { language } = useTranslation();
  const isRTL = language === 'ar';

  const [stats, setStats] = useState({
    totalCafeterias: 0,
    totalMarketers: 0,
    freePeriodCafeterias: 0,
    totalPointsRecharged: 0,
    totalCommissionsPaid: 0
  });
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcData, setCalcData] = useState({ points: 100, country: 'SA' });
  const [showFABMenu, setShowFABMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAddMarketerDialog, setShowAddMarketerDialog] = useState(false);

  // Fetch owner report data using tRPC
  const { data: reportData, isLoading: reportLoading } = trpc.reports.getOwnerReport.useQuery(
    {},
    { enabled: !!user && user.role === 'owner' }
  );

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const { count: freePeriodCount } = await supabase
          .from('cafeterias')
          .select('*', { count: 'exact', head: true })
          .not('freeOperationEndDate', 'is', null)
          .gt('freeOperationEndDate', new Date().toISOString());
        
        setStats(prev => ({
          ...prev,
          freePeriodCafeterias: freePeriodCount || 0,
        }));
      } catch (err) {
        console.error('Error fetching free period stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  // Sync tRPC report data to stats state
  useEffect(() => {
    if (reportData) {
      setStats(prev => ({
        ...prev,
        totalCafeterias: reportData.totalCafeterias,
        totalMarketers: reportData.totalMarketers,
        totalPointsRecharged: reportData.totalRecharges,
        totalCommissionsPaid: reportData.totalCommissionsDistributed
      }));
    }
  }, [reportData]);

  const navigationItems = [
    { label: isRTL ? 'لوحة التحكم' : 'Dashboard', path: '/dashboard/owner', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: isRTL ? 'المسوقين' : 'Marketers', path: '/dashboard/owner/marketers', icon: <Users className="w-5 h-5" /> },
    { label: isRTL ? 'الكافيتريات' : 'Cafeterias', path: '/dashboard/owner/cafeterias', icon: <Store className="w-5 h-5" /> },
    { label: isRTL ? 'حاسبة النقاط' : 'Calculator', path: '/dashboard/owner/calculator', icon: <Coins className="w-5 h-5" /> },
    { label: isRTL ? 'التقارير' : 'Reports', path: '/dashboard/owner/reports', icon: <BarChart3 className="w-5 h-5" /> },
    { label: isRTL ? 'الإعدادات' : 'Settings', path: '/dashboard/owner/settings', icon: <Settings className="w-5 h-5" /> },
  ];

  const menuItems = [
    { 
      label: isRTL ? 'إدارة الكافيتريات' : 'Cafeterias', 
      path: '/dashboard/owner/cafeterias', 
      icon: <Store className="w-6 h-6" />, 
      color: 'bg-blue-500',
      description: isRTL ? 'إضافة وتعديل بيانات الكافيتريات' : 'Manage cafeteria data'
    },
    { 
      label: isRTL ? 'إدارة المسوقين' : 'Marketers', 
      path: '/dashboard/owner/marketers', 
      icon: <Users className="w-6 h-6" />, 
      color: 'bg-purple-500',
      description: isRTL ? 'متابعة أداء المسوقين والعمولات' : 'Track marketer performance'
    },
    { 
      label: isRTL ? 'إدارة النقاط' : 'Points', 
      path: '/dashboard/owner/points', 
      icon: <Wallet className="w-6 h-6" />, 
      color: 'bg-green-500',
      description: isRTL ? 'شحن وخصم نقاط الكافيتريات' : 'Recharge and deduct points'
    },
    { 
      label: isRTL ? 'التقارير العامة' : 'Reports', 
      path: '/dashboard/owner/reports', 
      icon: <BarChart3 className="w-6 h-6" />, 
      color: 'bg-orange-500',
      description: isRTL ? 'إحصائيات النظام الشاملة' : 'Global system analytics'
    },
    { 
      label: isRTL ? 'إعدادات النظام' : 'Settings', 
      path: '/dashboard/owner/settings', 
      icon: <Settings className="w-6 h-6" />, 
      color: 'bg-slate-500',
      description: isRTL ? 'تخصيص إعدادات المنصة' : 'Platform customization'
    }
  ];

  if (authLoading) return null;

  return (
    <div className={`min-h-screen bg-slate-50 pb-20 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <DashboardHeader 
        title={isRTL ? 'لوحة تحكم المالك' : 'System Owner Panel'} 
        onMenuClick={() => setMenuOpen(true)} 
        showBackButton={false}
        showHomeButton={false}
      />
      <DashboardNavigation isOpen={menuOpen} onClose={() => setMenuOpen(false)} items={navigationItems} />

      <AddMarketerDialog 
        open={showAddMarketerDialog} 
        onOpenChange={setShowAddMarketerDialog} 
        isOwner={true}
        onSuccess={() => {
          // Optionally refresh stats
        }}
      />

      <header className="bg-gradient-to-br from-slate-900 to-slate-800 text-white px-6 py-10 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12">
          <ShieldCheck className="w-64 h-64" />
        </div>
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md">
                <LayoutDashboard className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight">
                  {isRTL ? 'مرحباً بك' : 'Welcome Back'}
                </h1>
                <p className="text-slate-400 font-medium">
                  {isRTL ? 'مركز إدارة النظام الشامل' : 'Global management center'}
                </p>
              </div>
            </div>
            
            <Button 
              onClick={() => setShowAddMarketerDialog(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white border-0 shadow-lg h-12 px-6 rounded-xl font-bold flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="w-5 h-5" />
              {isRTL ? 'إضافة مسوق جديد' : 'Add New Marketer'}
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-8">
            <Card className="bg-white/5 border-white/10 backdrop-blur-md text-white border-0 shadow-none">
              <CardContent className="p-4">
                <p className="text-xl font-bold">{stats.totalCafeterias}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">{isRTL ? 'الكافيتريات' : 'Cafeterias'}</p>
              </CardContent>
            </Card>
            <Card className="bg-white/5 border-white/10 backdrop-blur-md text-white border-0 shadow-none">
              <CardContent className="p-4">
                <p className="text-xl font-bold">{stats.totalMarketers}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">{isRTL ? 'المسوقين' : 'Marketers'}</p>
              </CardContent>
            </Card>
            <Card className="bg-white/5 border-white/10 backdrop-blur-md text-white border-0 shadow-none">
              <CardContent className="p-4">
                <p className="text-xl font-bold">{stats.freePeriodCafeterias}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">{isRTL ? 'فترة مجانية' : 'Free'}</p>
              </CardContent>
            </Card>
            <Card className="bg-white/5 border-white/10 backdrop-blur-md text-white border-0 shadow-none">
              <CardContent className="p-4">
                <p className="text-xl font-bold">{stats.totalPointsRecharged}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">{isRTL ? 'النقاط' : 'Points'}</p>
              </CardContent>
            </Card>
            <Card className="bg-white/5 border-white/10 backdrop-blur-md text-white border-0 shadow-none">
              <CardContent className="p-4">
                <p className="text-xl font-bold">{stats.totalCommissionsPaid.toFixed(0)}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">{isRTL ? 'العمولات' : 'Comms'}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 -mt-8 relative z-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {menuItems.map((item, index) => (
            <Link key={index} href={item.path}>
              <Card className="hover:shadow-2xl transition-all duration-300 cursor-pointer border-0 group overflow-hidden bg-white">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className={`${item.color} p-4 rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      {item.icon}
                    </div>
                    <ChevronRight className={`w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors ${isRTL ? 'rotate-180' : ''}`} />
                  </div>
                  <div className="mt-6">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{item.label}</h3>
                    <p className="text-sm text-slate-500 font-medium">{item.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border-0 shadow-xl bg-white overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" />
                {isRTL ? 'الكافيتريات بفترة مجانية' : 'Cafeterias with Free Period'}
              </CardTitle>
              <Badge className="bg-blue-100 text-blue-600 border-0">{stats.freePeriodCafeterias}</Badge>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-sm text-slate-600">
                {isRTL 
                  ? 'عدد الكافيتريات التي تتمتع بفترة تشغيل مجانية حالياً'
                  : 'Number of cafeterias currently enjoying free operation period'
                }
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl bg-white overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Wallet className="w-5 h-5 text-green-500" />
                {isRTL ? 'حاسبة النقاط' : 'Points Calculator'}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowCalculator(!showCalculator)}>
                {showCalculator ? (isRTL ? 'إغلاق' : 'Close') : (isRTL ? 'فتح' : 'Open')}
              </Button>
            </CardHeader>
            <CardContent className="p-4">
              {showCalculator ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">{isRTL ? 'النقاط' : 'Points'}</Label>
                      <Input type="number" value={calcData.points} onChange={(e) => setCalcData({...calcData, points: Number(e.target.value)})} />
                    </div>
                    <div>
                      <Label className="text-xs">{isRTL ? 'البلد' : 'Country'}</Label>
                      <select className="w-full p-2 border rounded-md text-sm" value={calcData.country} onChange={(e) => setCalcData({...calcData, country: e.target.value})}>
                        <option value="SA">Saudi Arabia (SAR)</option>
                        <option value="EG">Egypt (EGP)</option>
                        <option value="AE">UAE (AED)</option>
                      </select>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg text-center">
                    <p className="text-xs text-slate-500">{isRTL ? 'القيمة المقدرة' : 'Estimated Value'}</p>
                    <p className="text-xl font-black text-slate-900">
                      {calcData.country === 'SA' ? (calcData.points * 0.1).toFixed(2) + ' SAR' : 
                       calcData.country === 'EG' ? (calcData.points * 1.5).toFixed(2) + ' EGP' : 
                       (calcData.points * 0.1).toFixed(2) + ' AED'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-600">{isRTL ? 'استخدم الحاسبة لتقدير قيمة النقاط بالعملات المحلية' : 'Use the calculator to estimate points value in local currencies'}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>


    </div>
  );
}
