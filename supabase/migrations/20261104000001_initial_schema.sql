-- ==============================================================================
-- CNG DEAL DESK ALPHA V2 — SUPABASE DATABASE MIGRATION
-- Migration: 20261104000001_initial_schema.sql
-- Description: Core schema, profiles, counterparties, observations, deals,
--              deal events, uniqueness constraints, triggers, and Row Level Security (RLS).
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. NORMALIZATION HELPER FUNCTIONS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.normalize_counterparty_name(raw_name text)
RETURNS text AS $$
BEGIN
  RETURN regexp_replace(lower(trim(coalesce(raw_name, ''))), '[^\w\s]', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.normalize_district(raw_district text)
RETURNS text AS $$
BEGIN
  RETURN lower(trim(coalesce(raw_district, '')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ==============================================================================
-- 3. PROFILES TABLE (Linked to auth.users)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
  last_login TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Helper to safely query current user role without recursion
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
  RETURN coalesce(v_role, 'viewer');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Trigger to create profile automatically on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_username text;
  v_name text;
BEGIN
  v_username := coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1)
  );
  v_name := coalesce(
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  INSERT INTO public.profiles (id, email, username, name, role, is_active, created_at, updated_at)
  VALUES (
    new.id,
    new.email,
    v_username,
    v_name,
    'user', -- Default to user, NEVER admin on registration
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      updated_at = NOW();

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to prevent non-admins from changing their own role
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role <> OLD.role THEN
    IF (SELECT public.current_user_role()) <> 'admin' THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: Only administrators can modify user roles.';
    END IF;
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();

-- ==============================================================================
-- 4. PARTIES (COUNTERPARTIES) TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.parties (
  id TEXT PRIMARY KEY DEFAULT ('rec_' || substr(md5(random()::text), 1, 9)),
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Buyer', 'Supplier or farmer group', 'Transporter', 'District contact', 'Other')),
  district TEXT NOT NULL,
  contact_person TEXT,
  contact_channel TEXT,
  authority_status TEXT NOT NULL DEFAULT 'OPEN' CHECK (authority_status IN ('OPEN', 'REPORTED', 'VERIFIED')),
  consent_aggregate_use BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Strict Uniqueness Constraint: Normalized name + normalized district
-- Role cannot be used to permit duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS idx_parties_unique_normalized
ON public.parties (
  public.normalize_counterparty_name(name),
  public.normalize_district(district)
);

CREATE INDEX IF NOT EXISTS idx_parties_district ON public.parties(district);
CREATE INDEX IF NOT EXISTS idx_parties_role ON public.parties(role);
CREATE INDEX IF NOT EXISTS idx_parties_created_date ON public.parties(created_date DESC);

-- ==============================================================================
-- 5. OBSERVATIONS TABLE (Market Intelligence)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.observations (
  id TEXT PRIMARY KEY DEFAULT ('rec_' || substr(md5(random()::text), 1, 9)),
  type TEXT NOT NULL CHECK (type IN ('Supply offer', 'Buyer requirement', 'Price quote', 'Transport quote', 'Quality reading', 'Market note')),
  commodity TEXT NOT NULL CHECK (commodity IN ('Maize', 'Beans', 'Soybeans', 'Sorghum', 'Rice', 'Cassava')),
  district TEXT NOT NULL,
  place TEXT,
  quantity_tonnes NUMERIC,
  price_per_kg NUMERIC,
  transport_cost NUMERIC,
  moisture_pct NUMERIC,
  status TEXT NOT NULL DEFAULT 'REPORTED' CHECK (status IN ('OPEN', 'REPORTED', 'VERIFIED', 'REJECTED')),
  observed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  party_id TEXT REFERENCES public.parties(id) ON DELETE SET NULL,
  consent_aggregate_use BOOLEAN NOT NULL DEFAULT true,
  evidence_note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_observations_district ON public.observations(district);
CREATE INDEX IF NOT EXISTS idx_observations_commodity ON public.observations(commodity);
CREATE INDEX IF NOT EXISTS idx_observations_status ON public.observations(status);
CREATE INDEX IF NOT EXISTS idx_observations_observed_date ON public.observations(observed_date DESC);
CREATE INDEX IF NOT EXISTS idx_observations_party_id ON public.observations(party_id);

-- ==============================================================================
-- 6. DEALS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.deals (
  id TEXT PRIMARY KEY DEFAULT ('rec_' || substr(md5(random()::text), 1, 9)),
  name TEXT NOT NULL,
  buyer_id TEXT REFERENCES public.parties(id) ON DELETE SET NULL,
  supplier_id TEXT REFERENCES public.parties(id) ON DELETE SET NULL,
  commodity TEXT NOT NULL,
  proof_quantity_tonnes NUMERIC NOT NULL,
  buyer_price_per_kg NUMERIC,
  supplier_price_per_kg NUMERIC,
  stage INTEGER NOT NULL DEFAULT 0 CHECK (stage BETWEEN 0 AND 7),
  evidence JSONB NOT NULL DEFAULT '["OPEN","OPEN","OPEN","OPEN","OPEN","OPEN","OPEN","OPEN"]'::jsonb,
  per_tonne_fee NUMERIC NOT NULL DEFAULT 30000,
  minimum_fee NUMERIC NOT NULL DEFAULT 25000,
  commissioned BOOLEAN NOT NULL DEFAULT false,
  cost_field NUMERIC NOT NULL DEFAULT 0,
  cost_testing NUMERIC NOT NULL DEFAULT 0,
  cost_transport NUMERIC NOT NULL DEFAULT 0,
  cost_other NUMERIC NOT NULL DEFAULT 0,
  staff_hours NUMERIC NOT NULL DEFAULT 0,
  staff_cost_per_hour NUMERIC NOT NULL DEFAULT 6000,
  working_days NUMERIC NOT NULL DEFAULT 0,
  approval_status TEXT NOT NULL DEFAULT 'Not requested' CHECK (approval_status IN ('Not requested', 'Requested', 'Approved', 'Declined', 'Conditional')),
  payment_status TEXT NOT NULL DEFAULT 'Not invoiced' CHECK (payment_status IN ('Not invoiced', 'Invoiced', 'Reported paid', 'Verified paid', 'Waived', 'Written off')),
  classification TEXT NOT NULL DEFAULT 'Not classified',
  accepted_tonnes NUMERIC,
  reconciled BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deals_stage ON public.deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_buyer_id ON public.deals(buyer_id);
CREATE INDEX IF NOT EXISTS idx_deals_supplier_id ON public.deals(supplier_id);
CREATE INDEX IF NOT EXISTS idx_deals_created_date ON public.deals(created_date DESC);

-- ==============================================================================
-- 7. DEAL EVENTS TABLE (Timeline & Audit History)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.deal_events (
  id TEXT PRIMARY KEY DEFAULT ('rec_' || substr(md5(random()::text), 1, 9)),
  deal_id TEXT NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  detail TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_events_deal_id ON public.deal_events(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_events_created_date ON public.deal_events(created_date DESC);

-- ==============================================================================
-- 8. APP SETTINGS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.app_settings (key, value)
VALUES ('cng_deal_desk_overhead', '15'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ==============================================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 9.1 PROFILES POLICIES
-- Authenticated users can view active team profiles
CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- Users can update only their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 9.2 PARTIES POLICIES
CREATE POLICY "parties_select_authenticated" ON public.parties
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "parties_insert_authenticated" ON public.parties
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('admin', 'user'));

CREATE POLICY "parties_update_authenticated" ON public.parties
  FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('admin', 'user'))
  WITH CHECK (public.current_user_role() IN ('admin', 'user'));

CREATE POLICY "parties_delete_admin_or_creator" ON public.parties
  FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin' OR created_by = auth.uid());

-- 9.3 OBSERVATIONS POLICIES
CREATE POLICY "observations_select_authenticated" ON public.observations
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "observations_insert_authenticated" ON public.observations
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('admin', 'user'));

CREATE POLICY "observations_update_authenticated" ON public.observations
  FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('admin', 'user'))
  WITH CHECK (public.current_user_role() IN ('admin', 'user'));

CREATE POLICY "observations_delete_admin_or_creator" ON public.observations
  FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin' OR created_by = auth.uid());

-- 9.4 DEALS POLICIES
CREATE POLICY "deals_select_authenticated" ON public.deals
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "deals_insert_authenticated" ON public.deals
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('admin', 'user'));

CREATE POLICY "deals_update_authenticated" ON public.deals
  FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('admin', 'user'))
  WITH CHECK (public.current_user_role() IN ('admin', 'user'));

CREATE POLICY "deals_delete_admin_or_creator" ON public.deals
  FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin' OR created_by = auth.uid());

-- 9.5 DEAL EVENTS POLICIES
CREATE POLICY "deal_events_select_authenticated" ON public.deal_events
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "deal_events_insert_authenticated" ON public.deal_events
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('admin', 'user'));

CREATE POLICY "deal_events_delete_admin" ON public.deal_events
  FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin');

-- 9.6 APP SETTINGS POLICIES
CREATE POLICY "app_settings_select_authenticated" ON public.app_settings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "app_settings_modify_admin" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

