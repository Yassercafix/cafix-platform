import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { ShoppingCart, ChevronDown, ChevronUp, Trash2, Plus, Minus, Bell, Utensils } from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  available: boolean | null;
  image?: string | null;
}

interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  selectedForPayment?: boolean;
}

export default function CustomerMenu() {
  const { tableToken } = useParams<{ tableToken: string }>();
  const [, navigate] = useLocation();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMode, setPaymentMode] = useState<'full' | 'partial'>('full');
  const [cartExpanded, setCartExpanded] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: table, isLoading: isLoadingTable, error: tableError } = trpc.qrOrders.resolveTableByToken.useQuery(
    { token: tableToken || "" },
    { enabled: !!tableToken }
  );

  const { data: menuData, isLoading: isLoadingMenu, error: menuError } = trpc.menu.getMenuItems.useQuery(
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

  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  useEffect(() => {
    if (tableError) {
      toast.error(tableError.message || "Failed to load table");
    }
  }, [tableError]);

  useEffect(() => {
    if (menuError) {
      toast.error(menuError.message || "Failed to load menu");
    }
  }, [menuError]);

  useEffect(() => {
    if (menuData) {
      const grouped: Record<string, any> = {};
      menuData.forEach((item: any) => {
        if (!grouped[item.categoryId]) {
          grouped[item.categoryId] = {
            id: item.categoryId,
            name: item.categoryName,
            items: [],
          };
        }
        grouped[item.categoryId].items.push(item);
      });
      const categoriesArray = Object.values(grouped);
      setCategories(categoriesArray);
      setMenuItems(menuData as any);
      if (categoriesArray.length > 0 && !selectedCategory) {
        setSelectedCategory(categoriesArray[0].id);
      }
    }
  }, [menuData]);

  const addToCart = (item: MenuItem) => {
    const existingItem = cart.find((ci) => ci.menuItemId === item.id);
    if (existingItem) {
      setCart(
        cart.map((ci) =>
          ci.menuItemId === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        )
      );
    } else {
      setCart([
        ...cart,
        {
          menuItemId: item.id,
          name: item.name,
          price: Number(item.price),
          quantity: 1,
          selectedForPayment: paymentMode === 'full' ? true : false,
        },
      ]);
    }
    toast.success(`${item.name} added to cart`);
  };

  const removeFromCart = (menuItemId: string) => {
    setCart(cart.filter((ci) => ci.menuItemId !== menuItemId));
  };

  const updateQuantity = (menuItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(menuItemId);
    } else {
      setCart(
        cart.map((ci) =>
          ci.menuItemId === menuItemId ? { ...ci, quantity } : ci
        )
      );
    }
  };

  const toggleItemForPayment = (menuItemId: string) => {
    setCart(
      cart.map((ci) =>
        ci.menuItemId === menuItemId
          ? { ...ci, selectedForPayment: !ci.selectedForPayment }
          : ci
      )
    );
  };

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const getPaymentAmount = () => {
    if (paymentMode === 'full') {
      return getTotalAmount();
    }
    return cart
      .filter((item) => item.selectedForPayment)
      .reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const getRemainingAmount = () => {
    return getTotalAmount() - getPaymentAmount();
  };

  const submitOrder = async () => {
    if (cart.length === 0) {
      toast.error("Please add items to your order");
      return;
    }

    if (paymentMode === 'partial' && getPaymentAmount() === 0) {
      toast.error("Please select at least one item to pay");
      return;
    }

    const itemsToSubmit = paymentMode === 'full'
      ? cart.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
        }))
      : cart
          .filter((item) => item.selectedForPayment)
          .map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
          }));

    createOrderMutation.mutate({
      token: tableToken || "",
      items: itemsToSubmit,
    });
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
        <Card className="p-8 text-center w-full max-w-md">
          <h1 className="text-2xl font-bold mb-4">Invalid Table</h1>
          <p className="text-gray-600">The table token is invalid or expired.</p>
        </Card>
      </div>
    );
  }

  const currentCategory = categories.find((c) => c.id === selectedCategory);

  return (
    <div className="min-h-screen bg-gray-50 pb-32 md:pb-8">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-20 shadow-sm">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">
              {table.cafeteriaName || 'Cafe'}
            </h1>
            <p className="text-sm text-gray-600">Table {table.tableNumber}</p>
          </div>
          <Badge variant="secondary" className="text-lg px-3 py-2 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            {cart.length}
          </Badge>
        </div>
      </div>

      <div className="px-4 py-6 md:grid md:grid-cols-3 md:gap-6 md:max-w-7xl md:mx-auto">
        {/* Menu Section */}
        <div className="md:col-span-2 space-y-4">
          {/* Service Actions */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Button
              variant="outline"
              className={`h-16 flex flex-col items-center justify-center gap-1 border-2 ${
                isRequestPending("call_waiter") ? "border-yellow-400 bg-yellow-50" : "border-blue-100"
              }`}
              onClick={() => handleServiceRequest("call_waiter")}
              disabled={createServiceRequestMutation.isPending || isRequestPending("call_waiter")}
            >
              <Bell className={`w-5 h-5 ${isRequestPending("call_waiter") ? "text-yellow-600" : "text-blue-600"}`} />
              <span className="text-xs font-bold">
                {isRequestPending("call_waiter") ? "Waiter Called" : "Call Waiter"}
              </span>
            </Button>
            <Button
              variant="outline"
              className={`h-16 flex flex-col items-center justify-center gap-1 border-2 ${
                isRequestPending("clean_table") ? "border-yellow-400 bg-yellow-50" : "border-blue-100"
              }`}
              onClick={() => handleServiceRequest("clean_table")}
              disabled={createServiceRequestMutation.isPending || isRequestPending("clean_table")}
            >
              <Utensils className={`w-5 h-5 ${isRequestPending("clean_table") ? "text-yellow-600" : "text-blue-600"}`} />
              <span className="text-xs font-bold">
                {isRequestPending("clean_table") ? "Cleaning Requested" : "Request Cleaning"}
              </span>
            </Button>
          </div>
          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                  selectedCategory === category.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-400'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          {/* Menu Items Grid */}
          {currentCategory && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentCategory.items.map((item: MenuItem) => (
                <Card
                  key={item.id}
                  className={`p-4 transition-all ${
                    !item.available ? 'opacity-50' : 'hover:shadow-lg'
                  }`}
                >
                  {item.image && (
                    <div className="w-full h-32 bg-gray-200 rounded-lg mb-3 overflow-hidden">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-gray-800">{item.name}</h3>
                    <Badge variant="secondary" className="text-sm font-bold">
                      ${Number(item.price).toFixed(2)}
                    </Badge>
                  </div>
                  {item.description && (
                    <p className="text-xs text-gray-600 mb-3 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  <Button
                    onClick={() => addToCart(item)}
                    disabled={!item.available}
                    className={`w-full h-12 font-semibold text-base ${
                      item.available
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {item.available ? (
                      <div className="flex items-center justify-center gap-2">
                        <Plus className="w-5 h-5" />
                        Add
                      </div>
                    ) : (
                      'Unavailable'
                    )}
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Cart Section - Mobile Bottom Sheet / Desktop Sidebar */}
        <div className={`fixed bottom-0 left-0 right-0 md:static md:col-span-1 ${
          cartExpanded ? 'h-auto' : 'h-20'
        } md:h-auto bg-white md:bg-transparent border-t md:border-0 shadow-lg md:shadow-none z-30 transition-all duration-300`}>
          {/* Mobile Header */}
          <div className="md:hidden flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Your Order ({cart.length})
            </h2>
            <button
              onClick={() => setCartExpanded(!cartExpanded)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              {cartExpanded ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronUp className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Cart Content */}
          {cartExpanded && (
            <div className="p-4 md:p-6 md:sticky md:top-24 md:bg-white md:rounded-lg md:border md:border-gray-200 md:shadow-sm">
              <h2 className="hidden md:block text-lg font-bold mb-4">Your Order</h2>

              {cart.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No items selected
                </p>
              ) : (
                <>
                  {/* Payment Mode Toggle */}
                  <div className="mb-4 flex gap-2">
                    <button
                      onClick={() => setPaymentMode('full')}
                      className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all text-sm ${
                        paymentMode === 'full'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Pay All
                    </button>
                    <button
                      onClick={() => setPaymentMode('partial')}
                      className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all text-sm ${
                        paymentMode === 'partial'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Pay Partial
                    </button>
                  </div>

                  {/* Cart Items */}
                  <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                    {cart.map((item) => (
                      <div
                        key={item.menuItemId}
                        className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        {paymentMode === 'partial' && (
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="checkbox"
                              checked={item.selectedForPayment || false}
                              onChange={() => toggleItemForPayment(item.menuItemId)}
                              className="w-5 h-5 rounded cursor-pointer accent-blue-600"
                            />
                            <span className="text-xs text-gray-600 font-medium">
                              Select for payment
                            </span>
                          </div>
                        )}

                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="font-medium text-sm text-gray-800">
                              {item.name}
                            </p>
                            <p className="text-xs text-gray-600">
                              ${item.price.toFixed(2)} × {item.quantity}
                            </p>
                          </div>
                          <p className="font-bold text-sm text-gray-800">
                            ${(item.price * item.quantity).toFixed(2)}
                          </p>
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-300">
                            <button
                              onClick={() =>
                                updateQuantity(item.menuItemId, item.quantity - 1)
                              }
                              className="p-1 hover:bg-gray-100 transition-colors"
                            >
                              <Minus className="w-4 h-4 text-gray-600" />
                            </button>
                            <span className="w-8 text-center text-sm font-bold">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                updateQuantity(item.menuItemId, item.quantity + 1)
                              }
                              className="p-1 hover:bg-gray-100 transition-colors"
                            >
                              <Plus className="w-4 h-4 text-gray-600" />
                            </button>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.menuItemId)}
                            className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Summary */}
                  <div className="border-t pt-4 mb-4 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-semibold text-gray-800">
                        ${getTotalAmount().toFixed(2)}
                      </span>
                    </div>

                    {paymentMode === 'partial' && (
                      <>
                        <div className="flex justify-between items-center text-sm bg-blue-50 p-2 rounded-lg">
                          <span className="text-blue-700 font-medium">For Payment:</span>
                          <span className="font-bold text-blue-700">
                            ${getPaymentAmount().toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm bg-amber-50 p-2 rounded-lg">
                          <span className="text-amber-700 font-medium">Remaining:</span>
                          <span className="font-bold text-amber-700">
                            ${getRemainingAmount().toFixed(2)}
                          </span>
                        </div>
                      </>
                    )}

                    <div className="flex justify-between items-center text-lg font-bold pt-2 border-t">
                      <span>Total:</span>
                      <span className="text-blue-600">
                        ${paymentMode === 'full' ? getTotalAmount().toFixed(2) : getPaymentAmount().toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <Button
                      onClick={submitOrder}
                      disabled={
                        (createOrderMutation as any).isPending ||
                        cart.length === 0 ||
                        (paymentMode === 'partial' && getPaymentAmount() === 0)
                      }
                      className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold text-base"
                    >
                      {(createOrderMutation as any).isPending
                        ? 'Submitting...'
                        : paymentMode === 'full'
                        ? 'Pay Now'
                        : 'Pay Selected'}
                    </Button>
                    <Button
                      onClick={() => setCart([])}
                      variant="outline"
                      className="w-full h-12 font-medium"
                    >
                      Clear Cart
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
