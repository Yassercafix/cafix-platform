import React, { useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTranslation } from '@/locales/useTranslation';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DashboardNavigation } from '@/components/DashboardNavigation';
import { Card, CardContent } from '@/components/ui/card';
import { Wallet, LayoutDashboard, Users, BarChart3 } from 'lucide-react';

export default function MarketerCommissions() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const { language } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isRTL = language === 'ar';

  const navigationItems = [
    { label: isRTL ? 'لوحة التحكم' : 'Dashboard', path: '/dashboard/marketer', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: isRTL ? 'أبنائي' : 'My Downlines', path: '/dashboard/marketer/downlines', icon: <Users className="w-5 h-5" /> },
    { label: isRTL ? 'عمولاتي' : 'My Commissions', path: '/dashboard/marketer/commissions', icon: <Wallet className="w-5 h-5" /> },
    { label: isRTL ? 'التقارير' : 'Reports', path: '/dashboard/marketer/reports', icon: <BarChart3 className="w-5 h-5" /> },
  ];

  return (
    <div className={`min-h-screen bg-gray-50 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <DashboardHeader showBackButton={true} showHomeButton={true} title={isRTL ? 'عمولاتي' : 'My Commissions'} icon={<Wallet className="w-5 h-5" />} onMenuToggle={setMenuOpen} menuOpen={menuOpen} />
      <div className="flex">
        <DashboardNavigation items={navigationItems} open={menuOpen} onClose={() => setMenuOpen(false)} />
        <main className="flex-1 p-4 md:p-8">
          <Card className="text-center py-12">
            <p className="text-gray-500">{isRTL ? 'قيد التطوير' : 'Coming Soon'}</p>
          </Card>
        </main>
      </div>
    </div>
  );
}
