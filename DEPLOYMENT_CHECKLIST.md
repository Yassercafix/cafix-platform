# Deployment Checklist for Cafeteria System

This checklist outlines the essential steps for deploying the Cafeteria System.

## Supabase Setup

1.  **Create Supabase Project**: Set up a new project on Supabase.
2.  **Database Migration**: Apply your Drizzle migrations to the Supabase database.
3.  **Disable Self-Signup**: In Supabase Dashboard > Auth > Settings, disable "Allow new users to sign up".
4.  **Create Storage Bucket**: Create a new storage bucket named `recharge-attachments`.
5.  **Configure RLS for Storage**: Set up Row Level Security (RLS) policies for the `recharge-attachments` bucket to allow authenticated users to upload files.
6.  **Create Users**: Manually create initial users (e.g., owner, marketer, cafeteria admin) in Supabase Auth. Ensure their emails match the `users` table in your database.

## Environment Variables

1.  **Update `.env`**: Copy `.env.example` to `.env` and fill in all required values:
    *   `VITE_SUPABASE_URL`
    *   `VITE_SUPABASE_ANON_KEY`
    *   `SUPABASE_SERVICE_ROLE_KEY`
    *   `SUPABASE_JWT_SECRET`
    *   `DATABASE_URL`
    *   `VITE_APP_BASE_URL` (set to your deployed application URL)
2.  **Vercel Environment Variables**: For Vercel deployment, ensure these variables are set in your Vercel project settings.

## Deployment

1.  **Deploy to Vercel**: Deploy the frontend and backend to Vercel (or your preferred hosting provider).

## Post-Deployment

1.  **Test Login**: Verify that users can log in with their Supabase credentials.
2.  **Test Recharge**: Confirm that recharge requests can be created and attachments are uploaded to Supabase Storage.
3.  **Test Role-Based Access**: Ensure different roles can access their respective dashboards and are blocked from unauthorized areas.
