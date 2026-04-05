import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  formatCurrency,
  formatPoints,
  formatPercentage,
  calculateOccupancyPercentage,
  getOccupancyLevel,
  getOccupancyColor,
  parseDecimal,
} from "@/lib/dashboardUtils";
import { Loader2, TrendingUp, Users, UtensilsCrossed, Table2, ShoppingCart, DollarSign, Settings, LogOut, Plus, ChevronRight, Bell } from "lucide-react";
import { useLocation } from "wouter";
import { useTranslation } from "@/locales/useTranslation";

export default function ManagerDashboard() {
  const { user, logout, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { t, language, setLanguage } = useTranslation();

  // Ensure cafeteriaId is properly typed
  const cafeteriaId = (user as any)?.cafeteriaId || (user as any)?.id || "";

  // Fetch cafeteria data
  const { data: cafeteriaData, isLoading: cafeteriaLoading } = trpc.cafeterias.getCafeteriaDetails.useQuery(
    { cafeteriaId },
    { enabled: !!cafeteriaId }
  );

  // Fetch occupancy data
  const { data: occupancyData, isLoading: occupancyLoading } = trpc.tables.getCafeteriaOccupancy.useQuery(
    { cafeteriaId },
    { enabled: !!cafeteriaId }
  );

  // Fetch menu summary
  const { data: menuData, isLoading: menuLoading } = trpc.menu.getMenuSummary.useQuery(
    { cafeteriaId },
    { enabled: !!cafeteriaId }
  );

  // Fetch shift statistics
  const { data: shiftStats, isLoading: shiftLoading } = trpc.shifts.getCafeteriaShifts.useQuery(
    { cafeteriaId },
    { enabled: !!cafeteriaId }
  );

  // Fetch sales report
  const { data: salesReport, isLoading: salesLoading } = trpc.reporting.getCafeteriaReports.useQuery(
    { cafeteriaId },
    { enabled: !!cafeteriaId }
  );

  // Fetch service requests
  const { data: serviceRequestsData } = trpc.serviceRequests.listServiceRequests.useQuery(
    { cafeteriaId, status: "pending" },
    { enabled: !!cafeteriaId, refetchInterval: 10000 }
  );

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <Loader2 className="animate-spin w-8 h-8 text-blue-600" />
      </div>
    );
  }

  const isLoading = cafeteriaLoading || occupancyLoading || menuLoading || shiftLoading || salesLoading;

  const pointsBalance = cafeteriaData ? parseDecimal(cafeteriaData.pointsBalance as string | number) : 0;
  const occupancyRate = occupancyData
    ? calculateOccupancyPercentage(occupancyData.occupiedTables || 0, occupancyData.totalTables || 0)
    : 0;
  const report = Array.isArray(salesReport) ? salesReport[0] : salesReport;
  const totalSales = report ? parseDecimal(report.totalSales) : 0;
  const totalOrders = report?.totalOrders || 0;
  const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 pb-20">
      {/* Header */}
      <header className="bg-white border-b-4 border-blue-500 sticky top-0 z-40 shadow-lg">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-3 rounded-xl shadow-lg">
              <ShoppingCart className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">Manager</h1>
              <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">
                {cafeteriaData?.name || "Cafeteria"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="h-12 w-12 text-slate-600 hover:text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Service Requests Alert */}
        {serviceRequestsData?.requests && serviceRequestsData.requests.length > 0 && (
          <Card className="border-0 shadow-lg overflow-hidden bg-yellow-50 border-l-8 border-yellow-400">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-black text-yellow-800 flex items-center gap-2">
                <Bell className="w-5 h-5" />
                {serviceRequestsData.requests.length} Pending Service Requests
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2">
                {serviceRequestsData.requests.slice(0, 5).map((req: any) => (
                  <Badge key={req.id} variant="outline" className="bg-white border-yellow-200 text-yellow-700 font-bold">
                    Table {req.tableId.split('-').pop()} - {req.requestType.replace('_', ' ')}
                  </Badge>
                ))}
                {serviceRequestsData.requests.length > 5 && (
                  <Badge variant="outline" className="bg-white border-yellow-200 text-yellow-700 font-bold">
                    +{serviceRequestsData.requests.length - 5} more
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-purple-100 overflow-hidden">
            <CardContent className="p-6 text-center">
              <div className="bg-purple-500 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Total Orders</p>
              <p className="text-4xl font-black text-purple-600 mt-2">{totalOrders}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-green-100 overflow-hidden">
            <CardContent className="p-6 text-center">
              <div className="bg-green-500 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Today's Sales</p>
              <p className="text-4xl font-black text-green-600 mt-2">${totalSales.toFixed(0)}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100 overflow-hidden">
            <CardContent className="p-6 text-center">
              <div className="bg-blue-500 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <Table2 className="w-6 h-6 text-white" />
              </div>
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Occupancy</p>
              <p className="text-4xl font-black text-blue-600 mt-2">{formatPercentage(occupancyRate)}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-orange-50 to-orange-100 overflow-hidden">
            <CardContent className="p-6 text-center">
              <div className="bg-orange-500 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Active Staff</p>
              <p className="text-4xl font-black text-orange-600 mt-2">{shiftStats?.length || 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Sales Summary */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="h-3 bg-gradient-to-r from-green-400 to-green-600" />
          <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 border-b-4 border-green-500">
            <CardTitle className="text-xl font-black text-slate-900">Today's Sales Details</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl border-2 border-green-200">
              <span className="font-bold text-slate-900">Total Sales</span>
              <span className="text-2xl font-black text-green-600">{formatCurrency(totalSales)}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl border-2 border-green-200">
              <span className="font-bold text-slate-900">Average Order Value</span>
              <span className="text-2xl font-black text-green-600">{formatCurrency(avgOrderValue)}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl border-2 border-green-200">
              <span className="font-bold text-slate-900">Points Deducted</span>
              <span className="text-2xl font-black text-green-600">{formatPoints(report?.totalPointsDeducted || 0)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Table Occupancy */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="h-3 bg-gradient-to-r from-blue-400 to-blue-600" />
          <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b-4 border-blue-500">
            <CardTitle className="text-xl font-black text-slate-900">Table Occupancy</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-xl border-2 border-blue-200 text-center">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Total Tables</p>
                <p className="text-3xl font-black text-blue-600 mt-2">{occupancyData?.totalTables || 0}</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-xl border-2 border-blue-200 text-center">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Occupied</p>
                <p className="text-3xl font-black text-blue-600 mt-2">{occupancyData?.occupiedTables || 0}</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-xl border-2 border-blue-200 text-center">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Available</p>
                <p className="text-3xl font-black text-blue-600 mt-2">{occupancyData?.availableTables || 0}</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-xl border-2 border-blue-200 text-center">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Level</p>
                <p className={`text-2xl font-black mt-2 ${getOccupancyColor(occupancyRate)}`}>
                  {getOccupancyLevel(occupancyRate)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section Breakdown */}
        {occupancyData?.sectionStats && occupancyData.sectionStats.length > 0 && (
          <Card className="border-0 shadow-lg overflow-hidden">
            <div className="h-3 bg-gradient-to-r from-purple-400 to-purple-600" />
            <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100 border-b-4 border-purple-500">
              <CardTitle className="text-xl font-black text-slate-900">Occupancy by Section</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              {occupancyData.sectionStats.map((section) => (
                <div key={section.sectionId} className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl border-2 border-purple-200 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{section.sectionName}</p>
                    <p className="text-xs text-slate-600 font-semibold">
                      {section.occupiedTables}/{section.totalTables} tables
                    </p>
                  </div>
                  <Badge className="bg-purple-500 text-white border-none font-bold text-base px-3 py-1">
                    {formatPercentage(section.occupancyRate)}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Menu Summary */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="h-3 bg-gradient-to-r from-orange-400 to-orange-600" />
          <CardHeader className="bg-gradient-to-r from-orange-50 to-orange-100 border-b-4 border-orange-500">
            <CardTitle className="text-xl font-black text-slate-900">Menu Summary</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-orange-50 rounded-xl border-2 border-orange-200 text-center">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Total Items</p>
                <p className="text-3xl font-black text-orange-600 mt-2">{menuData?.totalItems || 0}</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-xl border-2 border-orange-200 text-center">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Available</p>
                <p className="text-3xl font-black text-orange-600 mt-2">{menuData?.availableItems || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Points Balance */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="h-3 bg-gradient-to-r from-indigo-400 to-indigo-600" />
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-indigo-100 border-b-4 border-indigo-500">
            <CardTitle className="text-xl font-black text-slate-900">Points Balance</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="p-6 bg-indigo-50 rounded-xl border-2 border-indigo-200 text-center">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Available for Operations</p>
              <p className="text-5xl font-black text-indigo-600">{formatPoints(pointsBalance)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Settings Card */}
        <Card className="border-0 shadow-lg mb-12 overflow-hidden">
          <div className="h-3 bg-gradient-to-r from-slate-400 to-slate-600" />
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-4 border-slate-400">
            <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Settings className="w-6 h-6" />
              Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <Button
              onClick={() => setLocation("/dashboard/cafeteria/settings")}
              className="w-full bg-slate-600 hover:bg-slate-700 text-white font-bold h-14 text-lg"
            >
              <Settings className="w-5 h-5 mr-2" />
              Full Settings
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
