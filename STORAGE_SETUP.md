# Supabase Storage Setup for Recharge Attachments

This document outlines the configuration required for the Supabase Storage migration in the Cafeteria Project.

## 1. Bucket Configuration

A new bucket must be created in your Supabase project to store recharge attachments.

*   **Bucket Name:** `recharge-attachments`
*   **Public Access:** No (Recommended for security, use signed URLs if needed for viewing)
*   **File Size Limit:** 10MB per file (enforced in frontend)
*   **Allowed MIME Types:** `image/jpeg`, `image/png`, `image/gif`, `application/pdf`

## 2. Folder Structure

Files are organized by `cafeteriaId` to ensure a clean and manageable structure.

*   **Path Format:** `recharge-attachments/{cafeteriaId}/{timestamp}-{randomString}.{extension}`
*   **Example:** `recharge-attachments/cafeteria_123/1679456789000-abc123.jpg`

## 3. Required Environment Variables

The following environment variables must be configured in your deployment environment (e.g., Vercel) for the storage integration to work. These are already utilized by the `supabaseClient.ts` in the frontend.

| Variable | Description | Source |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Your Supabase Project URL | Supabase Dashboard > Settings > API |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase Anonymous Key | Supabase Dashboard > Settings > API |

## 4. Activation Steps

1.  **Create Bucket:** Log in to your Supabase Dashboard, navigate to **Storage**, and create a new bucket named `recharge-attachments`.
2.  **Configure Policies:** Set up Storage Policies (RLS) to allow authenticated users to upload files.
    *   **Insert Policy:** Allow `authenticated` users to insert into the `recharge-attachments` bucket.
    *   **Select Policy:** Allow users to read their own uploads or allow admins to read all uploads.
3.  **Deploy Frontend:** Ensure the updated `CafeteriaRecharge.tsx` and `supabaseClient.ts` are deployed with the correct environment variables.

## 5. Implementation Details

*   **Frontend:** The `handleAddRequest` function in `CafeteriaRecharge.tsx` now uploads files directly to Supabase Storage before submitting the recharge request to the backend.
*   **Backend:** The `rechargesRouter` now accepts an array of storage paths/keys instead of base64 blobs, significantly reducing request payload size and database storage requirements.
*   **Database:** Paths are stored in the `imageUrl` (primary) and `attachmentUrls` (all) fields of the `rechargeRequests` table.

## 6. Security Considerations

*   **RLS Policies:** It is critical to configure Row Level Security (RLS) policies on the `recharge-attachments` bucket to prevent unauthorized access or uploads.
*   **Signed URLs:** If the bucket is private, the admin dashboard will need to be updated to generate signed URLs for viewing attachments. The current implementation stores paths, which are compatible with both public and private bucket configurations.
