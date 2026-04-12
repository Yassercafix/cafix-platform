/**
 * Order State Machine
 * Enforces strict order status transitions and role-based permissions
 */

import type { OrderStatus } from "../../drizzle/schema.js";

export type UserRole = "owner" | "marketer" | "cafeteria_admin" | "manager" | "waiter" | "chef" | "customer";

/**
 * Valid order state transitions
 * Maps current state to allowed next states
 */
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["created", "sent_to_kitchen", "cancelled"],
  created: ["sent_to_kitchen", "cancelled"],
  sent_to_kitchen: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["served"],
  served: ["paid"],
  paid: [],
  cancelled: [],
};

/**
 * Role-based permissions for state transitions
 * Maps transition to allowed roles
 */
const ROLE_PERMISSIONS: Record<string, UserRole[]> = {
  "pending->created": ["waiter", "cafeteria_admin", "manager"],
  "pending->sent_to_kitchen": ["waiter", "cafeteria_admin", "manager"],
  "pending->cancelled": ["waiter", "cafeteria_admin", "manager"],
  "created->sent_to_kitchen": ["waiter", "cafeteria_admin", "manager"],
  "sent_to_kitchen->preparing": ["chef", "cafeteria_admin", "manager"],
  "preparing->ready": ["chef", "cafeteria_admin", "manager"],
  "ready->served": ["waiter", "cafeteria_admin", "manager"],
  "served->paid": ["waiter", "cafeteria_admin", "manager"],
  "created->cancelled": ["waiter", "cafeteria_admin", "manager"],
  "sent_to_kitchen->cancelled": ["waiter", "cafeteria_admin", "manager"],
  "preparing->cancelled": ["waiter", "cafeteria_admin", "manager"],
  "ready->cancelled": ["manager"], // Only manager can cancel after ready
};

/**
 * Check if a state transition is valid
 */
export function isValidTransition(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus
): boolean {
  const allowedNextStates = VALID_TRANSITIONS[currentStatus];
  return allowedNextStates.includes(nextStatus);
}

/**
 * Check if a user role can perform a specific transition
 */
export function canUserPerformTransition(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
  userRole: UserRole
): boolean {
  // First check if transition is valid
  if (!isValidTransition(currentStatus, nextStatus)) {
    return false;
  }

  // Then check role permissions
  const transitionKey = `${currentStatus}->${nextStatus}`;
  const allowedRoles = ROLE_PERMISSIONS[transitionKey];

  if (!allowedRoles) {
    return false;
  }

  return allowedRoles.includes(userRole);
}

/**
 * Get all valid next states for a given current state
 */
export function getValidNextStates(currentStatus: OrderStatus): OrderStatus[] {
  return VALID_TRANSITIONS[currentStatus] || [];
}

/**
 * Get allowed roles for a specific transition
 */
export function getAllowedRolesForTransition(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus
): UserRole[] {
  if (!isValidTransition(currentStatus, nextStatus)) {
    return [];
  }

  const transitionKey = `${currentStatus}->${nextStatus}`;
  return ROLE_PERMISSIONS[transitionKey] || [];
}

/**
 * Validate a state transition with detailed error message
 */
export function validateTransition(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
  userRole: UserRole
): { valid: boolean; error?: string } {
  // Check if transition is valid
  if (!isValidTransition(currentStatus, nextStatus)) {
    const validStates = getValidNextStates(currentStatus);
    return {
      valid: false,
      error: `Cannot transition from ${currentStatus} to ${nextStatus}. Valid states: ${validStates.join(", ")}`,
    };
  }

  // Check if user role can perform transition
  if (!canUserPerformTransition(currentStatus, nextStatus, userRole)) {
    const allowedRoles = getAllowedRolesForTransition(currentStatus, nextStatus);
    return {
      valid: false,
      error: `Role '${userRole}' cannot transition from ${currentStatus} to ${nextStatus}. Allowed roles: ${allowedRoles.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Get the next required state after current state
 * Useful for auto-progression workflows
 */
export function getNextRequiredState(currentStatus: OrderStatus): OrderStatus | null {
  const nextStates = getValidNextStates(currentStatus);
  if (nextStates.length === 1) {
    return nextStates[0];
  }
  return null;
}

/**
 * Check if an order can be cancelled
 */
export function canBeCancelled(currentStatus: OrderStatus, userRole: UserRole): boolean {
  if (currentStatus === "ready") {
    // Only manager can cancel after ready
    return userRole === "manager";
  }

  // Can cancel before ready
  return ["created", "sent_to_kitchen", "preparing"].includes(currentStatus);
}

/**
 * Check if order is in a final state
 */
export function isFinalState(status: OrderStatus): boolean {
  return ["paid", "cancelled"].includes(status);
}

/**
 * Check if order is still in progress
 */
export function isInProgress(status: OrderStatus): boolean {
  return !isFinalState(status);
}

/**
 * Get human-readable state name
 */
export function getStateDisplayName(status: OrderStatus): string {
  const displayNames: Record<OrderStatus, string> = {
    pending: "Pending Approval",
    created: "Created",
    sent_to_kitchen: "Sent to Kitchen",
    preparing: "Preparing",
    ready: "Ready",
    served: "Served",
    paid: "Paid",
    cancelled: "Cancelled",
  };
  return displayNames[status] || status;
}

/**
 * Get state progression percentage (0-100)
 */
export function getStateProgress(status: OrderStatus): number {
  const progressMap: Record<OrderStatus, number> = {
    pending: 5,
    created: 10,
    sent_to_kitchen: 25,
    preparing: 40,
    ready: 60,
    served: 80,
    paid: 100,
    cancelled: 0,
  };
  return progressMap[status] || 0;
}
