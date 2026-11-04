-- ==============================================================================
-- CNG DEAL DESK ALPHA V2 — AUTO-CONFIRM USER ACCOUNTS MIGRATION
-- Migration: 20261104000003_auto_confirm_users.sql
-- Description: 
--   1. Confirms all existing pending users in auth.users so they can log in
--      immediately without receiving a 400 Bad Request (Email not confirmed).
--   2. Installs a database trigger to automatically confirm future users
--      at insertion time if Supabase SMTP confirmation is not configured.
-- ==============================================================================

-- 1. Confirm all existing users registered without confirmed emails
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- 2. Trigger function to auto-confirm new registrations
CREATE OR REPLACE FUNCTION public.auto_confirm_new_user()
RETURNS trigger AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach before-insert trigger on auth.users
DROP TRIGGER IF EXISTS trg_auto_confirm_new_user ON auth.users;
CREATE TRIGGER trg_auto_confirm_new_user
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_new_user();
