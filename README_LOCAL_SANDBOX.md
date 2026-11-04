# CNG Deal Desk — Alpha V2 Local Test Sandbox
**Recipient**: James  
**Build Version**: Alpha V2 (v0.0.0-alpha.2)  
**Distribution Type**: Standalone Local Offline Sandbox  
**Scope**: STRICTLY FOR LOCAL TESTING AND WORKFLOW EVALUATION ONLY  

---

## IMPORTANT NOTICE: LOCAL TEST SANDBOX ENVIRONMENT
Please note that this package is configured strictly as a **local test sandbox**:
1. **Isolated Client Storage**: All records live exclusively in your local browser storage (`window.localStorage`). No data is transmitted to or shared with other computers or servers.
2. **No Live Money Movement**: This build is not connected to any bank, escrow, or mobile money gateway.
3. **Preloaded Demonstration Data**: Comes pre-populated with 5 demo counterparties, 12 regional market observations, and 2 active demonstration deals.
4. **Data Reset & Backup**: You can completely wipe or restore demo data at any time from the **/data** page.

## LOCAL ACCOUNTS
Register at `/register` and sign in at `/login`. Account profile fields (ID, email, username, name, role, activity, and timestamps) remain in `cng_store_User`; legacy password and token fields are removed automatically while preserving those profiles. New password hashes exist only in JavaScript memory and are discarded on page reload. Session state is also memory-only, so a reload signs out. After a reload, entering an existing email sets a new temporary password for this page session; this is a sandbox access gate, not identity verification. It allows continued local testing without storing passwords, password hashes, or authentication tokens in browser storage. Counterparties, deals, observations, and other workflow records remain in local storage. Logging out or deleting the local account profile does not clear workflow records. This static app has no authentication backend, HTTPS endpoint, HttpOnly cookies, or server-side session enforcement/authorization. Do not use real or reused passwords.

---

## QUICK START INSTRUCTIONS

### For Windows (Windows 10 / 11):
1. Extract this zip archive to any folder on your computer.
2. Double-click **`start-server.bat`** (or right-click `start-server.ps1` -> *Run with PowerShell*).
3. The script launches an embedded local HTTP server at `http://127.0.0.1:8080` and opens Microsoft Edge / Google Chrome in app window mode.
4. When finished, simply close the command window to stop the server.

### For macOS (Mac Computers - Intel & Apple Silicon):
1. Extract this zip archive on your Mac.
2. Double-click **`start-macos.command`** in Finder.
   *(Note: On first launch, macOS may ask for permission. Right-click `start-macos.command` and choose 'Open' -> 'Open').*
3. The app will launch in your browser at `http://127.0.0.1:8080`.

---

## WHAT TO TEST IN THIS SANDBOX

1. **The 5-Screen Deal Walkthrough** (`/walkthrough`):
   - **Step 1 (Buyer)**: Set commodity, specification, and target price.
   - **Step 2 (Supply)**: Set farmer group origin, volume, and moisture %.
   - **Step 3 (Evidence)**: Test the 8 verification gates (tickets, lab tests, transport quotes).
   - **Step 4 (Approval)**: Request and sign off internal management approval.
   - **Step 5 (Reconciliation)**: Enter accepted vs. rejected tonnes; observe 3-way financial segregation.

2. **Evidence Gating & Auto-Regression**:
   - In any deal detail screen (`/deals/:id`), try advancing without verified prerequisites. Notice how the app blocks advancement.
   - On a Stage 4 deal, revoke an earlier gate (e.g. set Buyer Authority to 'OPEN') and watch the deal automatically regress back to Stage 1.

3. **Accepted-Volume Fee Calculations**:
   - In the Reconciliation screen, change accepted tonnes from 20t to 10t (with 10t rejected). Notice how the desk fee scales strictly with accepted tonnage, while rejected tonnage incurs UGX 0.
   - Test sub-threshold volume (e.g. 0.5t) to verify the UGX 25,000 minimum fee floor.

4. **Reported vs. Verified Payment Status**:
   - Set status to 'Reported paid' vs. 'Verified paid'. Notice the unverified balance alert until verified funds are confirmed.

5. **Disaster Recovery Backup**:
   - Go to the **/data** page, click **Download a full backup**, modify or delete deals, and then click **Restore from a backup** (or drag and drop the JSON file) to verify 100% data recovery.

---

## TEST EVIDENCE
All 13 core domain rules and storage routines were verified using automated test suite `test_runner_evidence.js` under Node.js v24.20.0 with a 100% pass rate. See the attached **`ALPHA_V2_AUTOMATED_TEST_EXECUTION_LOG.txt`** file for full diagnostic traces.
