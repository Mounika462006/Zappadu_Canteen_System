import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { Order, CartItem, OrderStatus } from "@/types";
import { toast } from "sonner";
import { useAuth } from "./AuthContext";

interface OrderContextType {
  orders: Order[];
  currentOrder: Order | null;
  placeOrder: (items: CartItem[], paymentMethod: 'pay_now' | 'pay_later', shopId: string) => Promise<Order | null>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  getOrdersByStudent: (studentId: string) => Order[];
  getOrdersByShop: (shopId: string) => Order[];
  getAllOrders: () => Order[];
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);
const API_URL = "http://localhost:5000/api";

export const OrderProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const { user } = useAuth();

  // Helper to parse dates in incoming order structures
  const parseOrderDates = (ord: any): Order => ({
    ...ord,
    createdAt: new Date(ord.createdAt),
    updatedAt: new Date(ord.updatedAt),
    estimatedReadyTime: new Date(ord.estimatedReadyTime)
  });

  // Automated polling to get live order updates every 5 seconds
  useEffect(() => {
    if (!user) {
      setOrders([]);
      return;
    }

    const fetchOrders = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        let endpoint = "";
        if (user.role === "student") {
          endpoint = `${API_URL}/orders/student/${user.id}`;
        } else if (user.role === "shop_owner" && user.shopId) {
          endpoint = `${API_URL}/orders/shop/${user.shopId}`;
        } else {
          return;
        }

        const res = await fetch(endpoint, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          const parsed = data.map(parseOrderDates);
          
          // Check for status changes to display appropriate pop-ups
          if (orders.length > 0 && user.role === "student") {
            parsed.forEach((newOrd: Order) => {
              const oldOrd = orders.find(o => o.id === newOrd.id);
              if (oldOrd && oldOrd.status !== newOrd.status) {
                const statusMessages: Record<OrderStatus, string> = {
                  pending: "Order is pending",
                  accepted: "Order accepted by shop!",
                  preparing: "Your order is being prepared",
                  ready: "🔔 Your order is ready for pickup!",
                  collected: "Order collected. Enjoy your meal!",
                  cancelled: "Order has been cancelled",
                };
                toast.info(statusMessages[newOrd.status] || `Order is ${newOrd.status}`);
              }
            });
          }

          setOrders(parsed);
          
          // Sync currentOrder if set
          if (currentOrder) {
            const updatedCurrent = parsed.find((o: Order) => o.id === currentOrder.id);
            if (updatedCurrent) {
              setCurrentOrder(updatedCurrent);
            }
          }
        }
      } catch (error) {
        console.error("Failed to poll orders:", error);
      }
    };

    fetchOrders(); // Initial fetch
    const interval = setInterval(fetchOrders, 5000); // Poll every 5s

    return () => clearInterval(interval);
  }, [user, orders.length, currentOrder?.id]);

  const placeOrder = async (items: CartItem[], paymentMethod: 'pay_now' | 'pay_later', shopId: string): Promise<Order | null> => {
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Please login to place your order");
      return null;
    }

    try {
      const res = await fetch(`${API_URL}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ items, paymentMethod, shopId })
      });

      const data = await res.json();
      if (res.ok) {
        const parsed = parseOrderDates(data);
        setOrders((prev) => [parsed, ...prev]);
        setCurrentOrder(parsed);
        toast.success(`Order #${parsed.id} placed!`);
        return parsed;
      } else {
        toast.error(data.error || "Failed to place order");
        return null;
      }
    } catch (error) {
      console.error("Place order failed:", error);
      toast.error("Failed to place order. Connection error.");
      return null;
    }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      const data = await res.json();
      if (res.ok) {
        setOrders((prev) =>
          prev.map((order) =>
            order.id === orderId
              ? { 
                  ...order, 
                  status: data.status, 
                  paymentStatus: data.paymentStatus, 
                  updatedAt: new Date() 
                }
              : order
          )
        );
        if (currentOrder?.id === orderId) {
          setCurrentOrder((prev) => (prev ? { ...prev, status: data.status, paymentStatus: data.paymentStatus } : null));
        }

        const statusMessages: Record<OrderStatus, string> = {
          pending: "Order is pending",
          accepted: "Order accepted by shop!",
          preparing: "Your order is being prepared",
          ready: "🔔 Your order is ready for pickup!",
          collected: "Order collected. Enjoy your meal!",
          cancelled: "Order has been cancelled",
        };
        toast.success(statusMessages[status]);
      } else {
        toast.error(data.error || "Failed to update order status");
      }
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error("Network error updating order status");
    }
  };

  const getOrdersByStudent = (studentId: string) =>
    orders.filter((order) => order.studentId === studentId);

  const getOrdersByShop = (shopId: string) =>
    orders.filter((order) => order.shopId === shopId);

  const getAllOrders = () => orders;

  return (
    <OrderContext.Provider
      value={{ 
        orders, 
        currentOrder, 
        placeOrder, 
        updateOrderStatus, 
        getOrdersByStudent, 
        getOrdersByShop, 
        getAllOrders 
      }}
    >
      {children}
    </OrderContext.Provider>
  );
};

export const useOrders = () => {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error("useOrders must be used within an OrderProvider");
  }
  return context;
};
