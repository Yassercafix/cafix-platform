# Quick Start Guide for Cafeteria System

This guide provides minimal steps to get the Cafeteria System running locally and perform basic tests.

## 1. Local Setup

1.  **Clone Repository**: Clone the project to your local machine.
2.  **Install Dependencies**: Navigate to the project root and run `pnpm install`.
3.  **Environment Variables**: Copy `.env.example` to `.env` and fill in the `DATABASE_URL` for your local PostgreSQL database and the Supabase credentials (you can use placeholder values for `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` if you don't have a live Supabase project yet, but some features will not work).
4.  **Database Migration**: Run `pnpm drizzle-kit push:pg` to apply the database schema.
5.  **Seed Data (Optional)**: Run `pnpm seed` to populate your database with test data.
6.  **Start Development Server**: Run `pnpm dev` to start the frontend and backend.

## 2. Test Login

1.  Open your browser to `http://localhost:3000/login`.
2.  Use a test user's email and password (e.g., from your seeded data or a manually created Supabase user) to log in.
3.  Verify that you are redirected to the correct dashboard based on the user's role.

## 3. Test Recharge (Requires Supabase Project)

1.  Ensure you have a Supabase project configured with a `recharge-attachments` bucket and RLS policies.
2.  Log in as a `cafeteria_admin`.
3.  Navigate to the recharge page (e.g., `/dashboard/cafeteria-admin/recharge`).
4.  Fill in the recharge details and upload an image or PDF file.
5.  Submit the request and verify that the file is uploaded to your Supabase Storage bucket and the recharge request in the database contains the file's URL/path instead of base64 data.
