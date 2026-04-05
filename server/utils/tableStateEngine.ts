/**
 * Table State Engine
 * Manages table status based on order states
 */

import type { OrderStatus, TableStatus } from "../../drizzle/schema.js";

/**
 * Map order status to table status
 * Determines what table state should be based on order state
 */
export function getTableStatusFromOrderStatus(orderStatus: OrderStatus): TableStatus {
  const statusMap: Record<OrderStatus, TableStatus> = {
    created: "occupied",
    sent_to_kitchen: "occupied",
    preparing: "in_progress",
    ready: "ready",
    served: "served",
    paid: "free",
    cancelled: "free",
  };

  return statusMap[orderStatus] || "free";
}

/**
 * Determine table status based on all active orders on that table
 * If multiple orders exist, use the most advanced state
 */
export function getTableStatusFromMultipleOrders(
  orderStatuses: OrderStatus[]
): TableStatus {
  if (orderStatuses.length === 0) {
    return "free";
  }

  // Priority order: paid/cancelled are final, served, ready, in_progress, occupied
  const statusPriority: Record<OrderStatus, number> = {
    paid: 100,
    cancelled: 100,
    served: 80,
    ready: 60,
    preparing: 40,
    sent_to_kitchen: 30,
    created: 20,
  };

  // Find the highest priority status
  let maxPriority = 0;
  let resultStatus: TableStatus = "free";

  for (const status of orderStatuses) {
    const priority = statusPriority[status] || 0;
    if (priority > maxPriority) {
      maxPriority = priority;
      resultStatus = getTableStatusFromOrderStatus(status);
    }
  }

  return resultStatus;
}

/**
 * Check if table can accept new orders
 */
export function canTableAcceptNewOrder(tableStatus: TableStatus): boolean {
  // Only free tables can accept new orders
  return tableStatus === "free";
}

/**
 * Check if table has active orders
 */
export function tableHasActiveOrders(tableStatus: TableStatus): boolean {
  return tableStatus !== "free";
}

/**
 * Get table status display name
 */
export function getTableStatusDisplayName(status: TableStatus): string {
  const displayNames: Record<TableStatus, string> = {
    free: "Free",
    occupied: "Occupied",
    in_progress: "In Progress",
    ready: "Ready",
    served: "Served",
  };
  return displayNames[status] || status;
}

/**
 * Get table status color (for UI)
 */
export function getTableStatusColor(status: TableStatus): string {
  const colorMap: Record<TableStatus, string> = {
    free: "green",
    occupied: "blue",
    in_progress: "orange",
    ready: "yellow",
    served: "purple",
  };
  return colorMap[status] || "gray";
}

/**
 * Check if table status indicates service is complete
 */
export function isServiceComplete(tableStatus: TableStatus): boolean {
  return ["served", "free"].includes(tableStatus);
}

/**
 * Check if table status indicates active service
 */
export function isServiceActive(tableStatus: TableStatus): boolean {
  return ["occupied", "in_progress", "ready"].includes(tableStatus);
}

/**
 * Get estimated time to complete service based on table status
 * Returns minutes
 */
export function getEstimatedTimeToComplete(tableStatus: TableStatus): number {
  const timeMap: Record<TableStatus, number> = {
    free: 0,
    occupied: 30, // 30 minutes to prepare
    in_progress: 20, // 20 minutes cooking
    ready: 5, // 5 minutes to serve
    served: 2, // 2 minutes to pay
  };
  return timeMap[tableStatus] || 0;
}

/**
 * Validate table status transition
 */
export function isValidTableStatusTransition(
  currentStatus: TableStatus,
  nextStatus: TableStatus
): boolean {
  // Define valid transitions
  const validTransitions: Record<TableStatus, TableStatus[]> = {
    free: ["occupied"],
    occupied: ["in_progress", "free"], // Can go back to free if cancelled
    in_progress: ["ready", "free"], // Can go back to free if cancelled
    ready: ["served", "free"], // Can go back to free if cancelled
    served: ["free"],
  };

  const allowed = validTransitions[currentStatus] || [];
  return allowed.includes(nextStatus);
}

/**
 * Get next expected table status
 */
export function getNextExpectedTableStatus(
  currentStatus: TableStatus
): TableStatus | null {
  const nextMap: Record<TableStatus, TableStatus | null> = {
    free: null,
    occupied: "in_progress",
    in_progress: "ready",
    ready: "served",
    served: "free",
  };
  return nextMap[currentStatus] || null;
}

/**
 * Calculate table occupancy duration in minutes
 */
export function calculateOccupancyDuration(
  startTime: Date,
  endTime: Date = new Date()
): number {
  const durationMs = endTime.getTime() - startTime.getTime();
  return Math.floor(durationMs / (1000 * 60)); // Convert to minutes
}

/**
 * Check if table has been occupied too long (potential issue)
 * Returns true if occupied longer than threshold (in minutes)
 */
export function isTableOccupiedTooLong(
  occupiedSince: Date,
  thresholdMinutes: number = 120
): boolean {
  const duration = calculateOccupancyDuration(occupiedSince);
  return duration > thresholdMinutes;
}
