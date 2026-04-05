import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from '@/locales/useTranslation';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: number;
}

interface DashboardNavigationProps {
  items: NavItem[];
  open?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
}

export function DashboardNavigation({
  items,
  open,
  isOpen,
  onClose,
  className,
}: DashboardNavigationProps) {
  const [location, navigate] = useLocation();
  const { language } = useTranslation();
  const isRTL = language === 'ar';

  // Support both 'open' and 'isOpen' props for backward compatibility
  const menuIsOpen = isOpen !== undefined ? isOpen : open ?? false;

  const handleNavigate = (path: string) => {
    navigate(path);
    // Ensure onClose is called safely
    onClose?.();
  };

  // Close menu when clicking overlay
  const handleOverlayClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose?.();
  };

  // Close menu on Escape key
  useEffect(() => {
    if (!menuIsOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [menuIsOpen, onClose]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (menuIsOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [menuIsOpen]);

  // ROOT CAUSE FIX: Auto-close menu when location changes
  // This ensures the menu state is reset during navigation,
  // preventing invisible overlays from persisting after route changes
  useEffect(() => {
    onClose?.();
  }, [location, onClose]);

  return (
    <>
      {/* Sidebar for Desktop */}
      <aside
        className={cn(
          'hidden md:flex flex-col w-64 bg-white border-r border-gray-200 h-[calc(100vh-73px)] overflow-y-auto pointer-events-auto',
          className
        )}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <nav className="flex-1 px-4 py-6 space-y-2">
          {items.map((item) => (
            <button
              key={item.path}
              onClick={() => handleNavigate(item.path)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 text-left',
                location === item.path
                  ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-blue-600'
              )}
            >
              <span className="flex-shrink-0 w-6 h-6">{item.icon}</span>
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge && (
                <span className="flex-shrink-0 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* Mobile Sidebar - Only render when menu is open */}
      <div 
        className={cn(
          "fixed inset-0 z-30 md:hidden transition-opacity duration-300",
          menuIsOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Overlay - FIXED: Now properly closes when clicked */}
        <div
          className="absolute inset-0 bg-black/50"
          onClick={handleOverlayClick}
          role="presentation"
          aria-hidden="true"
        />

        {/* Mobile Menu */}
        <aside
          className={cn(
            'absolute top-0 h-screen w-64 bg-white z-40 overflow-y-auto transition-transform duration-300 transform',
            isRTL 
              ? `right-0 ${menuIsOpen ? 'translate-x-0' : 'translate-x-full'}` 
              : `left-0 ${menuIsOpen ? 'translate-x-0' : '-translate-x-full'}`
          )}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
            <nav className="px-4 py-6 space-y-2 mt-16">
              {items.map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleNavigate(item.path)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 text-left',
                    location === item.path
                      ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-blue-600'
                  )}
                >
                  <span className="flex-shrink-0 w-6 h-6">{item.icon}</span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge && (
                    <span className="flex-shrink-0 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </aside>
      </div>
    </>
  );
}
