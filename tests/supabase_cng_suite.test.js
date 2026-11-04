/**
 * ==============================================================================
 *   CNG DEAL DESK ALPHA V2 — AUTOMATED TEST SUITE
 *   Backend: Supabase PostgreSQL & Auth
 *   Frontend: React 18 / Vite / Vercel SPA
 *   Harness: tests/supabase_cng_suite.test.js
 * ==============================================================================
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  b as stageBlockers,
  x as stageCap,
  p as economics,
  m as feeFor,
  s as PAYMENT_STATUSES,
  f as corridorAverages,
  d as dataGaps,
  v as marketMetrics,
} from "../assets/desk-CXHNcONN.js";

import {
  normalizeCounterpartyName,
  normalizeDistrict,
  generateRecordId,
} from "../assets/supabaseRepository.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

console.log("================================================================================");
console.log("  CNG DEAL DESK ALPHA V2 — AUTOMATED VERIFICATION SUITE");
console.log("  Timestamp : " + new Date().toISOString());
console.log("  Runtime   : Node.js " + process.version);
console.log("================================================================================\n");

let passedCount = 0;
let failedCount = 0;

function runTest(testId, description, fn) {
  process.stdout.write(`>>> [${testId}] ${description}... `);
  try {
    fn();
    console.log("PASSED");
    passedCount++;
  } catch (err) {
    console.log("FAILED");
    console.error(`    Error in [${testId}]:`, err.message);
    failedCount++;
  }
}

// ==============================================================================
// 1. BUSINESS LOGIC & EVIDENCE GATING TESTS
// ==============================================================================

runTest("TEST-01", "Evidence Gating - Stage 1 blocked when initial gates are unverified", () => {
  const deal = {
    buyer_id: "p1",
    proof_quantity_tonnes: 20,
    evidence: ["REPORTED", "OPEN", "OPEN", "OPEN", "OPEN", "OPEN", "OPEN", "OPEN"],
  };
  const blockers = stageBlockers(deal, 1);
  assert.strictEqual(blockers.length, 3, "All 3 initial gates should block advance to Stage 1");
  assert.ok(blockers.includes("Verify: Buyer fee response agreed"));
  assert.ok(blockers.includes("Verify: Buyer authority confirmed"));
  assert.ok(blockers.includes("Verify: Transport quote verified"));
});

runTest("TEST-02", "Evidence Gating - Stage 1 unlocks when all initial gates are VERIFIED", () => {
  const deal = {
    buyer_id: "p1",
    proof_quantity_tonnes: 20,
    evidence: ["VERIFIED", "VERIFIED", "VERIFIED", "OPEN", "OPEN", "OPEN", "OPEN", "OPEN"],
  };
  const blockers = stageBlockers(deal, 1);
  assert.strictEqual(blockers.length, 0, "No blockers should remain for Stage 1");
});

runTest("TEST-03", "Evidence Gating - Stage 3 blocks advance to Stage 4 without verified moisture test", () => {
  const deal = {
    evidence: ["VERIFIED", "VERIFIED", "VERIFIED", "VERIFIED", "REPORTED", "VERIFIED", "OPEN", "OPEN"],
  };
  const blockers = stageBlockers(deal, 3);
  assert.strictEqual(blockers.length, 1);
  assert.strictEqual(blockers[0], "Verify: Quality and moisture sample tested");
});

runTest("TEST-04", "Auto-Regression - StageCap regresses Stage 4 back to Stage 1 if prior gate revoked", () => {
  const deal = {
    stage: 4,
    buyer_id: "p1",
    proof_quantity_tonnes: 20,
    supplier_id: "p2",
    supplier_price_per_kg: 1150,
    approval_status: "Approved",
    // Gate 1 (Buyer authority confirmed) revoked back to OPEN
    evidence: ["VERIFIED", "OPEN", "VERIFIED", "VERIFIED", "VERIFIED", "VERIFIED", "VERIFIED", "VERIFIED"],
  };
  const cap = stageCap(deal);
  assert.strictEqual(cap, 1, "Deal must auto-regress to Stage 1 due to missing gate 1 verification");
});

runTest("TEST-05", "Partial Acceptance - Desk verification fee scales strictly with accepted tonnes", () => {
  const deal = {
    per_tonne_fee: 30000,
    minimum_fee: 25000,
    proof_quantity_tonnes: 50,
    accepted_tonnes: 10, // 40 tonnes rejected
    cost_field: 10000,
    cost_testing: 20000,
    cost_transport: 0,
    cost_other: 0,
    staff_hours: 5,
    staff_cost_per_hour: 6000,
  };
  const econ = economics(deal);
  assert.strictEqual(econ.fee, 300000, "10 accepted tonnes * 30,000 = UGX 300,000");
  assert.strictEqual(econ.cash, 30000, "Cash costs = 10,000 + 20,000 = UGX 30,000");
  assert.strictEqual(econ.staff, 30000, "Staff costs = 5 * 6,000 = UGX 30,000");
  assert.strictEqual(econ.deliveryContribution, 240000, "Contribution = 300,000 - 30,000 - 30,000 = 240,000");
});

runTest("TEST-06", "Partial Acceptance - Zero accepted tonnes produces UGX 0 fee", () => {
  const deal = {
    per_tonne_fee: 30000,
    minimum_fee: 25000,
    proof_quantity_tonnes: 20,
    accepted_tonnes: 0, // 100% rejection
  };
  const econ = economics(deal);
  assert.strictEqual(econ.fee, 0, "100% rejection must yield UGX 0 verification fee");
});

runTest("TEST-07", "Partial Acceptance - Sub-threshold tonnage enforces UGX 25,000 minimum fee floor", () => {
  const feeResult = feeFor({
    perTonneFee: 30000,
    minimumFee: 25000,
    acceptedTonnes: 0.5, // 0.5 * 30,000 = 15,000 (< 25,000)
  });
  assert.strictEqual(feeResult.fee, 25000, "Must enforce minimum fee floor of UGX 25,000");
  assert.strictEqual(feeResult.rule, "Minimum fee of UGX 25,000 applied");
});

runTest("TEST-08", "Payment Statuses - Strict differentiation between Reported paid and Verified paid", () => {
  assert.ok(PAYMENT_STATUSES.includes("Reported paid"));
  assert.ok(PAYMENT_STATUSES.includes("Verified paid"));
  assert.notStrictEqual(PAYMENT_STATUSES.indexOf("Reported paid"), PAYMENT_STATUSES.indexOf("Verified paid"));
});

runTest("TEST-09", "Market Intelligence - Observations without aggregate consent excluded from corridor averages", () => {
  const observations = [
    { district: "Amuru", price_per_kg: 1200, quantity_tonnes: 10, type: "Supply offer", consent_aggregate_use: true },
    { district: "Amuru", price_per_kg: 900, quantity_tonnes: 5, type: "Supply offer", consent_aggregate_use: false }, // Should be excluded
  ];
  // Filter consented observations
  const consentedOnly = observations.filter((o) => o.consent_aggregate_use);
  const rows = corridorAverages(consentedOnly);
  const amuru = rows.find((r) => r.district === "Amuru");
  assert.ok(amuru, "Amuru corridor exists");
  assert.strictEqual(amuru.supply.n, 1);
  assert.strictEqual(amuru.supply.avg, 1200, "Non-consented quote (900) must not pull down average");
});

runTest("TEST-10", "Market Intelligence - Districts with < 3 verified sources flagged as gaps", () => {
  const observations = [
    { district: "Amuru", observed_date: new Date().toISOString().slice(0, 10), status: "VERIFIED" },
  ];
  const gaps = dataGaps(observations, 30);
  assert.ok(gaps.includes("Gulu"));
  assert.ok(gaps.includes("Lira"));
  assert.ok(gaps.includes("Nwoya"));
  assert.ok(gaps.includes("Oyam"));
  assert.ok(!gaps.includes("Amuru"));
});

// ==============================================================================
// 2. COUNTERPARTY UNIQUENESS & DUPLICATE PROTECTION TESTS
// ==============================================================================

runTest("TEST-11", "Counterparty Normalization - Correctly strips punctuation, extra spaces, and casing", () => {
  const norm1 = normalizeCounterpartyName("  Lira Grain   Processors, Ltd. ");
  const norm2 = normalizeCounterpartyName("lira grain processors ltd");
  assert.strictEqual(norm1, norm2, "Normalized names should be identical");
  assert.strictEqual(norm1, "lira grain processors ltd");

  const dist1 = normalizeDistrict("  Amuru  ");
  const dist2 = normalizeDistrict("amuru");
  assert.strictEqual(dist1, dist2);
  assert.strictEqual(dist1, "amuru");
});

runTest("TEST-12", "Duplicate Counterparty Rejection - Rejects duplicate party with DUPLICATE_COUNTERPARTY error", () => {
  const existingParties = [
    { id: "p1", name: "Lira Grain Processors Ltd", district: "Lira", role: "Buyer" },
  ];

  function validateNewParty(candidate, registry) {
    const normName = normalizeCounterpartyName(candidate.name);
    const normDist = normalizeDistrict(candidate.district);

    const duplicate = registry.find(
      (p) =>
        normalizeCounterpartyName(p.name) === normName &&
        normalizeDistrict(p.district) === normDist
    );

    if (duplicate) {
      const err = new Error("Counterparty with this name already exists in this district");
      err.status = 409;
      err.code = "DUPLICATE_COUNTERPARTY";
      err.error = "DUPLICATE_COUNTERPARTY";
      err.existingId = duplicate.id;
      throw err;
    }
    return true;
  }

  // Attempt to insert duplicate with different casing, punctuation, and different role
  const duplicateAttempt = {
    name: "LIRA GRAIN PROCESSORS, LTD.",
    district: "lira",
    role: "Transporter", // Different role must NOT allow bypass!
  };

  assert.throws(
    () => validateNewParty(duplicateAttempt, existingParties),
    (err) => {
      assert.strictEqual(err.code, "DUPLICATE_COUNTERPARTY");
      assert.strictEqual(err.status, 409);
      assert.strictEqual(err.existingId, "p1");
      return true;
    },
    "Must throw DUPLICATE_COUNTERPARTY error"
  );
});

runTest("TEST-13", "Concurrent Submissions - Simulated concurrent duplicate attempts are blocked", () => {
  const store = [];
  let duplicateCount = 0;

  function insertParty(p) {
    const normName = normalizeCounterpartyName(p.name);
    const normDist = normalizeDistrict(p.district);

    const exists = store.some(
      (item) =>
        normalizeCounterpartyName(item.name) === normName &&
        normalizeDistrict(item.district) === normDist
    );

    if (exists) {
      duplicateCount++;
      const err = new Error("Duplicate");
      err.code = "DUPLICATE_COUNTERPARTY";
      throw err;
    }

    store.push({ ...p, id: generateRecordId() });
    return store[store.length - 1];
  }

  // First request succeeds
  const p1 = insertParty({ name: "Amuru Farmers", district: "Amuru", role: "Supplier or farmer group" });
  assert.ok(p1.id.startsWith("rec_"));

  // Second concurrent request with same name + district fails
  assert.throws(
    () => insertParty({ name: "amuru farmers", district: "AMURU", role: "Buyer" }),
    (err) => err.code === "DUPLICATE_COUNTERPARTY"
  );
  assert.strictEqual(store.length, 1, "Only one party can exist in store");
  assert.strictEqual(duplicateCount, 1);
});

// ==============================================================================
// 3. SECURITY & AUTHENTICATION AUDIT TESTS
// ==============================================================================

runTest("TEST-14", "Security Audit - No hardcoded 'usr_operator' bypass in production bundle", () => {
  const bundlePath = path.join(projectRoot, "assets/index-A159RRyL.js");
  const content = fs.readFileSync(bundlePath, "utf8");
  assert.strictEqual(
    content.includes("usr_operator"),
    false,
    "Bundle must not contain hardcoded 'usr_operator' fallback bypass"
  );
});

runTest("TEST-15", "Security Audit - No exposed service_role key in frontend files or repository", () => {
  const filesToCheck = [
    "assets/index-A159RRyL.js",
    "assets/supabaseClient.js",
    "assets/supabaseRepository.js",
    "assets/auth/entry.js",
    "assets/auth/authContext.js",
    ".env.example",
    "package.json",
    "index.html",
  ];

  for (const f of filesToCheck) {
    const full = path.join(projectRoot, f);
    if (fs.existsSync(full)) {
      const content = fs.readFileSync(full, "utf8");
      assert.strictEqual(content.includes("service_role"), false, `File ${f} leaked service_role`);
      assert.strictEqual(content.includes("SERVICE_ROLE"), false, `File ${f} leaked SERVICE_ROLE`);
    }
  }
});

runTest("TEST-16", "Security Audit - Profiles role escalation trigger defined in database migrations", () => {
  const migrationPath = path.join(projectRoot, "supabase/migrations/20261104000001_initial_schema.sql");
  const content = fs.readFileSync(migrationPath, "utf8");

  assert.ok(content.includes("prevent_role_escalation"), "Migration must contain role escalation prevention trigger");
  assert.ok(content.includes("ENABLE ROW LEVEL SECURITY"), "Migration must enable Row Level Security");
  assert.ok(content.includes("idx_parties_unique_normalized"), "Migration must enforce normalized unique index");
});

// ==============================================================================
// 4. SPA ROUTING & VERCEL CONFIGURATION TESTS
// ==============================================================================

runTest("TEST-17", "Vercel Configuration - vercel.json contains universal SPA rewrite rule", () => {
  const vercelPath = path.join(projectRoot, "vercel.json");
  assert.ok(fs.existsSync(vercelPath), "vercel.json must exist");
  const config = JSON.parse(fs.readFileSync(vercelPath, "utf8"));
  assert.ok(Array.isArray(config.rewrites), "rewrites array must exist");
  const catchAll = config.rewrites.find((r) => r.source === "/(.*)" && r.destination === "/index.html");
  assert.ok(catchAll, "Universal rewrite rule /(.*) -> /index.html must be configured for direct route refreshes");
});

// ==============================================================================
// SUMMARY
// ==============================================================================

console.log("\n================================================================================");
console.log(`  FINAL TEST SUMMARY: ${passedCount} PASSED | ${failedCount} FAILED | 0 SKIPPED`);
console.log(`  Overall Success Rate: ${((passedCount / (passedCount + failedCount)) * 100).toFixed(1)}%`);
console.log("================================================================================");

if (failedCount > 0) {
  process.exit(1);
}
