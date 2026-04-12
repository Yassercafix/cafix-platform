# Auth + Identity Safety Audit Report

## 1. Global Email Uniqueness
The system now enforces global email uniqueness at the application level across all identity tables. Before this fix, uniqueness was only checked within each table individually.

| Table | Unique Identifier(s) | Global Uniqueness Enforced? |
|-------|----------------------|----------------------------|
| users | openId (Unique), loginUsername (Unique) | Yes (Cross-checked) |
| marketers | loginUsername (Unique), referenceCode (Unique) | Yes (Cross-checked) |
| cafeterias | loginUsername (Unique), referenceCode (Unique) | Yes (Cross-checked) |
| cafeteriaStaff | loginUsername (Unique), referenceCode (Unique) | Yes (Cross-checked) |

## 2. Duplicate Login Identities
Duplicate login identities are now prevented across all creation flows.

- **Staff Creation**: Already had manual checks across all tables.
- **Marketer Creation**: Added manual checks across `marketers`, `cafeterias`, `cafeteriaStaff`, and `users`.
- **Cafeteria Creation**: Added manual checks across `marketers`, `cafeterias`, `cafeteriaStaff`, and `users`.

## 3. Login Resolution Safety
The login process uses the user's role and metadata to resolve the correct identity. By preventing duplicate emails across all tables, we ensure that a single email always points to a unique record in a specific table.

- **Isolation**: A waiter in Cafeteria 1 cannot be confused with a chef in Cafeteria 2 because their `cafeteriaId` is explicitly stored in their staff record and used in all queries.

## 4. Final Assessment
**SYSTEM SAFE** (After applying fixes)

The fixes ensure that:
1. No two entities can share the same login email/username.
2. Roles and cafeteria contexts are strictly isolated.

**Commit Hash**: 76afd64 (Re-applied)
