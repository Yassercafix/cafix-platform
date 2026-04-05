/**
 * Order Lifecycle Enforcement
 *
 * Valid status transitions per specification:
 * - created → sent_to_kitchen
 * - sent_to_kitchen → preparing
 * - preparing → ready
 * - ready → served
 * - served → paid
 * - created/sent_to_kitchen/preparing → cancelled (before ready)
 * - paid is final (no transitions allowed)
 * - cancelled is final (no transitions allowed)
 */

export type OrderStatus = 
  | "created"
  | "sent_to_kitchen"
  | "preparing"
  | "ready"
  | "served"
  | "paid"
  | "cancelled";

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  created: ["sent_to_kitchen", "cancelled"],
  sent_to_kitchen: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["served"],
  served: ["paid"],
  paid: [],
  cancelled: [],
};

/**
 * Check if a status transition is valid
 */
export function isValidTransition(
  currentStatus: OrderStatus,
  newStatus: OrderStatus
): boolean {
  if (currentStatus === newStatus) return true; // No-op is valid
  return VALID_TRANSITIONS[currentStatus]?.includes(newStatus) || false;
}

/**
 * Get the reason why a transition is invalid
 */
export function getTransitionError(
  currentStatus: OrderStatus,
  newStatus: OrderStatus
): string | null {
  if (currentStatus === newStatus) return null;

  if (currentStatus === "ready" && newStatus === "cancelled") {
    return "Cannot cancel order after it is ready";
  }

  if (currentStatus === "paid") {
    return "Cannot change status of a paid order";
  }

  if (currentStatus === "cancelled") {
    return "Cannot change status of a cancelled order";
  }

  const validNextStates = VALID_TRANSITIONS[currentStatus];
  if (!validNextStates?.includes(newStatus)) {
    return `Cannot transition from ${currentStatus} to ${newStatus}. Valid transitions: ${validNextStates?.join(", ") || "none"}`;
  }

  return null;
}

/**
 * Enforce order status transition
 * Throws error if transition is invalid
 */
export function enforceOrderTransition(
  currentStatus: OrderStatus,
  newStatus: OrderStatus
): void {
  const error = getTransitionError(currentStatus, newStatus);
  if (error) {
    throw new Error(error);
  }
}

/**
 * Check if an order can be cancelled
 */
export function canOrderBeCancelled(status: OrderStatus): boolean {
  return ["created", "sent_to_kitchen", "preparing"].includes(status);
}

/**
 * Check if an order is in a final state
 */
export function isOrderFinal(status: OrderStatus): boolean {
  return ["paid", "cancelled"].includes(status);
}

/**
 * Get all valid next statuses for a given status
 */
export function getValidNextStatuses(status: OrderStatus): OrderStatus[] {
  return VALID_TRANSITIONS[status] || [];
}
