/**
 * Role-Based Action Control
 * Enforces permissions for different user roles in order operations
 */

export type UserRole = "owner" | "marketer" | "cafeteria_admin" | "manager" | "waiter" | "chef" | "customer";

export interface UserContext {
  userId: string;
  role: UserRole;
  cafeteriaId?: string;
  staffId?: string;
}

/**
 * Action types that can be performed on orders
 */
export enum OrderAction {
  CREATE = "create",
  CONFIRM = "confirm", // sent_to_kitchen
  MARK_PREPARING = "mark_preparing",
  MARK_READY = "mark_ready",
  MARK_SERVED = "mark_served",
  MARK_PAID = "mark_paid",
  CANCEL = "cancel",
  VIEW = "view",
  EDIT_ITEMS = "edit_items",
}

/**
 * Role-based permissions matrix
 * Maps role to allowed actions
 */
const ROLE_PERMISSIONS: Record<UserRole, OrderAction[]> = {
  owner: [
    OrderAction.CREATE,
    OrderAction.CONFIRM,
    OrderAction.MARK_PREPARING,
    OrderAction.MARK_READY,
    OrderAction.MARK_SERVED,
    OrderAction.MARK_PAID,
    OrderAction.CANCEL,
    OrderAction.VIEW,
    OrderAction.EDIT_ITEMS,
  ],
  marketer: [
    OrderAction.VIEW,
  ],
  cafeteria_admin: [
    OrderAction.CREATE,
    OrderAction.CONFIRM,
    OrderAction.MARK_PREPARING,
    OrderAction.MARK_READY,
    OrderAction.MARK_SERVED,
    OrderAction.MARK_PAID,
    OrderAction.CANCEL,
    OrderAction.VIEW,
    OrderAction.EDIT_ITEMS,
  ],
  manager: [
    OrderAction.CREATE,
    OrderAction.CONFIRM,
    OrderAction.MARK_PREPARING,
    OrderAction.MARK_READY,
    OrderAction.MARK_SERVED,
    OrderAction.MARK_PAID,
    OrderAction.CANCEL, // Can cancel anytime
    OrderAction.VIEW,
    OrderAction.EDIT_ITEMS,
  ],
  waiter: [
    OrderAction.CREATE,
    OrderAction.CONFIRM,
    OrderAction.MARK_SERVED,
    OrderAction.MARK_PAID,
    OrderAction.CANCEL, // Can cancel before ready
    OrderAction.VIEW,
    OrderAction.EDIT_ITEMS,
  ],
  chef: [
    OrderAction.MARK_PREPARING,
    OrderAction.MARK_READY,
    OrderAction.VIEW,
  ],
  customer: [
    OrderAction.CREATE,
    OrderAction.VIEW,
  ],
};

/**
 * Check if a user can perform an action
 */
export function canUserPerformAction(
  user: UserContext,
  action: OrderAction
): boolean {
  const allowedActions = ROLE_PERMISSIONS[user.role] || [];
  return allowedActions.includes(action);
}

/**
 * Validate user can perform action, throw error if not
 */
export function validateUserAction(
  user: UserContext,
  action: OrderAction
): void {
  if (!canUserPerformAction(user, action)) {
    throw new Error(
      `User role '${user.role}' cannot perform action '${action}'`
    );
  }
}

/**
 * Get all allowed actions for a user role
 */
export function getAllowedActionsForRole(role: UserRole): OrderAction[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if user can view an order
 * Additional context checks can be added here
 */
export function canUserViewOrder(
  user: UserContext,
  orderCafeteriaId: string,
  orderWaiterId?: string
): boolean {
  if (!canUserPerformAction(user, OrderAction.VIEW)) {
    return false;
  }

  // Waiter can only view their own orders
  if (user.role === "waiter" && orderWaiterId && user.staffId !== orderWaiterId) {
    return false;
  }

  // Marketer can only view orders from their cafeterias
  if (user.role === "marketer" && user.cafeteriaId !== orderCafeteriaId) {
    return false;
  }

  return true;
}

/**
 * Check if user can edit order items
 */
export function canUserEditOrderItems(
  user: UserContext,
  orderStatus: string
): boolean {
  if (!canUserPerformAction(user, OrderAction.EDIT_ITEMS)) {
    return false;
  }

  // Can only edit items in "created" state
  return orderStatus === "created";
}

/**
 * Check if user can confirm order
 */
export function canUserConfirmOrder(user: UserContext): boolean {
  return canUserPerformAction(user, OrderAction.CONFIRM);
}

/**
 * Check if user can mark order as preparing
 */
export function canUserMarkPreparing(user: UserContext): boolean {
  return canUserPerformAction(user, OrderAction.MARK_PREPARING);
}

/**
 * Check if user can mark order as ready
 */
export function canUserMarkReady(user: UserContext): boolean {
  return canUserPerformAction(user, OrderAction.MARK_READY);
}

/**
 * Check if user can mark order as served
 */
export function canUserMarkServed(user: UserContext): boolean {
  return canUserPerformAction(user, OrderAction.MARK_SERVED);
}

/**
 * Check if user can mark order as paid
 */
export function canUserMarkPaid(user: UserContext): boolean {
  return canUserPerformAction(user, OrderAction.MARK_PAID);
}

/**
 * Check if user can cancel order
 * Manager can cancel anytime, others only before ready
 */
export function canUserCancelOrder(
  user: UserContext,
  orderStatus: string
): boolean {
  if (!canUserPerformAction(user, OrderAction.CANCEL)) {
    return false;
  }

  // Manager can cancel anytime
  if (user.role === "manager") {
    return true;
  }

  // Others can only cancel before ready
  return ["created", "sent_to_kitchen", "preparing"].includes(orderStatus);
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: UserRole): string {
  const displayNames: Record<UserRole, string> = {
    owner: "Owner",
    marketer: "Marketer",
    cafeteria_admin: "Cafeteria Admin",
    manager: "Manager",
    waiter: "Waiter",
    chef: "Chef",
    customer: "Customer",
  };
  return displayNames[role] || role;
}

/**
 * Get action display name
 */
export function getActionDisplayName(action: OrderAction): string {
  const displayNames: Record<OrderAction, string> = {
    [OrderAction.CREATE]: "Create Order",
    [OrderAction.CONFIRM]: "Confirm Order",
    [OrderAction.MARK_PREPARING]: "Mark as Preparing",
    [OrderAction.MARK_READY]: "Mark as Ready",
    [OrderAction.MARK_SERVED]: "Mark as Served",
    [OrderAction.MARK_PAID]: "Mark as Paid",
    [OrderAction.CANCEL]: "Cancel Order",
    [OrderAction.VIEW]: "View Order",
    [OrderAction.EDIT_ITEMS]: "Edit Items",
  };
  return displayNames[action] || action;
}
