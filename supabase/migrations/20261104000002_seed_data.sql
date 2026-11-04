-- ==============================================================================
-- CNG DEAL DESK ALPHA V2 — SEED DATA MIGRATION
-- Migration: 20261104000002_seed_data.sql
-- Description: Standard baseline data for Northern Uganda corridor operations:
--              5 Core Counterparties, 12 Baseline Market Observations,
--              2 Demonstration Deals with audit history events.
-- ==============================================================================

-- 1. SEED PARTIES (COUNTERPARTIES)
INSERT INTO public.parties (id, name, role, district, contact_person, contact_channel, authority_status, consent_aggregate_use, created_date, updated_date)
VALUES
  ('p1', 'Lira Grain Processors Ltd', 'Buyer', 'Lira', 'Okot Peter', '+256 772 100 200', 'VERIFIED', true, NOW() - INTERVAL '10 days', NOW() - INTERVAL '1 day'),
  ('p2', 'Amuru United Farmers Co-op', 'Supplier or farmer group', 'Amuru', 'Akello Grace', '+256 782 300 400', 'VERIFIED', true, NOW() - INTERVAL '10 days', NOW() - INTERVAL '1 day'),
  ('p3', 'Nwoya Producers Association', 'Supplier or farmer group', 'Nwoya', 'Ochan David', '+256 752 500 600', 'REPORTED', true, NOW() - INTERVAL '8 days', NOW() - INTERVAL '2 days'),
  ('p4', 'Northern Corridor Hauliers', 'Transporter', 'Gulu', 'Kayiira Sam', '+256 701 700 800', 'VERIFIED', true, NOW() - INTERVAL '7 days', NOW() - INTERVAL '2 days'),
  ('p5', 'Gulu Millers Consortium', 'Buyer', 'Gulu', 'Auma Christine', '+256 774 900 100', 'OPEN', true, NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- 2. SEED OBSERVATIONS (MARKET INTELLIGENCE)
INSERT INTO public.observations (id, type, commodity, district, place, quantity_tonnes, price_per_kg, transport_cost, moisture_pct, status, observed_date, party_id, consent_aggregate_use, evidence_note, created_date, updated_date)
VALUES
  ('o1', 'Supply offer', 'Maize', 'Amuru', 'Layibi', 25, 1150, NULL, 12.8, 'VERIFIED', CURRENT_DATE - 1, 'p2', true, 'Weighed on site, moisture tested with calibrated dickey-john', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
  ('o2', 'Supply offer', 'Maize', 'Amuru', 'Atiak', 15, 1180, NULL, 13.2, 'REPORTED', CURRENT_DATE - 3, 'p2', true, 'Phone quotation from group coordinator', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
  ('o3', 'Buyer requirement', 'Maize', 'Lira', 'Railway division', 30, 1380, NULL, 12.5, 'VERIFIED', CURRENT_DATE - 1, 'p1', true, 'Purchase order #LGP-2026-88 signed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
  ('o4', 'Price quote', 'Maize', 'Gulu', 'Cereleno market', NULL, 1300, NULL, NULL, 'VERIFIED', CURRENT_DATE - 2, NULL, true, 'Wholesale board price', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
  ('o5', 'Price quote', 'Maize', 'Gulu', 'Main market', NULL, 1320, NULL, NULL, 'VERIFIED', CURRENT_DATE - 4, NULL, true, 'Dealer retail wholesale', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),
  ('o6', 'Price quote', 'Maize', 'Gulu', 'Layibi trade post', NULL, 1290, NULL, NULL, 'VERIFIED', CURRENT_DATE - 5, NULL, true, 'Aggregate dealer transaction', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
  ('o7', 'Transport quote', 'Maize', 'Amuru', 'Amuru to Lira route', NULL, NULL, 650000, NULL, 'VERIFIED', CURRENT_DATE - 2, 'p4', true, 'Quotation for 15-tonne Fuso truck', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
  ('o8', 'Quality reading', 'Maize', 'Amuru', 'Pabbo storage', NULL, NULL, NULL, 13.0, 'VERIFIED', CURRENT_DATE - 3, 'p2', true, 'Bag probe sample test', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
  ('o9', 'Supply offer', 'Maize', 'Nwoya', 'Anaka', 18, 1140, NULL, 13.5, 'VERIFIED', CURRENT_DATE - 4, 'p3', true, 'Warehouse stock inspected', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),
  ('o10', 'Price quote', 'Maize', 'Lira', 'Main market', NULL, 1350, NULL, NULL, 'VERIFIED', CURRENT_DATE - 2, NULL, true, 'Wholesale intake rate', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
  ('o11', 'Price quote', 'Maize', 'Lira', 'Adyel', NULL, 1360, NULL, NULL, 'VERIFIED', CURRENT_DATE - 5, NULL, true, 'Commercial miller spot price', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
  ('o12', 'Price quote', 'Maize', 'Lira', 'Ojwina', NULL, 1340, NULL, NULL, 'VERIFIED', CURRENT_DATE - 6, NULL, true, 'Trader gate quote', NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days')
ON CONFLICT (id) DO NOTHING;

-- 3. SEED DEALS
INSERT INTO public.deals (id, name, buyer_id, supplier_id, commodity, proof_quantity_tonnes, buyer_price_per_kg, supplier_price_per_kg, stage, evidence, per_tonne_fee, minimum_fee, commissioned, cost_field, cost_testing, cost_transport, cost_other, staff_hours, staff_cost_per_hour, working_days, approval_status, payment_status, classification, created_date, updated_date)
VALUES
  ('d1', 'Lira Millers - Amuru Co-op 20t Maize', 'p1', 'p2', 'Maize', 20, 1380, 1150, 3, '["VERIFIED","VERIFIED","VERIFIED","VERIFIED","VERIFIED","VERIFIED","OPEN","OPEN"]'::jsonb, 30000, 25000, true, 25000, 30000, 0, 5000, 8, 6000, 3, 'Requested', 'Not invoiced', 'Class A - Fulfilled & Contribution Positive', NOW() - INTERVAL '4 days', NOW() - INTERVAL '1 day'),
  ('d2', 'Gulu Millers - Nwoya 15t Proof Batch', 'p5', 'p3', 'Maize', 15, 1320, 1140, 1, '["VERIFIED","REPORTED","OPEN","OPEN","OPEN","OPEN","OPEN","OPEN"]'::jsonb, 30000, 25000, false, 15000, 20000, 0, 0, 4, 6000, 1, 'Not requested', 'Not invoiced', 'Not classified', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;

-- 4. SEED DEAL EVENTS
INSERT INTO public.deal_events (id, deal_id, label, detail, created_date)
VALUES
  ('e1', 'd1', 'Deal matched & commissioned', 'Amuru United supply matched to Lira Grain order #88.', NOW() - INTERVAL '3 days'),
  ('e2', 'd1', 'Gate evidence verified', 'Quantity (20t), moisture (12.8%) and stock title verified on site.', NOW() - INTERVAL '2 days'),
  ('e3', 'd1', 'Approval requested', 'Management execution approval requested.', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

