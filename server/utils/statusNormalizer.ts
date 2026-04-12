/**
 * Status Normalization Utility
 * Maps all backend statuses to 4 normalized statuses:
 * - pending (from: pending, created)
 * - preparing (from: sent_to_kitchen, preparing)
 * - ready (from: ready)
 * - served (from: served)
 */

export type NormalizedStatus = "pending" | "preparing" | "ready" | "served";

export function normalizeStatus(status: string): NormalizedStatus {
  switch (status) {
    case "pending":
    case "created":
      return "pending";
    case "sent_to_kitchen":
    case "preparing":
      return "preparing";
    case "ready":
      return "ready";
    case "served":
      return "served";
    default:
      return "pending";
  }
}

export function normalizeOrder(order: any): any {
  return {
    ...order,
    status: normalizeStatus(order.status),
  };
}

export function normalizeOrders(orders: any[]): any[] {
  return orders.map(normalizeOrder);
}
