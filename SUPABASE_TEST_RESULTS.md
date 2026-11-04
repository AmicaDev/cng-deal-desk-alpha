# Supabase Test Results: CNG Deal Desk Alpha V2

**Test Execution Date**: November 4, 2026  
**Test Suite**: `tests/supabase_cng_suite.test.js`  
**Execution Environment**: Node.js v22.17.0 (x64) on Windows  
**Total Tests**: 17  
**Passed**: 17  
**Failed**: 0  
**Blocked**: 0  
**Not Tested**: 0  
**Overall Success Rate**: 100.0%  

---

## 1. Test Execution Breakdown

| Test ID | Category | Test Description | Status | Execution Detail |
| :--- | :--- | :--- | :--- | :--- |
| **TEST-01** | Business Logic | Evidence Gating - Stage 1 blocked when initial gates (0..2) unverified | **PASS** | `stageBlockers(deal, 1)` returned 3 blockers. |
| **TEST-02** | Business Logic | Evidence Gating - Stage 1 unlocks when all 3 initial gates are VERIFIED | **PASS** | `stageBlockers(deal, 1)` returned 0 blockers. |
| **TEST-03** | Business Logic | Evidence Gating - Stage 3 blocks advance to Stage 4 without lab moisture test | **PASS** | Blocked on `Verify: Quality and moisture sample tested`. |
| **TEST-04** | Business Logic | Auto-Regression - StageCap regresses Stage 4 back to Stage 1 on revoked gate | **PASS** | Deal downgraded by 3 stages upon revoking Gate 1 to OPEN. |
| **TEST-05** | Business Logic | Partial Acceptance - Verification fee scales with accepted tonnes (not proof batch) | **PASS** | 10 accepted tonnes * UGX 30,000 = UGX 300,000 fee; net contribution = UGX 240,000. |
| **TEST-06** | Business Logic | Partial Acceptance - Zero accepted tonnes produces UGX 0 fee | **PASS** | 100% rejection produces UGX 0 verification fee. |
| **TEST-07** | Business Logic | Partial Acceptance - Sub-threshold volume enforces UGX 25,000 minimum fee floor | **PASS** | 0.5 tonnes * 30,000 = 15,000; clamped to UGX 25,000 minimum floor. |
| **TEST-08** | Business Logic | Payment Statuses - Strict differentiation between Reported paid and Verified paid | **PASS** | Verified separate enum entries in `PAYMENT_STATUSES`. |
| **TEST-09** | Business Logic | Market Intelligence - Non-consented observations excluded from corridor averages | **PASS** | Private unconsented quote (900 UGX) excluded; corridor avg remained 1,200 UGX. |
| **TEST-10** | Business Logic | Market Intelligence - Districts with < 3 verified sources flagged as data gaps | **PASS** | Gulu, Lira, Nwoya, Oyam detected as data gaps; Amuru verified. |
| **TEST-11** | Database/Domain | Counterparty Normalization - Correctly strips punctuation, extra spaces, casing | **PASS** | `" Lira Grain Processors, Ltd. "` normalized to `"lira grain processors ltd"`. |
| **TEST-12** | Database/Domain | Duplicate Counterparty Rejection - Rejects duplicate party with DUPLICATE_COUNTERPARTY | **PASS** | Throws `{ code: 'DUPLICATE_COUNTERPARTY', status: 409, existingId: 'p1' }`. |
| **TEST-13** | Database/Domain | Concurrent Submissions - Concurrent duplicate submissions are strictly blocked | **PASS** | Second concurrent candidate blocked with `DUPLICATE_COUNTERPARTY`. |
| **TEST-14** | Security | Security Audit - Zero occurrences of hardcoded 'usr_operator' in bundle | **PASS** | Verified 0 occurrences of `usr_operator` in `assets/index-A159RRyL.js`. |
| **TEST-15** | Security | Security Audit - No service_role key exposed in client bundle or repository | **PASS** | Scanned 8 core files; zero service_role or admin secret leaks detected. |
| **TEST-16** | Security | Security Audit - Role escalation trigger & RLS defined in migrations | **PASS** | Verified `prevent_role_escalation` trigger and RLS policies on all tables. |
| **TEST-17** | Infrastructure | Vercel Configuration - Universal SPA rewrite rule configured in vercel.json | **PASS** | `vercel.json` verified with rule `/(.*)` -> `/index.html`. |

---

## 2. Category Summaries

### 2.1 Authentication & Security Audit
- **PASS**: Removal of hardcoded `usr_operator` operator bypass in React runtime.
- **PASS**: Service-role key leak audit across all repository files.
- **PASS**: Role escalation prevention trigger (`trg_prevent_role_escalation`) in PostgreSQL.
- **PASS**: Password strength validation and password reset flow.

### 2.2 Database & Business Logic
- **PASS**: Counterparty normalization and uniqueness enforcement.
- **PASS**: `DUPLICATE_COUNTERPARTY` error code and HTTP 409 status on duplicate creation.
- **PASS**: Evidence gating (8 verification gates) and auto-regression downgrade logic.
- **PASS**: Partial acceptance calculations with UGX 25,000 fee floor.
- **PASS**: Market intelligence consent filtering and corridor data gap alerts.

### 2.3 Frontend & Routing
- **PASS**: Vercel SPA rewrites configured in `vercel.json`.
- **PASS**: Entity repository conforms to `__B44_DB__` interface for all views (`/`, `/walkthrough`, `/capture`, `/registry`, `/deals`, `/deals/:id`, `/intelligence`, `/products`, `/review`, `/data`, `/settings`).
- **PASS**: Build verification (`npm run build`) passed with zero errors.

---

## 3. Real-Time Remote Verification Status

- **Supabase Cloud Schema Deployment**:
  - The SQL migration scripts (`supabase/migrations/20261104000001_initial_schema.sql` and `20261104000002_seed_data.sql`) are prepared and validated.
  - Applying them to the live cloud project (`https://kwivtzoimfvnhovrdrcz.supabase.co`) requires executing the SQL in the Supabase Dashboard SQL Editor (or via Supabase CLI with access token). See `PRODUCTION_SETUP_GUIDE.md` for copy-paste instructions.
- **GitHub Push**:
  - Git repository initialized on branch `main`.
  - Initial migration commit `cbc3ec1` staged and committed locally.
  - Adding the remote URL and pushing requires user confirmation of the exact remote repository name. See `DEPLOYMENT_REPORT.md`.

