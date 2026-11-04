# Implementation Plan: CNG Deal Desk Alpha V2

**Objective**: Migrate CNG Deal Desk Alpha V2 from a standalone local browser-storage sandbox to a secure, production-grade web application backed by Supabase PostgreSQL & Auth, hosted on Vercel, and source-controlled on GitHub.

---

## Phase 1: Pre-Implementation Audit & Baseline (Completed)
- [x] Inspect project directory structure, ES modules, CSS, HTML.
- [x] Analyze data models (`Party`, `Observation`, `Deal`, `DealEvent`, `User`).
- [x] Audit `localStorage` usage and hardcoded mock data.
- [x] Identify critical auth bypasses in `assets/index-A159RRyL.js` and `assets/auth/`.
- [x] Inspect git status, Vercel configuration, and Supabase parameters.
- [x] Produce `PROJECT_AUDIT.md`.

---

## Phase 2: Supabase Backend Implementation & Schema Design
- [ ] Create `supabase/migrations/20261104000001_initial_schema.sql` containing:
  - Extension `uuid-ossp` or `pgcrypto`.
  - Table `public.profiles`:
    - `id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
    - `email TEXT UNIQUE NOT NULL`
    - `username TEXT UNIQUE NOT NULL`
    - `name TEXT NOT NULL`
    - `role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer'))`
    - `last_login TIMESTAMPTZ`
    - `is_active BOOLEAN NOT NULL DEFAULT true`
    - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
    - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - Trigger function `public.handle_new_user()` to automatically create a profile in `public.profiles` when an account signs up in `auth.users`.
  - Table `public.parties`:
    - `id TEXT PRIMARY KEY DEFAULT ('rec_' || substr(md5(random()::text), 1, 9))`
    - `name TEXT NOT NULL`
    - `normalized_name TEXT GENERATED ALWAYS AS (regexp_replace(lower(trim(name)), '[^\w\s]', '', 'g')) STORED`
    - `role TEXT NOT NULL CHECK (role IN ('Buyer', 'Supplier or farmer group', 'Transporter', 'District contact', 'Other'))`
    - `district TEXT NOT NULL`
    - `normalized_district TEXT GENERATED ALWAYS AS (lower(trim(district))) STORED`
    - `contact_person TEXT`
    - `contact_channel TEXT`
    - `authority_status TEXT NOT NULL DEFAULT 'OPEN' CHECK (authority_status IN ('OPEN', 'REPORTED', 'VERIFIED'))`
    - `consent_aggregate_use BOOLEAN NOT NULL DEFAULT true`
    - `created_by UUID REFERENCES auth.users(id)`
    - `created_date TIMESTAMPTZ NOT NULL DEFAULT NOW()`
    - `updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW()`
    - **Unique Constraint / Index**: `UNIQUE(normalized_name, normalized_district)` to guarantee that normalized counterparty name + district is strictly unique across the system regardless of role.
  - Table `public.observations`:
    - `id TEXT PRIMARY KEY DEFAULT ('rec_' || substr(md5(random()::text), 1, 9))`
    - `type TEXT NOT NULL CHECK (type IN ('Supply offer', 'Buyer requirement', 'Price quote', 'Transport quote', 'Quality reading', 'Market note'))`
    - `commodity TEXT NOT NULL CHECK (commodity IN ('Maize', 'Beans', 'Soybeans', 'Sorghum', 'Rice', 'Cassava'))`
    - `district TEXT NOT NULL`
    - `place TEXT`
    - `quantity_tonnes NUMERIC`
    - `price_per_kg NUMERIC`
    - `transport_cost NUMERIC`
    - `moisture_pct NUMERIC`
    - `status TEXT NOT NULL DEFAULT 'REPORTED' CHECK (status IN ('OPEN', 'REPORTED', 'VERIFIED', 'REJECTED'))`
    - `observed_date DATE NOT NULL DEFAULT CURRENT_DATE`
    - `party_id TEXT REFERENCES public.parties(id) ON DELETE SET NULL`
    - `consent_aggregate_use BOOLEAN NOT NULL DEFAULT true`
    - `evidence_note TEXT`
    - `created_by UUID REFERENCES auth.users(id)`
    - `created_date TIMESTAMPTZ NOT NULL DEFAULT NOW()`
    - `updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - Table `public.deals`:
    - `id TEXT PRIMARY KEY DEFAULT ('rec_' || substr(md5(random()::text), 1, 9))`
    - `name TEXT NOT NULL`
    - `buyer_id TEXT REFERENCES public.parties(id) ON DELETE SET NULL`
    - `supplier_id TEXT REFERENCES public.parties(id) ON DELETE SET NULL`
    - `commodity TEXT NOT NULL`
    - `proof_quantity_tonnes NUMERIC NOT NULL`
    - `buyer_price_per_kg NUMERIC`
    - `supplier_price_per_kg NUMERIC`
    - `stage INTEGER NOT NULL DEFAULT 0 CHECK (stage BETWEEN 0 AND 7)`
    - `evidence JSONB NOT NULL DEFAULT '["OPEN","OPEN","OPEN","OPEN","OPEN","OPEN","OPEN","OPEN"]'::jsonb`
    - `per_tonne_fee NUMERIC NOT NULL DEFAULT 30000`
    - `minimum_fee NUMERIC NOT NULL DEFAULT 25000`
    - `commissioned BOOLEAN NOT NULL DEFAULT false`
    - `cost_field NUMERIC NOT NULL DEFAULT 0`
    - `cost_testing NUMERIC NOT NULL DEFAULT 0`
    - `cost_transport NUMERIC NOT NULL DEFAULT 0`
    - `cost_other NUMERIC NOT NULL DEFAULT 0`
    - `staff_hours NUMERIC NOT NULL DEFAULT 0`
    - `staff_cost_per_hour NUMERIC NOT NULL DEFAULT 6000`
    - `working_days NUMERIC NOT NULL DEFAULT 0`
    - `approval_status TEXT NOT NULL DEFAULT 'Not requested' CHECK (approval_status IN ('Not requested', 'Requested', 'Approved', 'Declined', 'Conditional'))`
    - `payment_status TEXT NOT NULL DEFAULT 'Not invoiced' CHECK (payment_status IN ('Not invoiced', 'Invoiced', 'Reported paid', 'Verified paid', 'Waived', 'Written off'))`
    - `classification TEXT NOT NULL DEFAULT 'Not classified'`
    - `accepted_tonnes NUMERIC`
    - `reconciled BOOLEAN NOT NULL DEFAULT false`
    - `created_by UUID REFERENCES auth.users(id)`
    - `created_date TIMESTAMPTZ NOT NULL DEFAULT NOW()`
    - `updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - Table `public.deal_events`:
    - `id TEXT PRIMARY KEY DEFAULT ('rec_' || substr(md5(random()::text), 1, 9))`
    - `deal_id TEXT NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE`
    - `label TEXT NOT NULL`
    - `detail TEXT`
    - `created_by UUID REFERENCES auth.users(id)`
    - `created_date TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - Table `public.app_settings`:
    - Key-value or config store for system-wide configurations (e.g. overhead rate).
  - Appropriate indexes for search and foreign keys.

---

## Phase 3: Database Security & Row Level Security (RLS)
- [ ] Enable Row Level Security (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) on all tables:
  - `public.profiles`
  - `public.parties`
  - `public.observations`
  - `public.deals`
  - `public.deal_events`
  - `public.app_settings`
- [ ] Create helper function `public.current_user_role()` defined as `SECURITY DEFINER` to securely fetch the requesting user's role from `public.profiles`.
- [ ] Implement RLS Policies:
  - **Profiles**:
    - Users can read all active profiles (needed for operator names & collaboration).
    - Users can update only their own profile details (`name`, `username`).
    - Users cannot modify their own `role` column or elevate themselves to `admin`.
    - Only `admin` role can update user roles or deactivate accounts.
  - **Parties, Observations, Deals, Deal Events**:
    - Authenticated users (`admin`, `user`, `viewer`) can SELECT records.
    - Viewers have read-only access (cannot INSERT, UPDATE, or DELETE).
    - Authenticated users with role `admin` or `user` can INSERT and UPDATE.
    - Only `admin` role (or creator where authorized) can DELETE records.
  - Test and verify RLS policies against unauthorized and role escalation attempts.

---

## Phase 4: Connect Existing Frontend with Supabase
- [ ] Create `package.json` with `@supabase/supabase-js` and build/test dependencies.
- [ ] Implement `src/supabaseClient.js` (or `assets/supabaseClient.js`) that initializes the official Supabase JavaScript client:
  ```javascript
  import { createClient } from '@supabase/supabase-js';
  const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || 'https://kwivtzoimfvnhovrdrcz.supabase.co';
  const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_mjzEppyM3rRgj8zpTVCLSA_LHiChrv2';
  export const supabase = createClient(supabaseUrl, supabaseAnonKey, { ... });
  ```
- [ ] Implement `src/services/supabaseRepository.js` providing the complete `entities` and `auth` interface:
  - Connects to Supabase tables instead of localStorage.
  - Implements `filter`, `get`, `create`, `update`, `delete`, `deleteMany`, `bulkCreate`.
  - Preserves exact parameter signatures and return types expected by `useRecords` and existing React components.
  - Surfaces loading indicators and real database errors (e.g. `DUPLICATE_COUNTERPARTY`).
  - Does NOT silently fall back to mock data when network fails.
- [ ] Integrate into `assets/auth/entry.js`:
  - Hook into `globalThis.__B44_DB__` so all existing components seamlessly operate against Supabase.
  - Remove all mock storage operations.

---

## Phase 5: Preserve Business Rules
- [ ] **Counterparty Uniqueness**:
  - Frontend validation: normalize name and district before submission.
  - Database constraint: `UNIQUE(normalized_name, normalized_district)`.
  - On PostgreSQL conflict (code `23505`), catch the error and throw `{ status: 409, code: 'DUPLICATE_COUNTERPARTY', message: 'Counterparty with this name already exists in this district' }`.
- [ ] **Evidence Gating & Auto-Regression**:
  - Keep `stageBlockers(deal, targetStage)` and `stageCap(deal)` logic fully intact in `assets/desk-CXHNcONN.js`.
  - Keep evidence array mapping intact.
- [ ] **Partial Acceptance & Fee Calculations**:
  - Keep fee calculations (`feeFor()`, `economics()`, minimum fee floor of UGX 25,000) fully intact.
- [ ] **Payment Statuses & Consent Handling**:
  - Preserve strict differentiation between `Reported paid` and `Verified paid`.
  - Maintain `consent_aggregate_use` filtering for market corridor intelligence.

---

## Phase 6: Local Storage Data Migration
- [ ] Create a client-side migration utility (`src/services/localStorageMigration.js` or integrated into `/data` page):
  - Detects existing `cng_store_Party`, `cng_store_Observation`, `cng_store_Deal`, `cng_store_DealEvent` in `localStorage`.
  - Validates record structure.
  - Maps records to Supabase tables.
  - Preserves original IDs (`p1`..`p5`, `o1`..`o12`, `d1`..`d2`, `e1`..`e3`).
  - Avoids duplicate records by checking existence or using upsert on ID with conflict checks.
  - Provides a clean progress notification in the UI.
  - Does NOT delete localStorage until migration is confirmed successful by the database.

---

## Phase 7: Authentication & Application Routing
- [ ] Remove hardcoded `t ||= { id: 'usr_operator', role: 'admin' }` bypass from `assets/index-A159RRyL.js`.
- [ ] Wire `assets/auth/authContext.js` and `entry.js` directly to `supabase.auth`:
  - `signUp({ email, password, options: { data: { name, username } } })`
  - `signInWithPassword({ email, password })`
  - `signOut()`
  - `supabase.auth.getSession()` and `supabase.auth.onAuthStateChange()`
  - Password reset flow via `supabase.auth.resetPasswordForEmail()`.
- [ ] Add `vercel.json` with SPA rewrite rules:
  ```json
  {
    "rewrites": [
      { "source": "/(.*)", "destination": "/index.html" }
    ]
  }
  ```
- [ ] Ensure refreshing direct URLs like `/review`, `/registry`, `/deals/d1` works flawlessly.

---

## Phase 8: Environment Configuration
- [ ] Create `.env.example`:
  ```bash
  VITE_SUPABASE_URL=https://kwivtzoimfvnhovrdrcz.supabase.co
  VITE_SUPABASE_ANON_KEY=sb_publishable_mjzEppyM3rRgj8zpTVCLSA_LHiChrv2
  ```
- [ ] Create `.env` locally (ensure `.gitignore` excludes `.env`, `node_modules`, etc.).
- [ ] Audit that no service-role keys or secrets are exposed in client bundles or git.

---

## Phase 9: Automated Build and Testing
- [ ] Configure `package.json` scripts: `build`, `test`, `lint`.
- [ ] Create automated test suite `tests/supabase_cng_suite.test.js`:
  - Test 1: Counterparty uniqueness & `DUPLICATE_COUNTERPARTY` error.
  - Test 2: Evidence gating & stage blockers.
  - Test 3: Auto-regression stage cap.
  - Test 4: Partial acceptance fee calculations & minimum fee floor (UGX 25,000).
  - Test 5: Payment statuses differentiation (`Reported paid` vs `Verified paid`).
  - Test 6: Market intelligence consent filtering.
  - Test 7: Authentication verification (reject invalid passwords, session persistence).
  - Test 8: Security audit (RLS enforcement, no hardcoded bypasses, no exposed service-role key).
- [ ] Run test suite and document in `SUPABASE_TEST_RESULTS.md`.

---

## Phase 10: GitHub and Vercel Deployment
- [ ] Initialize Git repository (`git init`).
- [ ] Configure git remote to existing GitHub repository.
- [ ] Review git status and staging.
- [ ] Commit all code, migrations, tests, and configuration.
- [ ] Push to deployment branch (`main`).
- [ ] Verify Vercel deployment and compile `DEPLOYMENT_REPORT.md`.

---

## Phase 11: Production Setup Guide & Verification
- [ ] Create `PRODUCTION_SETUP_GUIDE.md` detailing:
  - Exact Supabase migration steps (SQL Editor instructions).
  - Vercel Environment Variables setup (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
  - Post-deployment checklist and operational guide.
- [ ] Deliver `SUPABASE_IMPLEMENTATION_REPORT.md`.

