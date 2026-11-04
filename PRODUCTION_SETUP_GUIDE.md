# Production Setup & Operations Guide: CNG Deal Desk Alpha V2

This step-by-step guide explains how to complete the final cloud configuration in your **Supabase Dashboard**, **GitHub Repository**, and **Vercel Project**.

---

## 1. Apply Supabase Database Migrations

You have an existing Supabase project connected at:
- **Project URL**: `https://kwivtzoimfvnhovrdrcz.supabase.co`

### Step 1.1: Run the Schema Migration
1. Open your browser and navigate to your **[Supabase Dashboard](https://supabase.com/dashboard/project/kwivtzoimfvnhovrdrcz)**.
2. In the left navigation bar, click on **SQL Editor**.
3. Click **+ New Query**.
4. Open the local file `supabase/migrations/20261104000001_initial_schema.sql` in your editor, copy the entire contents, and paste them into the Supabase SQL Editor.
5. Click **Run** (or press `Ctrl + Enter`).
6. Confirm that the query succeeds with `Success. No rows returned`.

> This creates the `profiles`, `parties`, `observations`, `deals`, `deal_events`, and `app_settings` tables, normalization helper functions, unique index `idx_parties_unique_normalized`, auto-signup trigger, role escalation trigger, and enables Row Level Security (RLS) on all tables.

### Step 1.2: Seed Baseline Data (Optional but Recommended)
1. In the Supabase **SQL Editor**, click **+ New Query**.
2. Open `supabase/migrations/20261104000002_seed_data.sql`, copy its contents, paste them into the editor, and click **Run**.
3. Confirm that the 5 baseline counterparties, 12 regional market observations, and 2 demonstration deals are inserted.

---

## 2. Push Code to GitHub

Your local repository is initialized on branch `main` with commit `cbc3ec1`.

To push to your existing GitHub repository:
1. Open your PowerShell / Command Prompt in `C:\Users\ojuka\CNG_Alpha`:
2. Add your existing GitHub remote (replace `<YOUR-REPO-NAME>` with the name of your GitHub repo):
   ```bash
   git remote add origin https://github.com/AmicaDev/<YOUR-REPO-NAME>.git
   ```
3. Push to `main`:
   ```bash
   git push -u origin main
   ```
   *(Git Credential Manager will authenticate using your saved GitHub credentials)*.

---

## 3. Verify Vercel Environment Variables & Deployment

Because Vercel is already linked to your GitHub repository, pushing to `main` will trigger a Vercel deployment.

### Step 3.1: Add Environment Variables in Vercel
1. Go to your **[Vercel Dashboard](https://vercel.com/)** and select your **CNG Deal Desk** project.
2. Navigate to **Settings** -> **Environment Variables**.
3. Ensure the following two variables are configured for **Production** (and Preview/Development if desired):
   - **`VITE_SUPABASE_URL`**: `https://kwivtzoimfvnhovrdrcz.supabase.co`
   - **`VITE_SUPABASE_ANON_KEY`**: `sb_publishable_mjzEppyM3rRgj8zpTVCLSA_LHiChrv2`
4. If they were newly added, trigger a **Redeploy** from the **Deployments** tab by clicking the three dots on the latest deployment -> **Redeploy**.

### Step 3.2: Verify SPA Rewrites
- `vercel.json` in the root automatically configures SPA routing (`/(.*) -> /index.html`).
- Once deployed, visiting direct URLs like `https://<your-vercel-domain>/review` or refreshing the page will load seamlessly without a 404 error.

---

## 4. First-Time Account Registration & Admin Promotion

1. Navigate to `https://<your-vercel-domain>/register` (or `http://localhost:8080/register` locally).
2. Enter your Name, Email, Username, and Password (at least 8 characters).
3. Click **Create account**. Supabase Auth will create your account and the PostgreSQL trigger will insert your profile into `public.profiles` with default role `'user'`.
4. To promote your account to `'admin'`:
   - Go to your Supabase Dashboard -> **Table Editor** -> **`profiles`**.
   - Find your user record, change the `role` cell from `'user'` to `'admin'`, and press Save.
   *(The database trigger `trg_prevent_role_escalation` allows this change from the Supabase Dashboard / service role, while blocking unprivileged client-side self-escalation).*

---

## 5. Local Storage Data Migration

If you have existing test data stored in your local browser from previous sandbox testing:
1. Log in to the application.
2. The client-side migration utility (`assets/migrationUtility.js`) will detect local records (`cng_store_Party`, `cng_store_Observation`, `cng_store_Deal`, `cng_store_DealEvent`).
3. It will safely migrate them to your Supabase tables while preserving IDs and preventing duplicates.
4. You can also export or import JSON backups anytime via the **/data** page.

---

## 6. Local Testing Commands

To run tests locally at any time:
```bash
# Run integrity & build check
npm run build

# Run full automated test suite (17 tests)
npm test

# Run local standalone web server on port 8080
npm start
```

