import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/locales/useTranslation";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import React from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, user } = useAuth();
  const { language } = useTranslation();

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full bg-white rounded-2xl shadow-xl">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-bold tracking-tight text-center text-gray-900">
              {language === 'ar' ? 'يرجى تسجيل الدخول للمتابعة' : 'Sign in to continue'}
            </h1>
            <p className="text-sm text-gray-500 text-center max-w-sm">
              {language === 'ar' 
                ? 'الوصول إلى لوحة التحكم يتطلب المصادقة. يرجى تسجيل الدخول.' 
                : 'Access to this dashboard requires authentication. Please sign in.'}
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = "/login";
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all bg-blue-600 hover:bg-blue-700 text-white"
          >
            {language === 'ar' ? 'تسجيل الدخول' : 'Sign in'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`min-h-screen w-full bg-[#F5F1E9] ${language === 'ar' ? 'rtl' : 'ltr'}`} 
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        /* REMOVE ALL SIDEBAR ELEMENTS AND OVERLAYS GLOBALLY */
        [data-sidebar], [data-sidebar-overlay], .sidebar-container, 
        aside, [class*="fixed"][class*="inset-0"][class*="z-50"], 
        [class*="absolute"][class*="inset-0"][class*="z-50"],
        .fixed.inset-0, .absolute.inset-0 {
          display: none !important;
          visibility: hidden !important;
          pointer-events: none !important;
          width: 0 !important;
          height: 0 !important;
          opacity: 0 !important;
          z-index: -1 !important;
        }
        
        /* Ensure main content takes full width and is ALWAYS touchable */
        body, #root, main, .flex-1, #root > div {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          pointer-events: auto !important;
          position: relative !important;
          z-index: 1 !important;
          display: block !important;
        }

        /* Fix for touch events on all interactive elements */
        button, a, input, select, textarea, [role="button"], .cursor-pointer {
          pointer-events: auto !important;
          cursor: pointer !important;
          position: relative !important;
          z-index: 100 !important;
        }
      `}} />
      <div className="w-full min-h-screen relative z-10">
        {children}
      </div>
    </div>
  );
}
