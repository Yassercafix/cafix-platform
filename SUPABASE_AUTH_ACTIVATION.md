# Supabase Auth Activation Guide

This document outlines the steps taken to activate Supabase Auth as the primary authentication system for the Cafeteria Project and the remaining steps for live activation.

## 1. Changes Implemented

The following components have been switched from the legacy custom auth to Supabase Auth:

### Backend
*   **tRPC Context:** Switched from `context.ts` to `context-supabase.ts` in `server/_core/index.ts`.
*   **tRPC Middleware:** Updated `server/_core/trpc.ts` to use the Supabase-based context and ensure role-based procedures (owner, marketer, cafeteria admin, staff) work correctly with Supabase-resolved users.
*   **Auth Router:** The system now primarily uses the `authSupabaseRouter` for login, logout, and session management.

### Frontend
*   **useAuth Hook:** Completely rewritten to use `trpc.authSupabase.me` and the Supabase client (`supabase.auth.onAuthStateChange`) for real-time session management and persistence.
*   **Login Page:** `Login.tsx` has been updated to perform a dual-authentication flow:
    1.  Authenticates with Supabase Auth directly in the frontend (for session/token management).
    2.  Calls the backend `authSupabase.login` to set the secure session cookie (`app_session_id`).
*   **Protected Routes:** Maintained existing RBAC (Role-Based Access Control) logic while integrating with the new auth hook.

## 2. Required Environment Variables

The following variables must be set in your `.env` file for the system to function:

| Variable | Description |
| :--- | :--- |
| `VITE_SUPABASE_URL` | Your Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase Anonymous Key (Client-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase Service Role Key (Server-side, keep secret) |
| `SUPABASE_JWT_SECRET` | Your Supabase JWT Secret (for manual token verification) |

## 3. Required Supabase Settings

1.  **Disable Self-Signup:** In Supabase Dashboard > Auth > Settings, disable "Allow new users to sign up". This system only supports parent-created accounts.
2.  **Email Templates:** (Optional) Customize email templates for password resets if needed.
3.  **RLS Policies:** Ensure your database tables (`users`, `marketers`, etc.) have appropriate RLS policies if you plan to use direct Supabase client queries, though this implementation primarily uses tRPC.

## 4. Migration Steps from Legacy Auth

To migrate existing users from the legacy system to Supabase Auth:

1.  **Export Users:** Export existing users from the `users`, `marketers`, `cafeterias`, and `cafeteriaStaff` tables.
2.  **Create Supabase Users:** Use the Supabase Admin SDK or Dashboard to create corresponding users in Supabase Auth with the same email addresses.
3.  **Sync IDs:** Ensure the `email` in Supabase Auth matches the `email` (or `loginUsername`) in your database tables. The current implementation resolves users by email.

## 5. Remaining Activation & Testing Steps

1.  **Provision Supabase Project:** Ensure a Supabase project is active and accessible.
2.  **Update `.env`:** Fill in the variables listed in section 2.
3.  **Test Login:** Attempt to login with a user that exists in both Supabase Auth and the application database.
4.  **Verify Roles:** Navigate to different dashboards (`/dashboard/owner`, `/dashboard/marketer`, etc.) to ensure RBAC is correctly enforcing access based on the database role.
5.  **Verify Session Persistence:** Refresh the page or close/reopen the browser to ensure the session remains active via the `app_session_id` cookie and Supabase client state.
