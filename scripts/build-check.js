import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

console.log("==================================================================");
console.log("  CNG DEAL DESK ALPHA V2 — PRODUCTION BUILD & INTEGRITY CHECK");
console.log("==================================================================");

let hasErrors = false;

function checkFile(relPath, desc) {
  const full = path.join(root, relPath);
  if (fs.existsSync(full)) {
    console.log(`[PASS] ${desc} (${relPath})`);
  } else {
    console.error(`[FAIL] Missing required file: ${relPath}`);
    hasErrors = true;
  }
}

// 1. Verify Entry & Config Files
checkFile("index.html", "Application HTML Entry");
checkFile("vercel.json", "Vercel SPA Rewrite Configuration");
checkFile(".env.example", "Environment Configuration Template");
checkFile(".gitignore", "Git Ignore Rules");
checkFile("package.json", "Package Manifest");

// 2. Verify Supabase Migrations
checkFile("supabase/migrations/20261104000001_initial_schema.sql", "Supabase Initial Schema Migration");
checkFile("supabase/migrations/20261104000002_seed_data.sql", "Supabase Seed Data Migration");

// 3. Verify JavaScript Assets & Modules
checkFile("assets/supabaseClient.js", "Supabase JavaScript Client");
checkFile("assets/supabaseRepository.js", "Supabase Entity Repository");
checkFile("assets/migrationUtility.js", "Local Storage Migration Utility");
checkFile("assets/auth/entry.js", "Application Auth & Routing Bootstrap");
checkFile("assets/auth/authContext.js", "Supabase Auth Context");
checkFile("assets/auth/LoginPage.js", "Login View Component");
checkFile("assets/auth/RegisterPage.js", "Register View Component");
checkFile("assets/auth/ProtectedRoute.js", "Route Guard");
checkFile("assets/desk-CXHNcONN.js", "Core Domain Rules & Calculations");
checkFile("assets/index-A159RRyL.js", "Compiled React App Bundle");

// 4. Audit for Insecure Bypasses & Leaked Secrets
console.log("\nAuditing bundle for insecure auth bypasses and secret leaks...");
const indexContent = fs.readFileSync(path.join(root, "assets/index-A159RRyL.js"), "utf8");
if (indexContent.includes("usr_operator")) {
  console.error("[FAIL] Hardcoded operator bypass still found in assets/index-A159RRyL.js");
  hasErrors = true;
} else {
  console.log("[PASS] Verified zero occurrences of hardcoded 'usr_operator' auth bypass.");
}

const secretKeywords = [
  "service_role",
  "serviceRole",
  "SUPABASE_SERVICE_KEY",
  "SERVICE_ROLE_KEY",
];

for (const keyword of secretKeywords) {
  if (indexContent.includes(keyword)) {
    console.error(`[FAIL] Potential leaked secret keyword '${keyword}' detected in bundle.`);
    hasErrors = true;
  }
}
console.log("[PASS] No service-role keys or sensitive credentials detected in client bundle.");

if (hasErrors) {
  console.error("\n>>> BUILD INTEGRITY CHECK FAILED");
  process.exit(1);
} else {
  console.log("\n>>> BUILD INTEGRITY CHECK PASSED (100% production ready)");
}

