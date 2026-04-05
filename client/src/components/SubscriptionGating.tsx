import React from "react";
import { Lock, Zap, TrendingUp, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePlanCheck } from "@/hooks/usePlanCheck";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// UpgradeModal
// ---------------------------------------------------------------------------

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  reason?: string;
}

/**
 * UpgradeModal
 *
 * Displays a modal prompting the user to upgrade their subscription plan.
 */
export function UpgradeModal({ open, onClose, reason }: UpgradeModalProps) {
  const [, setLocation] = useLocation();

  if (!open) return null;

  const handleUpgrade = () => {
    setLocation("/upgrade");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <Card className="w-full max-w-md border-none shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="h-2 bg-gradient-to-r from-blue-600 to-purple-600" />
        <CardContent className="pt-10 pb-8 text-center space-y-8">
          <div className="mx-auto w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center shadow-inner relative">
            <Lock className="w-10 h-10 text-blue-600" />
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
              <Zap className="w-3 h-3 text-white fill-white" />
            </div>
          </div>
          
          <div className="space-y-3 px-4">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Upgrade Required</h2>
            <p className="text-slate-500 font-medium text-sm leading-relaxed">
              {reason ||
                "This powerful feature is reserved for our Growth and Pro members. Upgrade now to scale your operations."}
            </p>
          </div>

          <div className="flex flex-col gap-3 px-4">
            <Button
              onClick={handleUpgrade}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest shadow-xl shadow-blue-200 transition-all hover:scale-[1.02]"
            >
              Unlock Full Access
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              onClick={onClose} 
              className="w-full h-10 text-slate-400 font-bold uppercase tracking-widest text-[10px] hover:text-slate-600 transition-colors"
            >
              Maybe Later
            </Button>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-6 opacity-40">
            <TrendingUp className="w-5 h-5 text-slate-400" />
            <ShieldCheck className="w-5 h-5 text-slate-400" />
            <Zap className="w-5 h-5 text-slate-400" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FeatureGate
// ---------------------------------------------------------------------------

interface FeatureGateProps {
  /** The feature key to check against the plan limits */
  feature: "premiumReports" | "sections";
  /** Content to render when the feature is available */
  children: React.ReactNode;
  /** Optional custom fallback UI when the feature is locked */
  fallback?: React.ReactNode;
  /** Whether to show a blurred preview of the content */
  showPreview?: boolean;
}

/**
 * FeatureGate
 *
 * Wraps content that requires a specific plan feature.
 * If the feature is not available on the current plan, it renders a locked
 * fallback UI instead of the children.
 */
export function FeatureGate({ feature, children, fallback, showPreview = true }: FeatureGateProps) {
  const { hasFeature, isLoading, plan } = usePlanCheck();

  if (isLoading) return null;

  if (!hasFeature(feature)) {
    if (fallback) return <>{fallback}</>;
    
    if (showPreview) {
      return (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white group">
          {/* Blurred Content Preview */}
          <div className="blur-[8px] opacity-40 pointer-events-none select-none p-4 filter grayscale transition-all duration-700 group-hover:blur-[12px]">
            {children}
          </div>
          
          {/* Overlay Paywall */}
          <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[2px] z-10 p-6">
            <LockedFeatureCard feature={feature} plan={plan} inline />
          </div>
        </div>
      );
    }

    return <LockedFeatureCard feature={feature} plan={plan} />;
  }

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// LockedFeatureCard (internal)
// ---------------------------------------------------------------------------

interface LockedFeatureCardProps {
  feature: string;
  plan?: string;
  inline?: boolean;
}

const FEATURE_LABELS: Record<string, string> = {
  premiumReports: "Performance Analytics & Reports",
  sections: "Multiple Seating Sections",
};

const FEATURE_DESCRIPTIONS: Record<string, string> = {
  premiumReports: "Get detailed insights into your sales, staff performance, and customer trends.",
  sections: "Organize your cafeteria into Terrace, Main Hall, and VIP sections for better management.",
};

function LockedFeatureCard({ feature, plan, inline }: LockedFeatureCardProps) {
  const [showModal, setShowModal] = React.useState(false);
  const [, setLocation] = useLocation();
  const label = FEATURE_LABELS[feature] || feature;
  const description = FEATURE_DESCRIPTIONS[feature] || "Upgrade your plan to unlock this feature.";

  if (inline) {
    return (
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 text-center space-y-6 animate-in zoom-in-95 duration-500">
        <div className="mx-auto w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center shadow-inner relative">
          <Lock className="w-6 h-6 text-blue-600" />
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white">
            <Zap className="w-2.5 h-2.5 text-white fill-white" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{label}</h3>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            {description}
          </p>
        </div>

        <Button
          onClick={() => setLocation("/upgrade")}
          className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-100 transition-all hover:scale-[1.02]"
        >
          Unlock with Growth
          <ArrowRight className="ml-2 w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col items-center justify-center py-20 px-8 text-center space-y-6 bg-white rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <TrendingUp className="w-24 h-24 text-slate-900" />
        </div>
        
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center shadow-inner relative z-10">
          <Lock className="w-8 h-8 text-blue-500" />
        </div>
        
        <div className="space-y-2 relative z-10 max-w-md">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{label}</h3>
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            Your current <span className="text-blue-600 font-bold uppercase">{plan || 'starter'}</span> plan does not include access to this feature.
          </p>
        </div>

        <Button
          onClick={() => setShowModal(true)}
          className="h-11 px-8 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-100 relative z-10 transition-all hover:scale-105"
        >
          Upgrade to Unlock
          <Zap className="ml-2 w-4 h-4 fill-white" />
        </Button>
      </div>

      <UpgradeModal
        open={showModal}
        onClose={() => setShowModal(false)}
        reason={`${label} is available on Growth and Pro plans.`}
      />
    </>
  );
}
