import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

const ROLE_ROUTES: Record<string, string> = {
  owner: "/dashboard/owner",
  marketer: "/dashboard/marketer",
  cafeteria_admin: "/dashboard/cafeteria-admin",
  manager: "/dashboard/manager",
  waiter: "/dashboard/waiter",
  chef: "/dashboard/chef",
};

export default function LoginSupabase() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  const loginMutation = trpc.authSupabase.login.useMutation({
    onSuccess: (result) => {
      localStorage.setItem("last_activity", Date.now().toString());
      toast.success(`Welcome!`);
      setLocation(ROLE_ROUTES[result.role] || "/dashboard/cafeteria-admin");
    },
    onError: (error) => {
      console.error("Login error:", error);
      setErrorMessage(error.message || "Invalid email or password.");
      setIsLoading(false);
    },
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage("Email and password are required.");
      return;
    }

    setIsLoading(true);
    try {
      await loginMutation.mutateAsync({
        email: email.trim(),
        password: password,
      });
    } catch (err: any) {
      console.error("Login error:", err);
      setErrorMessage(err.message || "An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0 bg-white/95 backdrop-blur">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
            <ShieldAlert className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-3xl font-black text-slate-900">Cafeteria System</CardTitle>
          <CardDescription className="text-slate-500">Sign in to your dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Email</label>
              <Input
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 bg-slate-50 border-slate-200 focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 bg-slate-50 border-slate-200 pr-12 focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 font-medium">{errorMessage}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-700">
              <strong>Note:</strong> This system uses Supabase Auth. Please use your registered email and password to sign in.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
