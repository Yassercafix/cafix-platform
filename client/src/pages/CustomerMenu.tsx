import React, { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  Bell, 
  MessageSquare,
  Check,
  AlertCircle,
  UtensilsCrossed,
  Search,
  Heart,
  ArrowLeft,
  Loader2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

export default function CustomerMenu() {
  const params = useParams<{ tableToken?: string }>();
  const tableToken = params.tableToken;
  const [, navigate] = useLocation();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: table,
    isLoading: isLoadingTable,
    error: tableError,
  } = trpc.qrOrders.resolveTableByToken.useQuery(
    { token: tableToken || "" },
    { enabled: !!tableToken, retry: 1 }
  );

  const {
    data: menuData,
    isLoading: isLoadingMenu,
    error: menuError,
  } = trpc.qrOrders.getMenuForTable.useQuery(
    { token: tableToken || "" },
    { enabled: !!tableToken, retry: 1 }
  );

  const { data: pendingRequests, refetch: refetchPendingRequests } =
    trpc.serviceRequests.getPendingRequestsForTable.useQuery(
      { tableId: table?.id || "" },
      { enabled: !!table?.id, refetchInterval: 10000 }
    );

  const createServiceRequestMutation =
    trpc.serviceRequests.createServiceRequest.useMutation({
      onSuccess: () => {
        toast.success("Request sent successfully!");
        refetchPendingRequests();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to send request");
      },
    });

  const createOrderMutation = trpc.qrOrders.createCustomerOrder.useMutation({
    onSuccess: (order) => {
      console.log(`[ORDER_CREATED] Customer order ${order.orderId} created successfully`);
      toast.success("تم إرسال الطلب بنجاح!");
      setCart([]);
      // Redirect to order tracking page
      navigate(`/order-tracking/${order.orderId}`);
    },
    onError: (error) => {
      const errorMsg = error.message || "فشل في إرسال الطلب";
      console.error('[ORDER_CREATION_ERROR]', errorMsg);
      toast.error(errorMsg);
    },
  });

  const isRequestPending = (type: "call_waiter" | "clean_table") =>
    pendingRequests?.requests?.some((r: any) => r.requestType === type);

  const handleServiceRequest = (type: "call_waiter" | "clean_table") => {
    if (!table) return;
    if (isRequestPending(type)) {
      toast.info(`A ${type.replace("_", " ")} request is already pending.`);
      return;
    }
    createServiceRequestMutation.mutate({
      cafeteriaId: table.cafeteriaId,
      tableId: table.id,
      requestType: type,
    });
  };

  const updateQuantity = (item: { id: string; name: string; price: number; available: boolean | null }, delta: number) => {
    const existingIndex = cart.findIndex((ci) => ci.menuItemId === item.id);
    if (existingIndex > -1) {
      const newCart = [...cart];
      const newQty = newCart[existingIndex].quantity + delta;
      if (newQty <= 0) {
        newCart.splice(existingIndex, 1);
      } else {
        newCart[existingIndex].quantity = newQty;
      }
      setCart(newCart);
    } else if (delta > 0) {
      setCart([
        ...cart,
        {
          menuItemId: item.id,
          name: item.name,
          price: Number(item.price),
          quantity: delta,
          notes: itemNotes[item.id] || "",
        },
      ]);
    }
  };

  const handleNoteChange = (itemId: string, note: string) => {
    setItemNotes((prev) => ({ ...prev, [itemId]: note }));
    setCart((prevCart) =>
      prevCart.map((ci) =>
        ci.menuItemId === itemId ? { ...ci, notes: note } : ci
      )
    );
  };

  const getTotalAmount = () =>
    cart.reduce((total, item) => total + item.price * item.quantity, 0);

  const getTotalItemsCount = () =>
    cart.reduce((total, item) => total + item.quantity, 0);

  const getItemQuantity = (itemId: string) => {
    const item = cart.find((ci) => ci.menuItemId === itemId);
    return item ? item.quantity : 0;
  };

  const submitOrder = () => {
    if (cart.length === 0) {
      toast.error("يرجى إضافة أصناف إلى طلبك");
      return;
    }
    console.log(`[ORDER_SUBMISSION] Submitting order with ${cart.length} items`);
    createOrderMutation.mutate({
      token: tableToken || "",
      items: cart.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
      })),
    });
  };

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const categories = useMemo(() => {
    if (!menuData) return [];
    const seen = new Set<string>();
    const cats: { id: string; name: string }[] = [];
    menuData.forEach((item: any) => {
      if (!seen.has(item.categoryId)) {
        seen.add(item.categoryId);
        cats.push({ id: item.categoryId, name: item.categoryId });
      }
    });
    return cats;
  }, [menuData]);

  const filteredMenu = useMemo(() => {
    if (!menuData) return [];
    let items = menuData;
    if (activeCategoryId) {
      items = items.filter((item: any) => item.categoryId === activeCategoryId);
    }
    if (searchQuery) {
      items = items.filter((item: any) => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return items;
  }, [menuData, activeCategoryId, searchQuery]);

  if (isLoadingTable || isLoadingMenu) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 gap-3">
        <Spinner />
        <p className="text-sm text-gray-500">Loading menu…</p>
      </div>
    );
  }

  if (tableError || !table) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
        <Card className="p-8 text-center w-full max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2 text-gray-900">Invalid Table</h1>
          <p className="text-gray-500 text-sm">
            {tableError?.message || "The table token is invalid or has expired."}
          </p>
        </Card>
      </div>
    );
  }

  if (menuError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
        <Card className="p-8 text-center w-full max-w-md">
          <AlertCircle className="w-12 h-12 text-orange-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2 text-gray-900">Menu Unavailable</h1>
          <p className="text-gray-500 text-sm">
            {menuError.message || "Could not load the menu. Please try again."}
          </p>
        </Card>
      </div>
    );
  }

  if (!menuData || menuData.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
        <Card className="p-8 text-center w-full max-w-md">
          <UtensilsCrossed className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2 text-gray-900">No menu available</h1>
          <p className="text-gray-500 text-sm">
            The menu for {table.cafeteriaName || "this cafeteria"} is not set up yet.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-32 font-sans" dir="rtl">
      {/* Top Header */}
      <div className="bg-white sticky top-0 z-40 px-4 py-4 flex items-center justify-between border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-gray-900 line-clamp-1">
              {table.cafeteriaName || "المقهى"}
            </h1>
            <p className="text-xs text-gray-500">طاولة {table.tableNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="rounded-full">
            <Heart className="w-6 h-6 text-gray-600" />
          </Button>
          <div className="relative">
            <Button variant="ghost" size="icon" className="rounded-full bg-gray-100">
              <ShoppingCart className="w-6 h-6 text-gray-900" />
            </Button>
            {getTotalItemsCount() > 0 && (
              <span className="absolute -top-1 -left-1 bg-orange-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                {getTotalItemsCount()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-4 py-4">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input 
            placeholder="ابحث عن مشروب أو وجبة..."
            className="pr-10 h-12 bg-gray-50 border-none rounded-xl focus-visible:ring-1 focus-visible:ring-gray-200"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Categories */}
      {categories.length > 0 && (
        <div className="px-4 pb-4 overflow-x-auto flex gap-2 no-scrollbar">
          <button
            onClick={() => setActiveCategoryId(null)}
            className={cn(
              "px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all",
              !activeCategoryId 
                ? "bg-gray-900 text-white shadow-md" 
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            الكل
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategoryId(cat.id)}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all",
                activeCategoryId === cat.id 
                  ? "bg-gray-900 text-white shadow-md" 
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Menu Grid */}
      <div className="px-4 grid grid-cols-2 gap-4">
        {filteredMenu.map((item: any) => {
          const quantity = getItemQuantity(item.id);
          const isNoteActive = activeNoteId === item.id;

          return (
            <div key={item.id} className="flex flex-col">
              <div className="relative aspect-square bg-gray-50 rounded-3xl overflow-hidden mb-3 group">
                {/* Item Image or Placeholder */}
                {item.imageUrl ? (
                  <img 
                    src={item.imageUrl} 
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <UtensilsCrossed className="w-12 h-12" />
                  </div>
                )}
                
                {/* Favorite Toggle */}
                <button className="absolute top-3 right-3 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm">
                  <Heart className="w-4 h-4 text-gray-600" />
                </button>

                {/* Add/Quantity Overlay */}
                <div className="absolute bottom-3 left-3 right-3">
                  {quantity === 0 ? (
                    <button 
                      onClick={() => updateQuantity(item, 1)}
                      className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
                    >
                      <Plus className="w-6 h-6 text-orange-600" />
                    </button>
                  ) : (
                    <div className="bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-between p-1">
                      <button 
                        onClick={() => updateQuantity(item, -1)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-100"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-bold text-sm">{quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item, 1)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-orange-600 hover:bg-gray-100"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <h3 className="font-bold text-gray-900 text-sm mb-0.5 line-clamp-2 leading-snug px-1">
                {item.name}
              </h3>
              
              {item.description && (
                <p className="text-[10px] text-gray-500 line-clamp-1 mb-1 px-1">
                  {item.description}
                </p>
              )}
              
              <div className="flex items-center justify-between px-1">
                <div className="flex flex-col">
                  <span className="font-black text-gray-900 text-base">
                    {Number(item.price).toFixed(2)} <span className="text-[10px] font-bold">ج.م</span>
                  </span>
                </div>
                
                <button 
                  onClick={() => setActiveNoteId(isNoteActive ? null : item.id)}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                    itemNotes[item.id] ? "bg-blue-50 text-blue-600" : "text-gray-400 hover:bg-gray-100"
                  )}
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>

              {/* Inline Note Input */}
              {isNoteActive && (
                <div className="mt-2 flex gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
                  <Input
                    placeholder="ملاحظات..."
                    className="h-8 text-xs bg-gray-50 border-none rounded-lg"
                    value={itemNotes[item.id] || ""}
                    onChange={(e) => handleNoteChange(item.id, e.target.value)}
                    autoFocus
                  />
                  <Button
                    size="icon"
                    className="h-8 w-8 shrink-0 bg-green-600 hover:bg-green-700 rounded-lg"
                    onClick={() => setActiveNoteId(null)}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sticky Bottom Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t p-4 pb-8 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-50">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 font-bold mb-1">إجمالي الطلب</span>
              <span className="text-2xl font-black text-gray-900">
                {getTotalAmount().toFixed(2)} <span className="text-xs font-bold">ج.م</span>
              </span>
            </div>
            <Button
              className="flex-1 h-14 text-lg font-black bg-orange-600 hover:bg-orange-700 text-white rounded-2xl shadow-xl shadow-orange-200 transition-all active:scale-95 flex items-center justify-center gap-2"
              disabled={createOrderMutation.isPending}
              onClick={submitOrder}
            >
              {createOrderMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>جاري الطلب...</span>
                </>
              ) : (
                "أضف للسلة"
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Service Request FAB */}
      <div className="fixed bottom-24 left-4 z-40">
        <Button
          variant="outline"
          size="icon"
          className={cn(
            "w-12 h-12 rounded-full shadow-lg border-none transition-all",
            isRequestPending("call_waiter")
              ? "bg-yellow-100 text-yellow-700"
              : "bg-gray-900 text-white"
          )}
          onClick={() => handleServiceRequest("call_waiter")}
          disabled={createServiceRequestMutation.isPending || !!isRequestPending("call_waiter")}
        >
          <Bell className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
