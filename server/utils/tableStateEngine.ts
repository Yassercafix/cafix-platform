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
    paid: "available",
    cancelled: "available",
  };

  return statusMap[orderStatus] || "available";
}

/**
 * Determine table status based on all active orders on that table
 * If multiple orders exist, use the most advanced state
 */
export function getTableStatusFromMultipleOrders(
  orderStatuses: OrderStatus[]
): TableStatus {
  if (orderStatuses.length === 0) {
    return "available";
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
  let resultStatus: TableStatus = "available";

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
  // Only available tables can accept new orders
  return tableStatus === "available";
}

/**
 * Check if table has active orders
 */
export function tableHasActiveOrders(tableStatus: TableStatus): boolean {
  return tableStatus !== "available";
}

/**
 * Get table status display name
 */
export function getTableStatusDisplayName(status: TableStatus): string {
  const displayNames: Record<TableStatus, string> = {
    available: "Available",
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
    available: "green",
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
  return ["served", "available"].includes(tableStatus);
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
    available: 0,
    occupied: 30,
    in_progress: 20,
    ready: 5,
    served: 2,
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
  const validTransitions: Record<TableStatus, TableStatus[]> = {
    available: ["occupied"],
    occupied: ["in_progress", "available"],
    in_progress: ["ready", "available"],
    ready: ["served", "available"],
    served: ["available"],
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
    available: null,
    occupied: "in_progress",
    in_progress: "ready",
    ready: "served",
    served: "available",
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
  return Math.floor(durationMs / (1000 * 60));
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
