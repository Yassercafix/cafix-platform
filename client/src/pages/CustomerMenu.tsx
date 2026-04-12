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
  Trash2, 
  Plus, 
  Minus, 
  Bell, 
  Utensils, 
  X,
  MessageSquare
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [itemNotes, setItemNotes] = useState("");
  const [itemQuantity, setItemQuantity] = useState(1);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const { data: table, isLoading: isLoadingTable } = trpc.qrOrders.resolveTableByToken.useQuery(
    { token: tableToken || "" },
    { enabled: !!tableToken }
  );

  const { data: menuData, isLoading: isLoadingMenu } = trpc.menu.getMenuItems.useQuery(
    { cafeteriaId: table?.cafeteriaId || "" },
    { enabled: !!table?.cafeteriaId }
  );

  const { data: categoriesData } = trpc.menu.getCategories.useQuery(
    { cafeteriaId: table?.cafeteriaId || "" },
    { enabled: !!table?.cafeteriaId }
  );

  const createOrderMutation = trpc.qrOrders.createCustomerOrder.useMutation({
    onSuccess: (order) => {
      toast.success("Order submitted successfully!");
      setCart([]);
      setIsCartOpen(false);
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

  useEffect(() => {
    if (categoriesData && categoriesData.length > 0 && !selectedCategory) {
      setSelectedCategory(categoriesData[0].id);
    }
  }, [categoriesData, selectedCategory]);

  const addToCart = (item: MenuItem, quantity: number = 1, notes: string = "") => {
    const existingItemIndex = cart.findIndex((ci) => ci.menuItemId === item.id && ci.notes === notes);
    
    if (existingItemIndex > -1) {
      const newCart = [...cart];
      newCart[existingItemIndex].quantity += quantity;
      setCart(newCart);
    } else {
      setCart([
        ...cart,
        {
          menuItemId: item.id,
          name: item.name,
          price: Number(item.price),
          quantity,
          notes,
        },
      ]);
    }
    toast.success(`${item.name} added to cart`);
    setSelectedItem(null);
    setItemNotes("");
    setItemQuantity(1);
  };

  const updateCartQuantity = (index: number, delta: number) => {
    const newCart = [...cart];
    const newQuantity = newCart[index].quantity + delta;
    
    if (newQuantity <= 0) {
      newCart.splice(index, 1);
    } else {
      newCart[index].quantity = newQuantity;
    }
    setCart(newCart);
  };

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
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
        // Backend currently doesn't support notes per item, but we keep them in frontend state
      })),
    });
  };

  const filteredItems = useMemo(() => {
    if (!menuData) return [];
    if (!selectedCategory) return menuData;
    return menuData.filter(item => item.categoryId === selectedCategory);
  }, [menuData, selectedCategory]);

  const getItemQuantityInCart = (itemId: string) => {
    return cart
      .filter(ci => ci.menuItemId === itemId)
      .reduce((total, ci) => total + ci.quantity, 0);
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
    <div className="min-h-screen bg-gray-50 pb-24">
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
            <Drawer open={isCartOpen} onOpenChange={setIsCartOpen}>
              <DrawerTrigger asChild>
                <Button variant="outline" className="relative rounded-full px-4 h-10 border-gray-200">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  <span className="font-bold">{getTotalItemsCount()}</span>
                  {cart.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  )}
                </Button>
              </DrawerTrigger>
              <DrawerContent className="max-h-[85vh]">
                <DrawerHeader className="border-b pb-4">
                  <DrawerTitle className="flex items-center justify-between">
                    <span>Your Order</span>
                    <Badge variant="secondary" className="text-sm">
                      {getTotalItemsCount()} items
                    </Badge>
                  </DrawerTitle>
                </DrawerHeader>
                <div className="overflow-y-auto p-4 space-y-4 min-h-[200px]">
                  {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                      <ShoppingCart className="w-12 h-12 mb-2 opacity-20" />
                      <p>Your cart is empty</p>
                    </div>
                  ) : (
                    cart.map((item, index) => (
                      <div key={`${item.menuItemId}-${index}`} className="flex flex-col border-b border-gray-100 pb-4 last:border-0">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-900">{item.name}</h4>
                            <p className="text-sm text-blue-600 font-semibold">${(item.price * item.quantity).toFixed(2)}</p>
                            {item.notes && (
                              <div className="flex items-start gap-1 mt-1 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                                <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
                                <span>{item.notes}</span>
                              </div>
                            )}
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-gray-400 hover:text-red-500 h-8 w-8"
                            onClick={() => removeFromCart(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-end gap-3">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            onClick={() => updateCartQuantity(index, -1)}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="font-bold w-6 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            onClick={() => updateCartQuantity(index, 1)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <DrawerFooter className="border-t p-4 bg-gray-50">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-gray-600 font-medium">Total Amount</span>
                    <span className="text-xl font-bold text-gray-900">${getTotalAmount().toFixed(2)}</span>
                  </div>
                  <Button
                    className="w-full h-12 text-lg font-bold bg-green-600 hover:bg-green-700"
                    disabled={cart.length === 0 || createOrderMutation.isPending}
                    onClick={submitOrder}
                  >
                    {createOrderMutation.isPending ? "Placing Order..." : "Place Order"}
                  </Button>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
          </div>
        </div>

        {/* Category Tabs */}
        {categoriesData && categoriesData.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-4 py-2 no-scrollbar border-t">
            {categoriesData.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all border",
                  selectedCategory === category.id
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                )}
              >
                {category.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Menu Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredItems.map((item) => {
            const quantityInCart = getItemQuantityInCart(item.id);
            return (
              <Card 
                key={item.id} 
                className={cn(
                  "overflow-hidden flex flex-col h-full border-gray-200 transition-all hover:shadow-md cursor-pointer relative",
                  !item.available && "opacity-60 grayscale"
                )}
                onClick={() => item.available && setSelectedItem(item)}
              >
                {quantityInCart > 0 && (
                  <div className="absolute top-2 right-2 z-10">
                    <Badge className="bg-blue-600 text-white border-none h-6 w-6 flex items-center justify-center p-0 rounded-full shadow-sm">
                      {quantityInCart}
                    </Badge>
                  </div>
                )}
                <div className="aspect-square bg-gray-100 relative">
                  {item.image ? (
                    <img 
                      src={item.image} 
                      alt={item.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <Utensils className="w-10 h-10" />
                    </div>
                  )}
                  {!item.available && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="text-white font-bold text-xs uppercase tracking-wider bg-black/60 px-2 py-1 rounded">Unavailable</span>
                    </div>
                  )}
                </div>
                <div className="p-3 flex flex-col flex-1">
                  <h3 className="font-bold text-gray-900 text-sm line-clamp-1 mb-1">{item.name}</h3>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <span className="font-bold text-blue-600 text-sm">${Number(item.price).toFixed(2)}</span>
                    <Button
                      size="icon"
                      className="h-8 w-8 rounded-full bg-blue-600 hover:bg-blue-700 shadow-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (item.available) addToCart(item);
                      }}
                      disabled={!item.available}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-20">
            <Utensils className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No items found</h3>
            <p className="text-gray-500">This category is currently empty.</p>
          </div>
        )}
      </div>

      {/* Item Details Modal */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden border-none">
          {selectedItem && (
            <>
              <div className="aspect-video bg-gray-100 relative">
                {selectedItem.image ? (
                  <img 
                    src={selectedItem.image} 
                    alt={selectedItem.name} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <Utensils className="w-16 h-16" />
                  </div>
                )}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-2 right-2 bg-black/20 hover:bg-black/40 text-white rounded-full h-8 w-8"
                  onClick={() => setSelectedItem(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="p-6">
                <DialogHeader>
                  <div className="flex justify-between items-start mb-2">
                    <DialogTitle className="text-2xl font-bold">{selectedItem.name}</DialogTitle>
                    <span className="text-2xl font-bold text-blue-600">${Number(selectedItem.price).toFixed(2)}</span>
                  </div>
                  {selectedItem.description && (
                    <p className="text-gray-500 text-sm leading-relaxed">{selectedItem.description}</p>
                  )}
                </DialogHeader>
                
                <div className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Special Notes
                    </label>
                    <Textarea 
                      placeholder="E.g. No onions, extra spicy, etc."
                      className="resize-none border-gray-200 focus:border-blue-500 min-h-[80px]"
                      value={itemNotes}
                      onChange={(e) => setItemNotes(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center justify-between py-4 border-t border-b border-gray-100">
                    <span className="font-bold text-gray-700">Quantity</span>
                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 rounded-full border-gray-200"
                        onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="text-xl font-bold w-8 text-center">{itemQuantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 rounded-full border-gray-200"
                        onClick={() => setItemQuantity(itemQuantity + 1)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <DialogFooter className="mt-6">
                  <Button 
                    className="w-full h-12 text-lg font-bold bg-blue-600 hover:bg-blue-700"
                    onClick={() => addToCart(selectedItem, itemQuantity, itemNotes)}
                  >
                    Add to Cart — ${(Number(selectedItem.price) * itemQuantity).toFixed(2)}
                  </Button>
                </DialogFooter>
              </>
            )}
        </DialogContent>
      </Dialog>

      {/* Floating Cart Button (Mobile) */}
      {cart.length > 0 && !isCartOpen && (
        <div className="fixed bottom-6 left-0 right-0 px-4 z-40 md:hidden">
          <Button 
            className="w-full h-14 rounded-2xl shadow-xl bg-blue-600 hover:bg-blue-700 flex items-center justify-between px-6 animate-in fade-in slide-in-from-bottom-4 duration-300"
            onClick={() => setIsCartOpen(true)}
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <ShoppingCart className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="text-xs text-blue-100 font-medium leading-none mb-1">{getTotalItemsCount()} items</p>
                <p className="text-white font-bold leading-none">View Cart</p>
              </div>
            </div>
            <span className="text-white font-bold text-lg">${getTotalAmount().toFixed(2)}</span>
          </Button>
        </div>
      )}
    </div>
  );
}
