import React, { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  Bell, 
  Utensils, 
  MessageSquare,
  Check
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  available: boolean | null;
  image?: string | null;
  categoryId: string;
}

interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

export default function CustomerMenu() {
  const { tableToken } = useParams<{ tableToken: string }>();
  const [, navigate] = useLocation();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  const { data: table, isLoading: isLoadingTable } = trpc.qrOrders.resolveTableByToken.useQuery(
    { token: tableToken || "" },
    { enabled: !!tableToken }
  );

  const { data: menuData, isLoading: isLoadingMenu } = trpc.menu.getMenuItems.useQuery(
    { cafeteriaId: table?.cafeteriaId || "" },
    { enabled: !!table?.cafeteriaId }
  );

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

  const { data: pendingRequests, refetch: refetchPendingRequests } = trpc.serviceRequests.getPendingRequestsForTable.useQuery(
    { tableId: table?.id || "" },
    { enabled: !!table?.id, refetchInterval: 10000 }
  );

  const createServiceRequestMutation = trpc.serviceRequests.createServiceRequest.useMutation({
    onSuccess: () => {
      toast.success("Request sent successfully!");
      refetchPendingRequests();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send request");
    },
  });

  const isRequestPending = (type: "call_waiter" | "clean_table") => {
    return pendingRequests?.requests?.some((r: any) => r.requestType === type);
  };

  const handleServiceRequest = (type: "call_waiter" | "clean_table") => {
    if (!table) return;
    if (isRequestPending(type)) {
      toast.info(`A ${type.replace('_', ' ')} request is already pending.`);
      return;
    }
    createServiceRequestMutation.mutate({
      cafeteriaId: table.cafeteriaId,
      tableId: table.id,
      requestType: type,
    });
  };

  const updateQuantity = (item: MenuItem, delta: number) => {
    const existingItemIndex = cart.findIndex((ci) => ci.menuItemId === item.id);
    
    if (existingItemIndex > -1) {
      const newCart = [...cart];
      const newQuantity = newCart[existingItemIndex].quantity + delta;
      if (newQuantity <= 0) {
        newCart.splice(existingItemIndex, 1);
      } else {
        newCart[existingItemIndex].quantity = newQuantity;
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
    setItemNotes(prev => ({ ...prev, [itemId]: note }));
    // Update note in cart if item exists
    setCart(prevCart => prevCart.map(ci => 
      ci.menuItemId === itemId ? { ...ci, notes: note } : ci
    ));
  };

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const getTotalItemsCount = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const submitOrder = async () => {
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

  const getItemQuantity = (itemId: string) => {
    const item = cart.find(ci => ci.menuItemId === itemId);
    return item ? item.quantity : 0;
  };

  if (isLoadingTable || isLoadingMenu) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Spinner />
      </div>
    );
  }

  if (!table) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="p-8 text-center w-full max-w-md mx-4">
          <h1 className="text-2xl font-bold mb-4">Invalid Table</h1>
          <p className="text-gray-600">The table token is invalid or expired.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">
              {table.cafeteriaName || 'Cafe'}
            </h1>
            <p className="text-xs text-gray-500 font-medium">Table {table.tableNumber}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "rounded-full transition-colors",
                isRequestPending("call_waiter") ? "bg-yellow-100 text-yellow-700" : "bg-blue-50 text-blue-600"
              )}
              onClick={() => handleServiceRequest("call_waiter")}
              disabled={createServiceRequestMutation.isPending || isRequestPending("call_waiter")}
            >
              <Bell className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-full font-bold text-sm">
              <ShoppingCart className="w-4 h-4" />
              <span>{getTotalItemsCount()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-2 py-4">
        {/* Menu Grid - Compact 2-column on mobile */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {menuData?.map((item) => {
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
                    <h3 className="font-bold text-gray-900 text-xs line-clamp-2 leading-tight">{item.name}</h3>
                    <span className="font-bold text-blue-600 text-xs whitespace-nowrap">${Number(item.price).toFixed(2)}</span>
                  </div>
                  
                  {/* Quick Quantity Control */}
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
                      <span className="text-xs font-bold w-5 text-center">{quantity}</span>
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
                    
                    {/* Simple Note Toggle */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-7 w-7 rounded-full",
                        (itemNotes[item.id] || isNoteActive) ? "text-blue-600 bg-blue-50" : "text-gray-400"
                      )}
                      onClick={() => setActiveNoteId(isNoteActive ? null : item.id)}
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Inline Note Input */}
                  {isNoteActive && (
                    <div className="mt-2 flex gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
                      <Input
                        placeholder="Note..."
                        className="h-7 text-[10px] px-2 border-gray-200 focus:ring-0"
                        value={itemNotes[item.id] || ""}
                        onChange={(e) => handleNoteChange(item.id, e.target.value)}
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
              <span className="text-xs text-gray-500 font-medium">Total Amount</span>
              <span className="text-xl font-bold text-gray-900">${getTotalAmount().toFixed(2)}</span>
            </div>
            <Button
              className="flex-1 h-12 text-base font-bold bg-green-600 hover:bg-green-700 shadow-lg shadow-green-100"
              disabled={createOrderMutation.isPending}
              onClick={submitOrder}
            >
              {createOrderMutation.isPending ? "Placing Order..." : `Order ${getTotalItemsCount()} Items`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
