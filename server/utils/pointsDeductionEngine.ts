/**
 * Points Deduction Engine
 * Handles points deduction from cafeteria wallet when order is paid
 */

import { addPrecise, subtractPrecise, roundTo } from "./precision.js";

export interface PointsDeductionRequest {
  orderId: string;
  cafeteriaId: string;
  totalAmount: string | number;
  timestamp?: Date;
}

export interface PointsDeductionResult {
  success: boolean;
  orderId: string;
  cafeteriaId: string;
  amountDeducted: string;
  previousBalance: string;
  newBalance: string;
  transactionId: string;
  timestamp: Date;
  error?: string;
}

/**
 * Validate points deduction request
 */
export function validateDeductionRequest(
  request: PointsDeductionRequest
): { valid: boolean; error?: string } {
  if (!request.orderId) {
    return { valid: false, error: "Order ID is required" };
  }

  if (!request.cafeteriaId) {
    return { valid: false, error: "Cafeteria ID is required" };
  }

  const amount = typeof request.totalAmount === 'string' ? parseFloat(request.totalAmount) : request.totalAmount;
  if (isNaN(amount)) {
    return { valid: false, error: "Invalid amount" };
  }

  if (amount < 0) {
    return { valid: false, error: "Amount cannot be negative" };
  }

  if (amount === 0) {
    return { valid: false, error: "Amount must be greater than zero" };
  }

  return { valid: true };
}

/**
 * Calculate points to deduct
 * Points = order total amount (1:1 ratio)
 */
export function calculatePointsToDeduct(totalAmount: string | number): string {
  return String(roundTo(totalAmount, 2));
}

/**
 * Check if cafeteria has sufficient points
 */
export function hasSufficientPoints(
  currentBalance: string | number,
  requiredAmount: string | number
): boolean {
  const balance = typeof currentBalance === 'string' ? parseFloat(currentBalance) : currentBalance;
  const required = typeof requiredAmount === 'string' ? parseFloat(requiredAmount) : requiredAmount;
  return (isNaN(balance) ? 0 : balance) >= (isNaN(required) ? 0 : required);
}

/**
 * Calculate new balance after deduction
 */
export function calculateNewBalance(
  currentBalance: string | number,
  amountToDeduct: string | number
): string {
  return String(subtractPrecise(currentBalance, amountToDeduct));
}

/**
 * Check if deduction was already performed (idempotency check)
 * Should check if order already has paidAt timestamp
 */
export function hasAlreadyBeenDeducted(paidAt: Date | null): boolean {
  return paidAt !== null && paidAt !== undefined;
}

/**
 * Generate transaction ID for audit trail
 */
export function generateTransactionId(orderId: string, cafeteriaId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `DEDUCT-${cafeteriaId}-${orderId}-${timestamp}-${random}`;
}

/**
 * Format points amount for display
 */
export function formatPointsAmount(amount: string | number): string {
  return String(roundTo(amount, 2));
}

/**
 * Validate points balance after deduction
 * Ensures balance doesn't go negative
 */
export function validateBalanceAfterDeduction(
  currentBalance: string | number,
  amountToDeduct: string | number
): { valid: boolean; error?: string } {
  const balance = typeof currentBalance === 'string' ? parseFloat(currentBalance) : currentBalance;
  const deduction = typeof amountToDeduct === 'string' ? parseFloat(amountToDeduct) : amountToDeduct;

  if ((isNaN(balance) ? 0 : balance) < (isNaN(deduction) ? 0 : deduction)) {
    return {
      valid: false,
      error: `Insufficient points. Current balance: ${balance}, Required: ${deduction}`,
    };
  }

  return { valid: true };
}

/**
 * Create audit log entry for points deduction
 */
export function createAuditLogEntry(
  result: PointsDeductionResult
): Record<string, unknown> {
  return {
    type: "POINTS_DEDUCTION",
    orderId: result.orderId,
    cafeteriaId: result.cafeteriaId,
    amountDeducted: result.amountDeducted,
    previousBalance: result.previousBalance,
    newBalance: result.newBalance,
    transactionId: result.transactionId,
    timestamp: result.timestamp,
    success: result.success,
  };
}

/**
 * Check if points deduction is allowed
 * Should only be allowed when order status is "paid"
 */
export function isDeductionAllowed(
  orderStatus: string,
  alreadyDeducted: boolean
): { allowed: boolean; reason?: string } {
  if (orderStatus !== "paid") {
    return {
      allowed: false,
      reason: `Points can only be deducted when order status is 'paid', current status: ${orderStatus}`,
    };
  }

  if (alreadyDeducted) {
    return {
      allowed: false,
      reason: "Points have already been deducted for this order",
    };
  }

  return { allowed: true };
}

/**
 * Calculate refund amount (if needed)
 * Note: Current system doesn't support refunds, but this is here for future use
 */
export function calculateRefundAmount(
  deductedAmount: string | number,
  refundPercentage: number = 100
): string {
  const amount = typeof deductedAmount === 'string' ? parseFloat(deductedAmount) : deductedAmount;
  const refund = (isNaN(amount) ? 0 : amount) * (refundPercentage / 100);
  return String(roundTo(refund, 2));
}

/**
 * Get points deduction summary for display
 */
export function getDeductionSummary(
  totalAmount: string | number,
  currentBalance: string | number,
  newBalance: string | number
): {
  totalAmount: string;
  pointsDeducted: string;
  previousBalance: string;
  newBalance: string;
  balanceChange: string;
} {
  const total = roundTo(totalAmount, 2);
  const previous = roundTo(currentBalance, 2);
  const updated = roundTo(newBalance, 2);
  const change = subtractPrecise(updated, previous);

  return {
    totalAmount: String(total),
    pointsDeducted: String(total),
    previousBalance: String(previous),
    newBalance: String(updated),
    balanceChange: String(change),
  };
}
