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
  UtensilsCrossed
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
  // Support both /order/:tableToken and /menu/:tableToken routes
  const params = useParams<{ tableToken?: string }>();
  const tableToken = params.tableToken;
  const [, navigate] = useLocation();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  // DEBUG: log token on every render
  console.log("TOKEN:", tableToken);

  // ── Step 1: Resolve table by token (public endpoint) ──────────────────────
  const {
    data: table,
    isLoading: isLoadingTable,
    error: tableError,
  } = trpc.qrOrders.resolveTableByToken.useQuery(
    { token: tableToken || "" },
    { enabled: !!tableToken, retry: 1 }
  );

  // ── Step 2: Fetch menu using public endpoint (token → cafeteria → items) ──
  const {
    data: menuData,
    isLoading: isLoadingMenu,
    error: menuError,
  } = trpc.qrOrders.getMenuForTable.useQuery(
    { token: tableToken || "" },
    { enabled: !!tableToken, retry: 1 }
  );

  // DEBUG: log menu data whenever it changes
  console.log("MENU DATA:", menuData);

  // ── Service requests ───────────────────────────────────────────────────────
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

  // ── Order mutation ─────────────────────────────────────────────────────────
  const createOrderMutation = trpc.qrOrders.createCustomerOrder.useMutation({
    onSuccess: (order) => {
      toast.success("Order submitted successfully!");
      setCart([]);
      setTimeout(() => {
        navigate(`/order-confirmation/${order.orderId}`);
      }, 1000);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to submit order");
    },
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
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
      toast.error("Please add items to your order");
      return;
    }
    createOrderMutation.mutate({
      token: tableToken || "",
      items: cart.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
      })),
    });
  };

  // ── Category filter (optional UX improvement) ─────────────────────────────
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
    if (!activeCategoryId) return menuData;
    return menuData.filter((item: any) => item.categoryId === activeCategoryId);
  }, [menuData, activeCategoryId]);

  // ── LOADING STATE ──────────────────────────────────────────────────────────
  if (isLoadingTable || isLoadingMenu) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 gap-3">
        <Spinner />
        <p className="text-sm text-gray-500">Loading menu…</p>
      </div>
    );
  }

  // ── ERROR STATE: invalid token ─────────────────────────────────────────────
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

  // ── ERROR STATE: menu fetch failed ────────────────────────────────────────
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

  // ── EMPTY STATE: no menu items ─────────────────────────────────────────────
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

  // ── DATA STATE: render menu ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">
              {table.cafeteriaName || "Cafe"}
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              Table {table.tableNumber}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "rounded-full transition-colors",
                isRequestPending("call_waiter")
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-blue-50 text-blue-600"
              )}
              onClick={() => handleServiceRequest("call_waiter")}
              disabled={
                createServiceRequestMutation.isPending ||
                !!isRequestPending("call_waiter")
              }
            >
              <Bell className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-full font-bold text-sm">
              <ShoppingCart className="w-4 h-4" />
              <span>{getTotalItemsCount()}</span>
            </div>
          </div>
        </div>

        {/* Category filter tabs */}
        {categories.length > 1 && (
          <div className="flex gap-2 px-4 pb-2 overflow-x-auto scrollbar-hide">
            <button
              className={cn(
                "shrink-0 text-xs px-3 py-1 rounded-full border font-medium transition-colors",
                !activeCategoryId
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200"
              )}
              onClick={() => setActiveCategoryId(null)}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={cn(
                  "shrink-0 text-xs px-3 py-1 rounded-full border font-medium transition-colors",
                  activeCategoryId === cat.id
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200"
                )}
                onClick={() =>
                  setActiveCategoryId(
                    activeCategoryId === cat.id ? null : cat.id
                  )
                }
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-2 py-4">
        {/* Menu Grid — compact 2-column on mobile */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {filteredMenu.map((item: any) => {
            const quantity = getItemQuantity(item.id);
            const isNoteActive = activeNoteId === item.id;

            return (
              <Card
                key={item.id}
                className={cn(
                  "overflow-hidden flex flex-col border-gray-200 p-2",
                  !item.available && "opacity-60 grayscale"
                )}
              >
                <div className="flex flex-col h-full">
                  <div className="flex justify-between items-start gap-1 mb-1">
                    <h3 className="font-bold text-gray-900 text-xs line-clamp-2 leading-tight">
                      {item.name}
                    </h3>
                    <span className="font-bold text-blue-600 text-xs whitespace-nowrap">
                      ${Number(item.price).toFixed(2)}
                    </span>
                  </div>

                  {/* Quantity Control */}
                  <div className="mt-auto flex items-center justify-between gap-1">
                    <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-md hover:bg-white"
                        onClick={() => updateQuantity(item, -1)}
                        disabled={!item.available || quantity === 0}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="text-xs font-bold w-5 text-center">
                        {quantity}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-md hover:bg-white"
                        onClick={() => updateQuantity(item, 1)}
                        disabled={!item.available}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>

                    {/* Note Toggle */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-7 w-7 rounded-full",
                        itemNotes[item.id] || isNoteActive
                          ? "text-blue-600 bg-blue-50"
                          : "text-gray-400"
                      )}
                      onClick={() =>
                        setActiveNoteId(isNoteActive ? null : item.id)
                      }
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Inline Note Input */}
                  {isNoteActive && (
                    <div className="mt-2 flex gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
                      <Input
                        placeholder="Note…"
                        className="h-7 text-[10px] px-2 border-gray-200 focus:ring-0"
                        value={itemNotes[item.id] || ""}
                        onChange={(e) =>
                          handleNoteChange(item.id, e.target.value)
                        }
                        autoFocus
                      />
                      <Button
                        size="icon"
                        className="h-7 w-7 shrink-0 bg-green-600 hover:bg-green-700"
                        onClick={() => setActiveNoteId(null)}
                      >
                        <Check className="w-3 h-3" />
                      </Button>
                    </div>
                  )}

                  {itemNotes[item.id] && !isNoteActive && (
                    <p className="mt-1 text-[10px] text-gray-500 italic truncate px-1">
                      "{itemNotes[item.id]}"
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-40">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 font-medium">
                Total Amount
              </span>
              <span className="text-xl font-bold text-gray-900">
                ${getTotalAmount().toFixed(2)}
              </span>
            </div>
            <Button
              className="flex-1 h-12 text-base font-bold bg-green-600 hover:bg-green-700 shadow-lg shadow-green-100"
              disabled={createOrderMutation.isPending}
              onClick={submitOrder}
            >
              {createOrderMutation.isPending
                ? "Placing Order…"
                : `Order ${getTotalItemsCount()} Items`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
