import React from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTranslation } from '@/locales/useTranslation';
import { LogOut, Menu, X, Hash, ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

interface DashboardHeaderProps {
  title: string;
  icon?: React.ReactNode;
  onMenuToggle?: (open: boolean) => void;
  menuOpen?: boolean;
  onMenuClick?: () => void;
  showBackButton?: boolean;
  showHomeButton?: boolean;
  backPath?: string;
}

export function DashboardHeader({
  title,
  icon,
  onMenuToggle,
  menuOpen = false,
  onMenuClick,
  showBackButton = false,
  showHomeButton = false,
  backPath,
}: DashboardHeaderProps) {
  const { user, logout } = useAuth();
  const { language, setLanguage } = useTranslation();
  const [, navigate] = useLocation();

  const isRTL = language === 'ar';
  const handleToggle = onMenuClick || (onMenuToggle ? () => onMenuToggle(!menuOpen) : undefined);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleGoBack = () => {
    if (backPath) {
      navigate(backPath);
    } else {
      window.history.back();
    }
  };

  const handleGoHome = () => {
    const rolePathMap: Record<string, string> = {
      owner: '/dashboard/owner',
      marketer: '/dashboard/marketer',
      cafeteria_admin: '/dashboard/cafeteria-admin',
      manager: '/dashboard/manager',
      waiter: '/dashboard/waiter',
      chef: '/dashboard/chef',
    };
    navigate(rolePathMap[user?.role || ''] || '/login');
  };

  return (
    <header
      className={`sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm ${
        isRTL ? 'rtl' : 'ltr'
      } w-full overflow-visible pointer-events-auto`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="px-4 py-3 md:py-4 flex items-center justify-between">
        {/* Left Section - Title & Menu */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {handleToggle && (
            <button
              onClick={handleToggle}
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            >
              {menuOpen ? (
                <X className="w-5 h-5 text-gray-700" />
              ) : (
                <Menu className="w-5 h-5 text-gray-700" />
              )}
            </button>
          )}

          {icon && (
            <div className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
              {icon}
            </div>
          )}

          <div className="flex flex-col min-w-0">
            <h1 className="text-base md:text-lg font-bold text-gray-800 truncate">
              {title}
            </h1>
            {user?.referenceCode && (
              <div className="flex items-center gap-1 text-[10px] md:text-xs font-mono text-blue-600 font-bold">
                <Hash className="w-3 h-3" />
                <span>{user.referenceCode}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Section - Controls */}
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          {/* Navigation Buttons */}
          <div className="flex items-center gap-1 border-r pr-2 mr-1 border-gray-200">
            {showBackButton && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleGoBack}
                className="h-8 w-8 md:h-9 md:w-9 text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                title={isRTL ? 'رجوع' : 'Back'}
              >
                <ArrowLeft className={`w-4 h-4 md:w-5 md:h-5 ${isRTL ? 'rotate-180' : ''}`} />
              </Button>
            )}
            {showHomeButton && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleGoHome}
                className="h-8 w-8 md:h-9 md:w-9 text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                title={isRTL ? 'الرئيسية' : 'Home'}
              >
                <Home className="w-4 h-4 md:w-5 md:h-5" />
              </Button>
            )}
          </div>

          {/* Language Selector */}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'ar' | 'en')}
            className="px-1.5 py-1 md:px-2 md:py-1.5 text-[10px] md:text-xs border border-gray-300 rounded-md bg-white cursor-pointer hover:border-blue-400 transition-colors font-bold"
          >
            <option value="en">EN</option>
            <option value="ar">AR</option>
          </select>

          {/* User Info (Desktop) */}
          <div className="hidden sm:flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
            <div className="flex flex-col items-end">
              <p className="text-[10px] md:text-xs font-bold text-gray-800 truncate max-w-[80px]">
                {user?.name || 'User'}
              </p>
              <p className="text-[9px] text-gray-500 capitalize">
                {user?.role?.replace('_', ' ') || 'Guest'}
              </p>
            </div>
            <div className="w-7 h-7 md:w-8 md:h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-sm">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
          </div>

          {/* Logout Button */}
          <Button
            onClick={handleLogout}
            variant="ghost"
            size="sm"
            className="h-8 w-8 md:h-10 md:w-10 p-0 text-red-500 hover:bg-red-50 hover:text-red-700 transition-all rounded-full border border-transparent hover:border-red-100"
            title={isRTL ? 'تسجيل الخروج' : 'Logout'}
          >
            <LogOut className="w-4 h-4 md:w-5 md:h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
