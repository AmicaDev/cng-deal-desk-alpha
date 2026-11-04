# Supabase Implementation Report: CNG Deal Desk Alpha V2

**Project**: CNG Deal Desk Alpha V2  
**Implementation Date**: November 4, 2026  
**Lead Engineer**: Senior Full-Stack Engineer & Supabase Architect  
**Backend Target**: Supabase (`https://kwivtzoimfvnhovrdrcz.supabase.co`)  
**Frontend Hosting**: Vercel  
**Status**: Implemented, Verified & Documented  

---

## 1. Executive Overview

This report details the successful transformation of **CNG Deal Desk Alpha V2** from an in-browser local storage mock implementation (`v0.0.0-alpha.2`) into a production-ready application backed by Supabase PostgreSQL, Supabase Auth, Row Level Security, and Vercel hosting.

All existing business logic, validation rules, evidence gating mechanisms, partial delivery fee calculations, and corridor analytics have been preserved with 100% fidelity. Critical security vulnerabilities, specifically hardcoded operator authentication bypasses and client-side role escalations, were completely removed.

---

## 2. Infrastructure Configuration

### 2.1 Supabase Connection Parameters
- **Project URL**: `https://kwivtzoimfvnhovrdrcz.supabase.co`
- **Publishable / Anon Key**: `sb_publishable_mjzEppyM3rRgj8zpTVCLSA_LHiChrv2`
- **Environment Variables**:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- **Credential Safety**:
  - No service-role key or database superuser secret is committed, exposed in client bundles, or logged.
  - `.env` is strictly ignored via `.gitignore`.
  - `.env.example` provides the template for team and CI/CD setup.

---

## 3. Database Schema & Migrations

All migrations are maintained under `supabase/migrations/`:

### 3.1 Migration `20261104000001_initial_schema.sql`
Defines the core database schema:
1. **Normalization Functions**:
   - `public.normalize_counterparty_name(text)`: Lowercases, strips punctuation, normalizes whitespace.
   - `public.normalize_district(text)`: Lowercases and trims district string.
2. **`public.profiles`**:
   - `id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
   - `email TEXT UNIQUE NOT NULL`
   - `username TEXT UNIQUE NOT NULL`
   - `name TEXT NOT NULL`
   - `role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer'))`
   - `last_login TIMESTAMPTZ`
   - `is_active BOOLEAN NOT NULL DEFAULT true`
   - `created_at / updated_at TIMESTAMPTZ`
   - **Trigger `on_auth_user_created`**: Executes `handle_new_user()` upon signup in `auth.users`, ensuring a synchronized profile with default role `'user'`.
   - **Trigger `trg_prevent_role_escalation`**: Executes `prevent_role_escalation()` ensuring ordinary users cannot elevate their own role to `'admin'`.
3. **`public.parties`**:
   - `id TEXT PRIMARY KEY DEFAULT ('rec_' || substr(md5(random()::text), 1, 9))`
   - `name TEXT NOT NULL`
   - `role TEXT NOT NULL CHECK (role IN ('Buyer', 'Supplier or farmer group', 'Transporter', 'District contact', 'Other'))`
   - `district TEXT NOT NULL`
   - `contact_person TEXT`
   - `contact_channel TEXT`
   - `authority_status TEXT NOT NULL DEFAULT 'OPEN' CHECK (authority_status IN ('OPEN', 'REPORTED', 'VERIFIED'))`
   - `consent_aggregate_use BOOLEAN NOT NULL DEFAULT true`
   - `created_by UUID REFERENCES auth.users(id)`
   - `created_date / updated_date TIMESTAMPTZ`
   - **Unique Index `idx_parties_unique_normalized`**:
     `UNIQUE (public.normalize_counterparty_name(name), public.normalize_district(district))`
     Guarantees that no duplicate counterparties can be registered in the same district, regardless of assigned role or concurrent submissions.
4. **`public.observations`**:
   - `id TEXT PRIMARY KEY`
   - `type TEXT NOT NULL`
   - `commodity TEXT NOT NULL`
   - `district TEXT NOT NULL`
   - `place TEXT`, `quantity_tonnes NUMERIC`, `price_per_kg NUMERIC`, `transport_cost NUMERIC`, `moisture_pct NUMERIC`
   - `status TEXT NOT NULL DEFAULT 'REPORTED'`
   - `observed_date DATE NOT NULL`
   - `party_id TEXT REFERENCES public.parties(id) ON DELETE SET NULL`
   - `consent_aggregate_use BOOLEAN NOT NULL DEFAULT true`
   - `evidence_note TEXT`
5. **`public.deals`**:
   - `id TEXT PRIMARY KEY`
   - `name TEXT NOT NULL`
   - `buyer_id TEXT REFERENCES public.parties(id)`
   - `supplier_id TEXT REFERENCES public.parties(id)`
   - `commodity TEXT NOT NULL`
   - `proof_quantity_tonnes NUMERIC NOT NULL`
   - `buyer_price_per_kg NUMERIC`, `supplier_price_per_kg NUMERIC`
   - `stage INTEGER NOT NULL DEFAULT 0 CHECK (stage BETWEEN 0 AND 7)`
   - `evidence JSONB NOT NULL DEFAULT '["OPEN","OPEN","OPEN","OPEN","OPEN","OPEN","OPEN","OPEN"]'::jsonb`
   - `per_tonne_fee NUMERIC DEFAULT 30000`, `minimum_fee NUMERIC DEFAULT 25000`
   - `cost_field`, `cost_testing`, `cost_transport`, `cost_other`, `staff_hours`, `staff_cost_per_hour`
   - `approval_status`, `payment_status`, `classification`, `accepted_tonnes`, `reconciled`
6. **`public.deal_events`**:
   - `id TEXT PRIMARY KEY`, `deal_id TEXT REFERENCES public.deals(id) ON DELETE CASCADE`, `label TEXT`, `detail TEXT`, `created_date TIMESTAMPTZ`
7. **`public.app_settings`**:
   - Key-value configuration table storing system defaults (e.g. `cng_deal_desk_overhead = 15`).

### 3.2 Migration `20261104000002_seed_data.sql`
Seeds standard baseline data for Northern Uganda operations:
- 5 Core Counterparties: `p1` (Lira Grain Processors Ltd), `p2` (Amuru United Farmers Co-op), `p3` (Nwoya Producers Association), `p4` (Northern Corridor Hauliers), `p5` (Gulu Millers Consortium).
- 12 Baseline Market Observations across Amuru, Gulu, Lira, and Nwoya districts.
- 2 Active Demonstration Deals (`d1` and `d2`) with corresponding event timelines.

---

## 4. Row Level Security (RLS) Implementation

Row Level Security is enabled on every application table (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`):
1. **Helper Function**:
   `public.current_user_role()` defined with `SECURITY DEFINER` retrieves the calling user's role from `public.profiles` without triggering recursive RLS evaluation.
2. **Access Rules**:
   - **`public.profiles`**: All authenticated team members can read profiles (for operator display). Users can update only their own profile row.
   - **`public.parties`, `public.observations`, `public.deals`, `public.deal_events`**:
     - `SELECT`: Allowed for all authenticated users (`admin`, `user`, `viewer`).
     - `INSERT` & `UPDATE`: Allowed for `admin` and `user` roles.
     - `DELETE`: Restricted to `admin` or the original `created_by` author.
   - **`public.app_settings`**: Read by all authenticated users; modifications restricted strictly to `admin`.

---

## 5. Frontend Integration Architecture

### 5.1 Supabase Client (`assets/supabaseClient.js`)
Configured using `@supabase/supabase-js` with automatic token refresh, session persistence, and URL detection.

### 5.2 Clean Service Repository (`assets/supabaseRepository.js`)
Rather than scattering raw Supabase calls across multiple UI components, `supabaseRepository.js` provides an entity repository conforming to the existing Base44 `__B44_DB__` interface:
- `entities.Party.filter() / get() / create() / update() / delete() / bulkCreate()`
- `entities.Observation.*`
- `entities.Deal.*`
- `entities.DealEvent.*`
- `entities.User.*`

### 5.3 Duplicate Counterparty Protection
At the repository level:
1. Normalizes the candidate `name` and `district`.
2. Queries existing counterparties. If a match exists, throws an error with `code: 'DUPLICATE_COUNTERPARTY'` and `status: 409`.
3. If concurrent requests bypass the frontend check, the PostgreSQL `idx_parties_unique_normalized` unique constraint raises error `23505`, which is caught and re-thrown as `DUPLICATE_COUNTERPARTY`.

### 5.4 Removal of Insecure Bypasses
- In `assets/index-A159RRyL.js`: The hardcoded `t ||= { id: 'usr_operator', role: 'admin' }` fallback and catch-block bypasses were completely removed.
- In `assets/auth/RegisterPage.js`: Removed the client-side role selection dropdown that previously allowed self-promotion to `admin`.

---

## 6. Client-Side Local Storage Migration Utility

Implemented in `assets/migrationUtility.js`:
1. Reads legacy records from `cng_store_Party`, `cng_store_Observation`, `cng_store_Deal`, `cng_store_DealEvent`.
2. Validates structure and preserves original IDs (`p1`..`p5`, `o1`..`o12`, `d1`..`d2`, `e1`..`e3`).
3. Attaches `created_by` matching the authenticated user.
4. Checks existing database records to prevent duplicate imports.
5. Saves migration audit status to `cng_supabase_migration_status` in localStorage.
6. Local storage records are safely preserved until database confirms successful insertion.

---

## 7. SPA Routing & Vercel Configuration

Created `vercel.json`:
```json
{
  "version": 2,
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```
Ensures direct browser navigation and page refresh on routes such as `/review`, `/registry`, `/deals/:id`, and `/data` resolve to `index.html` without 404 errors.
