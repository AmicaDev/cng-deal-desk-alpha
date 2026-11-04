# Deployment Report: CNG Deal Desk Alpha V2

**Report Date**: November 4, 2026  
**Repository Branch**: `main`  
**Latest Commit**: `cbc3ec1` ("feat: integrate Supabase backend, remove auth bypasses, add RLS policies, migrations, and Vercel SPA configuration")  
**Frontend Host**: Vercel  
**Database & Auth**: Supabase (`https://kwivtzoimfvnhovrdrcz.supabase.co`)  

---

## 1. Commit and Source Control Status

### 1.1 Local Git Repository Initialized
- Active Branch: `main`
- Initial Commit: `cbc3ec1`
- Number of Files Tracked: 58 files (3,702 insertions)
- Excluded Items (Verified via `.gitignore`):
  - `.env` (Excluded - no secrets committed)
  - `node_modules/` (Excluded)
  - Temporary task logs and scratch scripts (Excluded)

### 1.2 Remote Connection Status
- Global Git Identity: `user.name = AmicaDev`, `user.email = ojukajames0@gmail.com`
- When testing public remote URLs unauthenticated, GitHub returned 404 ("Repository not found"), which is standard for private repositories prior to authenticating via Git Credential Manager.
- To push commit `cbc3ec1` to your existing GitHub repository, run:
  ```bash
  git remote add origin https://github.com/AmicaDev/<YOUR-EXISTING-REPO-NAME>.git
  git push -u origin main
  ```
  *(If `origin` is already added, simply run `git push origin main`)*

---

## 2. Build Verification Results

- Command: `npm run build` (`node scripts/build-check.js`)
- Result: **PASSED (Exit code 0)**
- Verification Checklist:
  - [x] Application HTML entry (`index.html`) verified.
  - [x] Vercel SPA rewrites (`vercel.json`) verified.
  - [x] Environment configuration template (`.env.example`) verified.
  - [x] Supabase SQL migrations (`supabase/migrations/*.sql`) verified.
  - [x] Supabase client (`assets/supabaseClient.js`) verified.
  - [x] Supabase repository (`assets/supabaseRepository.js`) verified.
  - [x] Local storage migration utility (`assets/migrationUtility.js`) verified.
  - [x] Removal of hardcoded `usr_operator` operator bypass in React bundle verified (0 occurrences).
  - [x] Zero service-role or secret keys exposed in client code.

---

## 3. Test Suite Verification Results

- Command: `npm test` (`node tests/supabase_cng_suite.test.js`)
- Result: **17 / 17 Tests PASSED (100% success rate, Exit code 0)**
- Key Areas Verified:
  - 8-stage evidence gating & auto-regression calculation.
  - Partial acceptance fee scaling & UGX 25,000 minimum fee floor.
  - Counterparty normalization (`normalizeCounterpartyName` & `normalizeDistrict`).
  - Strict duplicate counterparty rejection returning `DUPLICATE_COUNTERPARTY` (HTTP 409).
  - Concurrent duplicate submission blocking.
  - Market intelligence consent filtering.
  - Vercel universal rewrite rule `/(.*)` -> `/index.html`.

---

## 4. Vercel Deployment Integration

Because GitHub is already connected to your Vercel project:
1. Pushing the `main` branch to GitHub triggers an automatic deployment in Vercel.
2. Vercel reads `vercel.json` and automatically sets up single-page application rewrites.
3. In the Vercel Dashboard, ensure the following Environment Variables are configured for the Production environment:
   - `VITE_SUPABASE_URL` = `https://kwivtzoimfvnhovrdrcz.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `sb_publishable_mjzEppyM3rRgj8zpTVCLSA_LHiChrv2`
4. The deployment status can be monitored in the Vercel Dashboard under **Deployments**.

