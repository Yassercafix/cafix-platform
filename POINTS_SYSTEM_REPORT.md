# Points & Commission System Report

## Overview
The restaurant platform now features a complete points-based economy. This system handles points recharge for cafeterias, automated commission calculations for marketers, and a structured withdrawal process, all governed by owner-controlled conversion rates.

## Core Components

### 1. Points Recharge System
- **Request Flow**: Cafeteria admins can request points by specifying a USD amount. The system automatically calculates the equivalent points based on the current conversion rate.
- **Owner Approval**: Owners review all pending recharge requests. Upon approval, points are instantly credited to the cafeteria's balance.
- **Transaction Logging**: Every point movement is recorded in the `pointTransactions` table, providing a full audit trail of recharges and usage.

### 2. Marketer Commission System
- **Automated Calculation**: When an order is marked as paid, the system automatically calculates the marketer's commission based on their specific percentage.
- **Points Conversion**: Commissions are calculated in USD but stored in points, ensuring consistency across the platform's economy.
- **Status Tracking**: Commissions move through a lifecycle: `pending` (recorded) -> `available` (approved by owner) -> `withdrawn` (paid out).

### 3. Withdrawal Management
- **Marketer Requests**: Marketers can request to withdraw their `available` points. The system calculates the USD payout based on the current exchange rate.
- **Owner Oversight**: Owners approve or reject withdrawal requests. Once approved, the corresponding commission records are marked as `withdrawn`.
- **Payment Confirmation**: Owners can mark withdrawals as "Paid" once the actual funds have been transferred to the marketer.

### 4. Owner Controls (Conversion Rates)
- **Dynamic Rates**: Owners have exclusive control over the conversion rates (e.g., 1 USD = 10 Points).
- **Global Consistency**: All calculations for recharges, commissions, and withdrawals use these owner-defined rates, ensuring a stable business model.

## Database Architecture
- **New Tables**:
    - `conversionRates`: Stores owner-defined exchange rates.
    - `pointTransactions`: Audit log for all point movements.
    - `rechargeRequests`: Tracks points purchase requests from cafeterias.
    - `commissionRecords`: Individual commission entries for every paid order.
    - `withdrawalRequests`: Tracks marketer payout requests.
    - `commissionConfigs`: Stores per-marketer commission percentages.

## Verified Business Logic
1.  **Owner**: Sets rate (1 USD = 10 Points).
2.  **Cafeteria Admin**: Requests $100 recharge -> System calculates 1000 points.
3.  **Owner**: Approves request -> Cafeteria balance increases by 1000 points.
4.  **Customer**: Pays for order -> System calculates 5% commission for Marketer.
5.  **Marketer**: Sees commission in history -> Requests withdrawal once approved.
6.  **Owner**: Approves withdrawal and marks as paid.

**POINTS ECONOMY FULLY OPERATIONAL AND SECURE**
