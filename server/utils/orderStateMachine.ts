/**
 * Order State Machine
 * Enforces strict order status transitions and role-based permissions
 * Normalized to 4 states: pending, preparing, ready, served
 */

import type { OrderStatus } from "../../drizzle/schema.js";

export type UserRole = "owner" | "marketer" | "cafeteria_admin" | "manager" | "waiter" | "chef" | "customer";

/**
 * Valid order state transitions
 * Maps current state to allowed next states
 * 
 * Flow: pending -> preparing -> ready -> served
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["sent_to_kitchen", "preparing", "cancelled"],
  sent_to_kitchen: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["served", "cancelled"],
  served: ["paid"], // Paid is the final accounting state
  paid: [],
  cancelled: [],
  // Legacy states mapping for compatibility during transition
  created: ["pending", "sent_to_kitchen", "preparing", "cancelled"],
};

/**
 * Role-based permissions for state transitions
 * Maps transition to allowed roles
 */
const ROLE_PERMISSIONS: Record<string, UserRole[]> = {
  "pending->sent_to_kitchen": ["waiter", "cafeteria_admin", "manager"],
  "pending->preparing": ["chef", "cafeteria_admin", "manager"],
  "sent_to_kitchen->preparing": ["chef", "cafeteria_admin", "manager"],
  "preparing->ready": ["chef", "cafeteria_admin", "manager"],
  "ready->served": ["waiter", "cafeteria_admin", "manager"],
  "served->paid": ["waiter", "cafeteria_admin", "manager"],
  "pending->cancelled": ["waiter", "cafeteria_admin", "manager"],
  "sent_to_kitchen->cancelled": ["waiter", "cafeteria_admin", "manager"],
  "preparing->cancelled": ["waiter", "cafeteria_admin", "manager"],
  "ready->cancelled": ["manager", "cafeteria_admin"], 
  // Legacy
  "created->pending": ["waiter", "cafeteria_admin", "manager"],
  "created->sent_to_kitchen": ["waiter", "cafeteria_admin", "manager"],
  "created->preparing": ["chef", "cafeteria_admin", "manager"],
};

/**
 * Check if a state transition is valid
 */
export function isValidTransition(
  currentStatus: string,
  nextStatus: string
): boolean {
  const allowedNextStates = VALID_TRANSITIONS[currentStatus as any] || [];
  return allowedNextStates.includes(nextStatus);
}

/**
 * Check if a user role can perform a specific transition
 */
export function canUserPerformTransition(
  currentStatus: string,
  nextStatus: string,
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
    // If no specific role permission defined but transition is valid, 
    // default to admin/manager only for safety
    return ["cafeteria_admin", "manager", "owner"].includes(userRole);
  }

  return allowedRoles.includes(userRole);
}

/**
 * Validate a state transition with detailed error message
 */
export function validateTransition(
  currentStatus: string,
  nextStatus: string,
  userRole: UserRole
): { valid: boolean; error?: string } {
  // Check if transition is valid
  if (!isValidTransition(currentStatus, nextStatus)) {
    const allowedNextStates = VALID_TRANSITIONS[currentStatus as any] || [];
    return {
      valid: false,
      error: `Invalid transition from '${currentStatus}' to '${nextStatus}'. Allowed: ${allowedNextStates.join(", ")}`,
    };
  }

  // Check if user role can perform transition
  if (!canUserPerformTransition(currentStatus, nextStatus, userRole)) {
    const transitionKey = `${currentStatus}->${nextStatus}`;
    const allowedRoles = ROLE_PERMISSIONS[transitionKey] || ["admin"];
    return {
      valid: false,
      error: `Role '${userRole}' is not authorized for transition '${currentStatus}' -> '${nextStatus}'. Required: ${allowedRoles.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Check if an order can be cancelled
 */
export function canBeCancelled(currentStatus: string, userRole: UserRole): boolean {
  if (currentStatus === "ready") {
    return ["manager", "cafeteria_admin"].includes(userRole);
  }
  return ["pending", "created", "preparing", "sent_to_kitchen"].includes(currentStatus);
}

/**
 * Get human-readable state name
 */
export function getStateDisplayName(status: string): string {
  const displayNames: Record<string, string> = {
    pending: "Pending",
    preparing: "Preparing",
    ready: "Ready",
    served: "Served",
    paid: "Paid",
    cancelled: "Cancelled",
    created: "Pending",
    sent_to_kitchen: "Preparing",
  };
  return displayNames[status] || status;
}
