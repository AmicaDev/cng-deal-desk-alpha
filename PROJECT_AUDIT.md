# Project Audit: CNG Deal Desk Alpha V2

**Audit Date**: November 4, 2026  
**Auditor**: Senior Full-Stack Software Engineer & Application Security Specialist  
**Target Environment**: CNG Deal Desk Alpha V2 (`C:\Users\ojuka\CNG_Alpha`)  
**Deployment Targets**: Supabase (PostgreSQL & Auth) + Vercel (Frontend Hosting) + GitHub (Source Control)  

---

## 1. Executive Summary

The **CNG Deal Desk Alpha V2** application was previously packaged as a standalone local offline testing sandbox (`v0.0.0-alpha.2`). It was designed for isolated in-browser evaluation using `localStorage` and client-side memory stores. 

While the core domain logic (evidence gating, partial delivery fee calculations, auto-regression, corridor price aggregations) is fully developed and well-specified, the persistence and authentication layers were mock implementations with critical security bypasses. Specifically:
- Application state lived exclusively in browser `localStorage` (`cng_store_*`).
- Authentication contained hardcoded fallback bypasses that automatically granted authenticated `admin` status to any unauthenticated visitor as `usr_operator`.
- Roles could be self-assigned from the browser.
- No real database or server-side Row Level Security (RLS) was attached.

This audit documents the complete baseline state of the repository, data models, storage structures, authentication vulnerabilities, and deployment configurations before transitioning the project to a production-grade architecture powered by Supabase.

---

## 2. Technology Stack & Project Structure

### 2.1 File System Structure
```text
C:\Users\ojuka\CNG_Alpha\
├── assets\
│   ├── auth\
│   │   ├── authContext.js           # Local storage & memory-based session manager
│   │   ├── entry.js                 # App entry point, DOM auth screens, DB adapter injection
│   │   ├── LoginPage.js             # Client DOM login form
│   │   ├── LogoutButton.js          # Client floating logout button
│   │   ├── password.js              # WebCrypto PBKDF2/SHA-256 client hasher
│   │   ├── ProtectedRoute.js        # Route guard checking memory user
│   │   ├── RegisterPage.js          # Client DOM registration form
│   │   ├── userStorage.js           # User profile storage in cng_store_User
│   │   └── userTypes.ts             # User and Auth interface types
│   ├── AccessNotice-BfaxLiRn.js     # Permission denied UI banner
│   ├── button-C0BH7B6h.js           # Radix/Tailwind button component
│   ├── Capture-CHdPrGES.js          # Observation capture view (/capture)
│   ├── Combination-CuHi7KCl.js      # Deal matching helper component
│   ├── Dashboard-C1Ax3P7I.js        # Executive summary & metrics view (/)
│   ├── Data-DV5c2Wc2.js             # Backup export/restore & overhead settings (/data)
│   ├── DealDetail-CDxTxu3t.js       # 8-gate deal detail & reconciliation (/deals/:id)
│   ├── Deals-BCwyOzL-.js            # Deal pipeline table view (/deals)
│   ├── desk-CXHNcONN.js             # Core domain logic, pricing, fee rules, gate blockers
│   ├── EmptyState-CCMewG1s.js       # Empty state illustration
│   ├── index-A159RRyL.js            # Main React application shell, routing, mock DB seed
│   ├── index-y0Vz-zph.css           # Compiled Tailwind CSS stylesheets
│   ├── Intelligence-BmcaaWVy.js     # Market price & corridor analytics (/intelligence)
│   ├── PageHeader-BnBlK87q.js       # Standard header component
│   ├── PageNotFound-BEzZ0M2-.js     # 404 handler
│   ├── Products-BY8KntuP.js         # Commodity products catalog (/products)
│   ├── Registry-C6DBQU1c.js         # Counterparty registry (/registry)
│   ├── Review-uAEaJ-f_.js           # Deal review and audit checklist (/review)
│   ├── select-B2jg6JWW.js           # Radix Select UI primitives
│   ├── Settings-CUMTF8hP.js         # User profile, theme toggle, delete account (/settings)
│   ├── StatTile-CrmxNxts.js         # Metric tile UI component
│   ├── useRecords-CUB6kMxs.js       # Generic hook for querying __B44_DB__.entities
│   ├── utils-fF95r_SJ.js            # React 18 runtime, clsx, twMerge utilities
│   └── Walkthrough-BwkD3ZYZ.js      # 5-stage interactive demonstration (/walkthrough)
├── ALPHA_V2_AUTOMATED_TEST_EXECUTION_LOG.txt  # 13 verified offline domain tests log
├── index.html                       # HTML5 entry with module preloads & entry script
├── package-lock.json                # Placeholder lockfile (empty packages dictionary)
├── README_LOCAL_SANDBOX.md          # Sandbox operational instructions
├── start-macos.command              # macOS launch script
├── start-server.bat                 # Windows batch launch script
├── start-server.ps1                 # Embedded PowerShell HTTP server on port 8080
├── vite.svg                         # Favicon asset
└── _redirects                       # Static fallback redirect for SPA
```

### 2.2 Framework & Runtime Analysis
- **UI Framework**: React 18.3.1 with React Router DOM 6.x.
- **Styling**: Tailwind CSS with Radix UI headless components.
- **Client Architecture**: Bundled ES modules executed directly in the browser via standard browser `<script type="module">`.
- **Database Abstraction**: Built around `globalThis.__B44_DB__` adhering to the Base44 entity repository interface (`entities.<Model>.filter/get/create/update/delete/deleteMany/bulkCreate`).
- **Scripts & Package Configuration**: The local workspace lacks an explicit `package.json` because it was distributed as a pre-compiled standalone artifact. 

---

## 3. Data Models and Schema Inspection

The application relies on 5 primary entities:

### 3.1 `Party` (Counterparties)
| Field | Type | Description / Constraints |
| :--- | :--- | :--- |
| `id` | `TEXT PRIMARY KEY` | e.g. `p1` or `rec_k2zdi3cpt` |
| `name` | `TEXT NOT NULL` | Entity / business name |
| `role` | `TEXT NOT NULL` | `Buyer`, `Supplier or farmer group`, `Transporter`, `District contact`, `Other` |
| `district` | `TEXT NOT NULL` | Normalized Ugandan district (`Amuru`, `Gulu`, `Lira`, `Nwoya`, `Oyam`, etc.) |
| `contact_person` | `TEXT` | Primary contact name |
| `contact_channel` | `TEXT` | Phone or WhatsApp number |
| `authority_status` | `TEXT NOT NULL DEFAULT 'OPEN'` | `OPEN`, `REPORTED`, `VERIFIED` |
| `consent_aggregate_use` | `BOOLEAN DEFAULT TRUE` | Consent for anonymized market data aggregation |
| `created_date` | `TIMESTAMPTZ` | Timestamp of creation |
| `updated_date` | `TIMESTAMPTZ` | Timestamp of last modification |

**Business Rule**: Uniqueness is strictly defined as `normalized(name) + normalized(district)`. Two parties cannot share the same name within the same district regardless of role.

### 3.2 `Observation` (Market Intelligence & Price Quotes)
| Field | Type | Description / Constraints |
| :--- | :--- | :--- |
| `id` | `TEXT PRIMARY KEY` | Unique observation identifier (`o1`, `rec_...`) |
| `type` | `TEXT NOT NULL` | `Supply offer`, `Buyer requirement`, `Price quote`, `Transport quote`, `Quality reading`, `Market note` |
| `commodity` | `TEXT NOT NULL` | `Maize`, `Beans`, `Soybeans`, `Sorghum`, `Rice`, `Cassava` |
| `district` | `TEXT NOT NULL` | Origin district |
| `place` | `TEXT` | Village, trading centre, or specific route |
| `quantity_tonnes` | `NUMERIC` | Available or required volume in tonnes |
| `price_per_kg` | `NUMERIC` | Quoted commodity price in UGX/kg |
| `transport_cost` | `NUMERIC` | Route transport quote in UGX |
| `moisture_pct` | `NUMERIC` | Tested moisture percentage (e.g. 12.8%) |
| `status` | `TEXT NOT NULL DEFAULT 'REPORTED'` | `OPEN`, `REPORTED`, `VERIFIED`, `REJECTED` |
| `observed_date` | `DATE NOT NULL` | Date observation occurred |
| `party_id` | `TEXT REFERENCES parties(id)` | Linked counterparty if known |
| `consent_aggregate_use` | `BOOLEAN DEFAULT TRUE` | Determines inclusion in corridor averages |
| `evidence_note` | `TEXT` | Verification audit trail notes |
| `created_date` | `TIMESTAMPTZ` | Creation timestamp |
| `updated_date` | `TIMESTAMPTZ` | Modification timestamp |

### 3.3 `Deal` (Commodity Deal Pipeline)
| Field | Type | Description / Constraints |
| :--- | :--- | :--- |
| `id` | `TEXT PRIMARY KEY` | e.g. `d1`, `rec_...` |
| `name` | `TEXT NOT NULL` | Deal descriptor |
| `buyer_id` | `TEXT REFERENCES parties(id)` | Counterparty (Buyer) |
| `supplier_id` | `TEXT REFERENCES parties(id)` | Counterparty (Supplier) |
| `commodity` | `TEXT NOT NULL` | e.g. `Maize` |
| `proof_quantity_tonnes` | `NUMERIC NOT NULL` | Target proof batch volume in tonnes |
| `buyer_price_per_kg` | `NUMERIC` | Agreed buyer purchase price (UGX/kg) |
| `supplier_price_per_kg` | `NUMERIC` | Agreed supplier purchase price (UGX/kg) |
| `stage` | `INTEGER NOT NULL DEFAULT 0` | Stages 0 to 7: Inquiry(0), Terms agreed(1), Supply matched(2), Supply verified(3), Execution approval(4), Movement(5), Delivered(6), Reconciled(7) |
| `evidence` | `TEXT[] / JSONB` | 8-element array tracking verification status (`OPEN`, `REPORTED`, `VERIFIED`):<br>0: Buyer fee response agreed<br>1: Buyer authority confirmed<br>2: Transport quote verified<br>3: Quantity weighed and ticket held<br>4: Quality and moisture sample tested<br>5: Stock authority and title confirmed<br>6: Counsel fee route approved<br>7: Management execution approval |
| `per_tonne_fee` | `NUMERIC DEFAULT 30000` | Desk verification fee rate per tonne |
| `minimum_fee` | `NUMERIC DEFAULT 25000` | Minimum desk fee floor |
| `commissioned` | `BOOLEAN DEFAULT FALSE` | Flag for commissioned deals |
| `cost_field` | `NUMERIC DEFAULT 0` | Field verification cash cost |
| `cost_testing` | `NUMERIC DEFAULT 0` | Lab testing cash cost |
| `cost_transport` | `NUMERIC DEFAULT 0` | Transport cash cost |
| `cost_other` | `NUMERIC DEFAULT 0` | Incidental cash costs |
| `staff_hours` | `NUMERIC DEFAULT 0` | Desk staff hours allocated |
| `staff_cost_per_hour` | `NUMERIC DEFAULT 6000` | Standard staff cost rate (UGX 6,000/hr) |
| `working_days` | `NUMERIC DEFAULT 0` | Duration in business days |
| `approval_status` | `TEXT DEFAULT 'Not requested'` | `Not requested`, `Requested`, `Approved`, `Declined`, `Conditional` |
| `payment_status` | `TEXT DEFAULT 'Not invoiced'` | `Not invoiced`, `Invoiced`, `Reported paid`, `Verified paid`, `Waived`, `Written off` |
| `classification` | `TEXT DEFAULT 'Not classified'` | Desk financial classification |
| `accepted_tonnes` | `NUMERIC` | Reconciled accepted volume (tonnes) |
| `reconciled` | `BOOLEAN DEFAULT FALSE` | Reconciliation completion flag |
| `created_date` | `TIMESTAMPTZ` | Creation timestamp |
| `updated_date` | `TIMESTAMPTZ` | Modification timestamp |

### 3.4 `DealEvent` (Timeline & Audit History)
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT PRIMARY KEY` | e.g. `e1`, `rec_...` |
| `deal_id` | `TEXT REFERENCES deals(id) ON DELETE CASCADE` | Associated deal |
| `label` | `TEXT NOT NULL` | Event milestone name |
| `detail` | `TEXT` | Detailed event notes |
| `created_date` | `TIMESTAMPTZ` | Timestamp |

### 3.5 `Profile` / `User`
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `UUID PRIMARY KEY` | References `auth.users(id)` |
| `email` | `TEXT UNIQUE NOT NULL` | User email address |
| `username` | `TEXT UNIQUE NOT NULL` | Unique user handle |
| `name` | `TEXT NOT NULL` | Full display name |
| `role` | `TEXT NOT NULL DEFAULT 'user'` | `admin`, `user`, `viewer` |
| `created_at` | `TIMESTAMPTZ DEFAULT NOW()` | Creation timestamp |
| `last_login` | `TIMESTAMPTZ` | Last authentication timestamp |
| `is_active` | `BOOLEAN DEFAULT TRUE` | Active status flag |

---

## 4. Local Storage Dependencies Audit

The offline application uses the following `localStorage` keys:

1. **`cng_store_Party`**: Serialized JSON array of all registered counterparties.
2. **`cng_store_Observation`**: Serialized JSON array of all market observations.
3. **`cng_store_Deal`**: Serialized JSON array of active and historical deals.
4. **`cng_store_DealEvent`**: Serialized JSON array of deal event entries.
5. **`cng_store_User`**: Serialized JSON array of local account profiles.
6. **`cng_store_Session`**: Temporary session storage containing `userId` and `expiresAt` (cleared on load in current build).
7. **`cng_initialized_v2`**: Boolean flag indicating seed data has been written to local storage.
8. **`cng_deal_desk_overhead` / `cng_desk_overhead`**: Number setting storing the default operational overhead percentage (defaults to 15%).

---

## 5. Security Vulnerability Analysis: Insecure Auth Bypasses

### 5.1 Hardcoded Operator Fallback
In `assets/index-A159RRyL.js`:
```javascript
let h = async () => {
  try {
    c(!0), u(null);
    let e = globalThis.__B44_DB__ || Es;
    let t = null;
    e.auth?.me && (t = await e.auth.me());
    // CRITICAL VULNERABILITY: Insecure fallback bypass
    t ||= {
      id: `usr_operator`,
      email: `operator@cngdealdesk.com`,
      name: `Desk Operator`,
      role: `admin`
    };
    n(t), i(!0), o(!1), c(!1), f(!0);
  } catch(e) {
    // CRITICAL VULNERABILITY: Catch-block fallback bypass
    n({
      id: `usr_operator`,
      email: `operator@cngdealdesk.com`,
      name: `Desk Operator`,
      role: `admin`
    });
    i(!0), c(!1), o(!1), f(!0);
  }
};
```
Furthermore, `checkUserAuth` replicates the identical bypass:
```javascript
checkUserAuth: async () => {
  try {
    o(!0);
    let e = globalThis.__B44_DB__ || Es,
        t = e.auth?.me ? await e.auth.me() : null;
    n(t || {
      id: `usr_operator`,
      email: `operator@cngdealdesk.com`,
      name: `Desk Operator`,
      role: `admin`
    });
    i(!0), o(!1), f(!0);
  } catch(e) {
    o(!1), i(!0), f(!0);
  }
}
```
**Impact**: Anyone navigating to the app directly bypasses the login screen entirely or gets treated as an authenticated Admin if the authentication check encounters an error or returns null.

### 5.2 Self-Selected Client-Side Roles
In `assets/auth/RegisterPage.js`, the registration form features a `<select name="role">` containing `<option value="admin">Admin</option>`. In `assets/auth/userStorage.js`, this value was saved directly into `localStorage`. In a multi-user environment, users must never self-promote to `admin`.

### 5.3 In-Memory Ephemeral Passwords
`assets/auth/authContext.js` kept PBKDF2 password hashes in a JavaScript `Map` that vanished upon page refresh, requiring users to type their password again or create a new password without server verification.

---

## 6. GitHub, Vercel & Infrastructure Audit

1. **Local Git Status**:
   - The directory `c:\Users\ojuka\CNG_Alpha` was unzipped from a standalone offline package and does not currently have a `.git` tracking directory.
   - User identity on the machine is configured as `user.name=AmicaDev` and `user.email=ojukajames0@gmail.com`.
   - Git needs initialization (`git init`), initial commit, and remote setup pointing to the existing GitHub repository connected to Vercel and Supabase.
2. **Vercel Routing**:
   - Currently, an Apache/Netlify style `_redirects` file is present (`/* /index.html 200`).
   - Vercel requires `vercel.json` with a rewrite rule so that direct links to `/review`, `/registry`, `/deals/:id`, and `/data` do not return 404 HTTP errors on page reload.
3. **Supabase Target**:
   - Project URL: `https://kwivtzoimfvnhovrdrcz.supabase.co`
   - Anon / Publishable Key: `sb_publishable_mjzEppyM3rRgj8zpTVCLSA_LHiChrv2`
   - Needs PostgreSQL table definitions, constraints, indexes, RLS policies, and triggers for profiles.

---

## 7. Audit Conclusion & Recommendations

The application has a sound frontend presentation layer and pristine business domain calculations. The priority is to replace the mock `__B44_DB__` layer with a genuine Supabase-backed client implementation that implements the exact same repository interface, removes the authentication bypasses, enforces real Supabase Auth, adds safe LocalStorage migration for existing records, and provides standard SPA hosting configuration for Vercel.

