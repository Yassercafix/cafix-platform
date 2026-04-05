# Cafeteria V2 - Step-by-Step Deployment Guide

**Target**: Deploy to Supabase (Database) + Vercel (Hosting)

**Time Required**: ~30-45 minutes

**Difficulty**: Beginner-Friendly

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Create Supabase Project](#step-1-create-supabase-project)
3. [Step 2: Set Up Database](#step-2-set-up-database)
4. [Step 3: Get Database URL](#step-3-get-database-url)
5. [Step 4: Configure Environment Variables](#step-4-configure-environment-variables)
6. [Step 5: Upload to GitHub](#step-5-upload-to-github)
7. [Step 6: Deploy to Vercel](#step-6-deploy-to-vercel)
8. [Step 7: Test First Login](#step-7-test-first-login)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

You will need:

- [ ] A Supabase account (free at https://supabase.com)
- [ ] A GitHub account (free at https://github.com)
- [ ] A Vercel account (free at https://vercel.com)
- [ ] This project code
- [ ] A text editor (VS Code, Notepad, etc.)

**Time to set up accounts**: ~5 minutes

---

## Step 1: Create Supabase Project

### 1.1 Go to Supabase

1. Open https://supabase.com in your browser
2. Click **"Sign Up"** (or log in if you have an account)
3. Sign up with GitHub (easiest) or email

### 1.2 Create New Project

1. After logging in, click **"New Project"**
2. Fill in:
   - **Project Name**: `cafeteria-v2` (or any name)
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose closest to you
3. Click **"Create New Project"**

**Wait 1-2 minutes** for the project to be created.

### 1.3 Verify Project Created

When done, you should see:
- Project dashboard
- "Database" section on the left sidebar
- "SQL Editor" option

**✅ Supabase project created!**

---

## Step 2: Set Up Database

### 2.1 Open SQL Editor

1. In Supabase dashboard, click **"SQL Editor"** (left sidebar)
2. Click **"New Query"**

### 2.2 Copy Database Schema

1. Open the file: `supabase_schema.sql` (included in this package)
2. Copy **ALL** the content (Ctrl+A, Ctrl+C)

### 2.3 Paste and Execute

1. In Supabase SQL Editor, paste the schema
2. Click **"Run"** button (or press Ctrl+Enter)

**Wait 30-60 seconds** for the schema to be created.

### 2.4 Verify Tables Created

1. Click **"Table Editor"** (left sidebar)
2. You should see tables like:
   - `users`
   - `marketers`
   - `cafeterias`
   - `cafeteriaStaff`
   - `menuItems`
   - etc.

**✅ Database schema created!**

---

## Step 3: Get Database URL

### 3.1 Go to Project Settings

1. In Supabase, click **"Project Settings"** (bottom left)
2. Click **"Database"** tab

### 3.2 Find Connection String

1. Look for **"Connection Pooling"** section
2. You should see a connection string that looks like:
   ```
   postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres?schema=public&sslmode=require
   ```

### 3.3 Copy the URL

1. Click the **copy button** next to the connection string
2. Paste it somewhere safe (notepad)
3. Replace `[PASSWORD]` with your database password from Step 1.2

**Example**:
```
postgresql://postgres:MySecurePassword123@db.supabase.co:5432/postgres?schema=public&sslmode=require
```

**✅ Database URL obtained!**

---

## Step 4: Configure Environment Variables

### 4.1 Create .env.production File

1. In this project folder, find `.env.production.example`
2. Make a copy and rename it to `.env.production` (remove ".example")
3. Open `.env.production` in a text editor

### 4.2 Fill in Required Variables

Replace the placeholder values:

```env
# Database URL (from Step 3.3)
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@YOUR_HOST:5432/postgres?schema=public&sslmode=require

# JWT Secret (generate a random string, min 32 characters)
# You can use: https://generate-random.org/ or run:
# openssl rand -base64 32
JWT_SECRET=your-random-32-char-string-here

# Application ID (can be anything unique)
VITE_APP_ID=cafeteria-v2-prod

# Owner ID (your email or user ID)
OWNER_OPEN_ID=your-email@example.com

# OAuth Server URL (your backend URL, will be Vercel URL)
OAUTH_SERVER_URL=https://your-vercel-domain.vercel.app/api/oauth

# Supabase URLs (from Supabase dashboard)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-from-supabase
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-from-supabase
```

### 4.3 Get Supabase Keys

1. In Supabase, go **"Project Settings"** > **"API"**
2. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon key** → `SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

### 4.4 Generate JWT Secret

Use one of these methods:

**Option A: Online Generator**
- Go to https://generate-random.org/
- Set length to 32
- Copy the generated string

**Option B: Command Line (Mac/Linux)**
```bash
openssl rand -base64 32
```

**Option C: Use a strong password**
- Example: `MySecureJWTSecret123456789012345`

### 4.5 Save .env.production

Save the file with all values filled in.

**⚠️ IMPORTANT**: 
- **DO NOT commit** `.env.production` to GitHub
- **DO NOT share** the values in this file
- **DO NOT push** this file to public repositories

**✅ Environment variables configured!**

---

## Step 5: Upload to GitHub

### 5.1 Create GitHub Repository

1. Go to https://github.com/new
2. Fill in:
   - **Repository Name**: `cafeteria-v2` (or any name)
   - **Description**: `Cafeteria management system`
   - **Public** or **Private** (your choice)
3. Click **"Create Repository"**

### 5.2 Upload Project Code

**Option A: Using Git (Command Line)**

```bash
# Navigate to project folder
cd /path/to/cafeteria-v2-deploy

# Initialize git
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Cafeteria V2"

# Add remote (replace USERNAME and REPO_NAME)
git remote add origin https://github.com/USERNAME/REPO_NAME.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Option B: Using GitHub Desktop (GUI)**

1. Download GitHub Desktop: https://desktop.github.com/
2. Open GitHub Desktop
3. Click **"File"** > **"Clone Repository"**
4. Select your repository
5. Click **"Publish Repository"**

### 5.3 Verify Upload

1. Go to your GitHub repository
2. You should see all project files

**✅ Code uploaded to GitHub!**

---

## Step 6: Deploy to Vercel

### 6.1 Connect Vercel to GitHub

1. Go to https://vercel.com
2. Click **"New Project"**
3. Click **"Import Git Repository"**
4. Search for your repository name
5. Click **"Import"**

### 6.2 Configure Environment Variables

1. In Vercel import screen, click **"Environment Variables"**
2. Add each variable from `.env.production`:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Your Supabase connection string |
| `JWT_SECRET` | Your generated JWT secret |
| `VITE_APP_ID` | cafeteria-v2-prod |
| `OWNER_OPEN_ID` | your-email@example.com |
| `OAUTH_SERVER_URL` | https://your-vercel-domain.vercel.app/api/oauth |
| `SUPABASE_URL` | Your Supabase URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |

### 6.3 Deploy

1. Click **"Deploy"**
2. Wait for deployment to complete (2-5 minutes)

### 6.4 Get Your Live URL

After deployment completes:
1. You'll see a "Congratulations!" message
2. Your live URL will be shown (e.g., `https://cafeteria-v2.vercel.app`)
3. Click the URL to open your live app

**✅ App deployed to Vercel!**

---

## Step 7: Test First Login

### 7.1 Open Your App

1. Click your Vercel URL to open the app
2. You should see the login page

### 7.2 Create First User (Owner)

Since there are no users yet, you need to create the owner account:

1. In Supabase SQL Editor, run:

```sql
INSERT INTO "users" (
  "id",
  "openId",
  "name",
  "email",
  "role",
  "createdAt",
  "updatedAt",
  "lastSignedIn"
) VALUES (
  'owner-1',
  'owner-system',
  'Owner',
  'owner@example.com',
  'owner',
  NOW(),
  NOW(),
  NOW()
);
```

2. Then create a marketer:

```sql
INSERT INTO "marketers" (
  "id",
  "openId",
  "name",
  "email",
  "loginUsername",
  "passwordHash",
  "referenceCode",
  "role",
  "createdAt",
  "updatedAt"
) VALUES (
  'marketer-1',
  'marketer-1',
  'Test Marketer',
  'marketer@example.com',
  'marketer@example.com',
  'hashedpassword123',
  '1001',
  'marketer',
  NOW(),
  NOW()
);
```

### 7.3 Verify App Works

1. Go back to your app URL
2. Try to log in
3. You should see the dashboard

**✅ First login successful!**

---

## Troubleshooting

### Problem: "Database connection failed"

**Solution**:
1. Check DATABASE_URL is correct
2. Verify password is correct
3. Check Supabase project is running
4. In Vercel, go to Deployments > Logs to see errors

### Problem: "Page not found" or blank page

**Solution**:
1. Wait 2-3 minutes for deployment to fully complete
2. Hard refresh browser (Ctrl+Shift+R)
3. Check Vercel deployment status

### Problem: "Environment variables not set"

**Solution**:
1. In Vercel, go to Project Settings > Environment Variables
2. Verify all variables are set
3. Redeploy (click "Deployments" > "Redeploy")

### Problem: "Login not working"

**Solution**:
1. Check if users exist in database
2. Verify JWT_SECRET is set in Vercel
3. Check Vercel logs for errors

### Problem: "Tables not created in database"

**Solution**:
1. Go to Supabase SQL Editor
2. Run the schema again
3. Check for errors in the output

---

## Next Steps

### After Successful Deployment

1. **Test the app**:
   - Create users
   - Test login/logout
   - Create marketers
   - Create cafeterias

2. **Monitor the app**:
   - Check Vercel dashboard for errors
   - Monitor Supabase database usage
   - Set up alerts (optional)

3. **Scale the app**:
   - Add more users
   - Configure Supabase backups
   - Set up custom domain (optional)

---

## Support & Resources

- **Supabase Docs**: https://supabase.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **Project README**: See `PRODUCTION_READY.md`

---

## Checklist

Before going live:

- [ ] Supabase project created
- [ ] Database schema applied
- [ ] DATABASE_URL obtained
- [ ] Environment variables configured
- [ ] Code uploaded to GitHub
- [ ] App deployed to Vercel
- [ ] Live URL working
- [ ] First login tested
- [ ] Users can create accounts
- [ ] All features working

---

**Congratulations! Your Cafeteria V2 app is now live! 🎉**

For more information, see `PRODUCTION_READY.md` and `PRODUCTION_CHANGES.md`.
