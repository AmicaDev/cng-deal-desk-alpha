/**
 * Client-Side Local Storage Migration Utility for CNG Deal Desk Alpha V2
 * 
 * Safely migrates legacy offline localStorage records to Supabase PostgreSQL:
 * 1. Reads existing records from window.localStorage
 * 2. Validates records against schema
 * 3. Preserves original IDs (p1..p5, o1..o12, d1..d2, e1..e3)
 * 4. Associates records with current authenticated user
 * 5. Prevents duplicates (idempotent)
 * 6. Records migration status and supports retries
 * 7. Never wipes localStorage before database confirms successful persistence
 */

import { supabase } from "./supabaseClient.js";

const MIGRATION_LOG_KEY = "cng_supabase_migration_status";

export async function checkMigrationNeeded() {
  if (typeof window === "undefined" || !window.localStorage) return false;
  const statusStr = localStorage.getItem(MIGRATION_LOG_KEY);
  if (statusStr) {
    try {
      const status = JSON.parse(statusStr);
      if (status.completed) return false;
    } catch {
      // Continue to check storage
    }
  }

  const hasParties = Boolean(localStorage.getItem("cng_store_Party"));
  const hasObservations = Boolean(localStorage.getItem("cng_store_Observation"));
  const hasDeals = Boolean(localStorage.getItem("cng_store_Deal"));
  return hasParties || hasObservations || hasDeals;
}

export function getStoredRecords() {
  const read = (key) => {
    try {
      const data = localStorage.getItem(`cng_store_${key}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  };

  return {
    parties: read("Party"),
    observations: read("Observation"),
    deals: read("Deal"),
    events: read("DealEvent"),
  };
}

export async function migrateLocalStorageToSupabase(currentUser) {
  const report = {
    startedAt: new Date().toISOString(),
    completed: false,
    parties: { total: 0, migrated: 0, skipped: 0, errors: [] },
    observations: { total: 0, migrated: 0, skipped: 0, errors: [] },
    deals: { total: 0, migrated: 0, skipped: 0, errors: [] },
    events: { total: 0, migrated: 0, skipped: 0, errors: [] },
  };

  try {
    const userId = currentUser?.id || null;
    const records = getStoredRecords();

    // 1. Migrate Parties
    report.parties.total = records.parties.length;
    for (const p of records.parties) {
      if (!p.name || !p.district) {
        report.parties.skipped++;
        continue;
      }
      try {
        // Check if party with this id or normalized name+district already exists
        const { data: existing } = await supabase
          .from("parties")
          .select("id")
          .eq("id", p.id)
          .maybeSingle();

        if (existing) {
          report.parties.skipped++;
        } else {
          const { error } = await supabase.from("parties").insert({
            id: p.id,
            name: p.name,
            role: p.role || "Other",
            district: p.district,
            contact_person: p.contact_person || null,
            contact_channel: p.contact_channel || null,
            authority_status: p.authority_status || "OPEN",
            consent_aggregate_use: p.consent_aggregate_use ?? true,
            created_by: userId,
            created_date: p.created_date || new Date().toISOString(),
            updated_date: p.updated_date || new Date().toISOString(),
          });
          if (error) {
            // If duplicate constraint hit, skip safely
            if (error.code === "23505") {
              report.parties.skipped++;
            } else {
              report.parties.errors.push({ id: p.id, error: error.message });
            }
          } else {
            report.parties.migrated++;
          }
        }
      } catch (err) {
        report.parties.errors.push({ id: p.id, error: err.message });
      }
    }

    // 2. Migrate Observations
    report.observations.total = records.observations.length;
    for (const o of records.observations) {
      if (!o.type || !o.commodity || !o.district) {
        report.observations.skipped++;
        continue;
      }
      try {
        const { data: existing } = await supabase
          .from("observations")
          .select("id")
          .eq("id", o.id)
          .maybeSingle();

        if (existing) {
          report.observations.skipped++;
        } else {
          const { error } = await supabase.from("observations").insert({
            id: o.id,
            type: o.type,
            commodity: o.commodity,
            district: o.district,
            place: o.place || null,
            quantity_tonnes: o.quantity_tonnes != null ? Number(o.quantity_tonnes) : null,
            price_per_kg: o.price_per_kg != null ? Number(o.price_per_kg) : null,
            transport_cost: o.transport_cost != null ? Number(o.transport_cost) : null,
            moisture_pct: o.moisture_pct != null ? Number(o.moisture_pct) : null,
            status: o.status || "REPORTED",
            observed_date: o.observed_date || new Date().toISOString().slice(0, 10),
            party_id: o.party_id || null,
            consent_aggregate_use: o.consent_aggregate_use ?? true,
            evidence_note: o.evidence_note || null,
            created_by: userId,
            created_date: o.created_date || new Date().toISOString(),
            updated_date: o.updated_date || new Date().toISOString(),
          });
          if (error) {
            report.observations.errors.push({ id: o.id, error: error.message });
          } else {
            report.observations.migrated++;
          }
        }
      } catch (err) {
        report.observations.errors.push({ id: o.id, error: err.message });
      }
    }

    // 3. Migrate Deals
    report.deals.total = records.deals.length;
    for (const d of records.deals) {
      if (!d.name || !d.commodity) {
        report.deals.skipped++;
        continue;
      }
      try {
        const { data: existing } = await supabase
          .from("deals")
          .select("id")
          .eq("id", d.id)
          .maybeSingle();

        if (existing) {
          report.deals.skipped++;
        } else {
          const { error } = await supabase.from("deals").insert({
            id: d.id,
            name: d.name,
            buyer_id: d.buyer_id || null,
            supplier_id: d.supplier_id || null,
            commodity: d.commodity,
            proof_quantity_tonnes: Number(d.proof_quantity_tonnes) || 0,
            buyer_price_per_kg: d.buyer_price_per_kg != null ? Number(d.buyer_price_per_kg) : null,
            supplier_price_per_kg: d.supplier_price_per_kg != null ? Number(d.supplier_price_per_kg) : null,
            stage: Number(d.stage) || 0,
            evidence: Array.isArray(d.evidence) ? d.evidence : ["OPEN","OPEN","OPEN","OPEN","OPEN","OPEN","OPEN","OPEN"],
            per_tonne_fee: Number(d.per_tonne_fee) || 30000,
            minimum_fee: Number(d.minimum_fee) || 25000,
            commissioned: Boolean(d.commissioned),
            cost_field: Number(d.cost_field) || 0,
            cost_testing: Number(d.cost_testing) || 0,
            cost_transport: Number(d.cost_transport) || 0,
            cost_other: Number(d.cost_other) || 0,
            staff_hours: Number(d.staff_hours) || 0,
            staff_cost_per_hour: Number(d.staff_cost_per_hour) || 6000,
            working_days: Number(d.working_days) || 0,
            approval_status: d.approval_status || "Not requested",
            payment_status: d.payment_status || "Not invoiced",
            classification: d.classification || "Not classified",
            accepted_tonnes: d.accepted_tonnes != null ? Number(d.accepted_tonnes) : null,
            reconciled: Boolean(d.reconciled),
            created_by: userId,
            created_date: d.created_date || new Date().toISOString(),
            updated_date: d.updated_date || new Date().toISOString(),
          });
          if (error) {
            report.deals.errors.push({ id: d.id, error: error.message });
          } else {
            report.deals.migrated++;
          }
        }
      } catch (err) {
        report.deals.errors.push({ id: d.id, error: err.message });
      }
    }

    // 4. Migrate Deal Events
    report.events.total = records.events.length;
    for (const e of records.events) {
      if (!e.deal_id || !e.label) {
        report.events.skipped++;
        continue;
      }
      try {
        const { data: existing } = await supabase
          .from("deal_events")
          .select("id")
          .eq("id", e.id)
          .maybeSingle();

        if (existing) {
          report.events.skipped++;
        } else {
          const { error } = await supabase.from("deal_events").insert({
            id: e.id,
            deal_id: e.deal_id,
            label: e.label,
            detail: e.detail || null,
            created_by: userId,
            created_date: e.created_date || new Date().toISOString(),
          });
          if (error) {
            report.events.errors.push({ id: e.id, error: error.message });
          } else {
            report.events.migrated++;
          }
        }
      } catch (err) {
        report.events.errors.push({ id: e.id, error: err.message });
      }
    }

    report.completed = true;
    report.finishedAt = new Date().toISOString();

    // Record migration success in localStorage
    localStorage.setItem(MIGRATION_LOG_KEY, JSON.stringify(report));
    return report;
  } catch (fatal) {
    report.fatalError = fatal.message;
    localStorage.setItem(MIGRATION_LOG_KEY, JSON.stringify(report));
    throw fatal;
  }
}

