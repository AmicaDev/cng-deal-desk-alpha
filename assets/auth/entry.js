import {
  deleteCurrentAccount,
  fetchCurrentSessionUser,
  getCurrentUser,
  login,
  logout,
  register,
} from "./authContext.js";
import { renderLoginPage } from "./LoginPage.js";
import { renderRegisterPage } from "./RegisterPage.js";
import { createLogoutButton } from "./LogoutButton.js";
import { requireAuthenticatedUser } from "./ProtectedRoute.js";
import { createSupabaseDatabaseAdapter } from "../supabaseRepository.js";
import { checkMigrationNeeded, migrateLocalStorageToSupabase } from "../migrationUtility.js";

const ROOT_ID = "root";
const AUTH_ID = "cng-auth-root";
const AUTH_PATHS = new Set(["/login", "/register", "/logout"]);
let logoutButton;

// Install the production Supabase database adapter on globalThis.__B44_DB__
function installSupabaseAdapter() {
  const adapter = createSupabaseDatabaseAdapter();
  // Override auth methods to sync with our authContext session cache
  adapter.auth.isAuthenticated = async () => Boolean(getCurrentUser() || (await fetchCurrentSessionUser()));
  adapter.auth.me = async () => getCurrentUser() || (await fetchCurrentSessionUser());
  adapter.auth.login = login;
  adapter.auth.register = register;
  adapter.auth.logout = () => {
    logout().then(() => window.location.assign("/login"));
  };
  adapter.auth.redirectToLogin = () => {
    if (!AUTH_PATHS.has(window.location.pathname)) {
      window.location.assign("/login");
    }
  };
  adapter.auth.deleteAccount = async () => ({
    success: await deleteCurrentAccount(),
  });

  globalThis.__B44_DB__ = adapter;
}

function addStyles() {
  const style = document.createElement("style");
  style.textContent = `
    #${AUTH_ID} { position: fixed; inset: 0; z-index: 2147483000; display: grid; place-items: center; overflow: auto; padding: 24px; background: #f8fafc; color: #0f172a; font: 14px/1.5 system-ui, -apple-system, sans-serif; }
    #${AUTH_ID}[hidden] { display: none; }
    #${AUTH_ID} .auth-card { box-sizing: border-box; width: min(100%, 440px); padding: 32px; border: 1px solid #e2e8f0; border-radius: 16px; background: white; box-shadow: 0 16px 48px #0f172a14; }
    #${AUTH_ID} .auth-brand { color: #047857; font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    #${AUTH_ID} h1 { margin: 14px 0 4px; font-size: 26px; font-weight: 700; line-height: 1.2; letter-spacing: -0.02em; }
    #${AUTH_ID} .auth-subtitle, #${AUTH_ID} .auth-switch { color: #64748b; font-size: 13.5px; }
    #${AUTH_ID} form { display: grid; gap: 14px; margin-top: 24px; }
    #${AUTH_ID} label { display: grid; gap: 6px; color: #334155; font-weight: 600; font-size: 13px; }
    #${AUTH_ID} input, #${AUTH_ID} select { box-sizing: border-box; width: 100%; min-height: 42px; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: white; color: #0f172a; font: inherit; }
    #${AUTH_ID} input:focus, #${AUTH_ID} select:focus { outline: 2px solid #047857; outline-offset: 1px; }
    #${AUTH_ID} .auth-hint { margin: -6px 0 0; color: #64748b; font-size: 12px; }
    #${AUTH_ID} .auth-error { min-height: 20px; margin: 0; color: #b91c1c; font-size: 13px; font-weight: 500; }
    #${AUTH_ID} .auth-submit { min-height: 44px; border: 0; border-radius: 8px; background: #047857; color: white; font: inherit; font-weight: 600; cursor: pointer; transition: background-color 0.15s ease; }
    #${AUTH_ID} .auth-submit:hover { background: #065f46; }
    #${AUTH_ID} .auth-submit:disabled { cursor: wait; opacity: .7; }
    #${AUTH_ID} .auth-switch { margin: 20px 0 0; text-align: center; }
    #${AUTH_ID} a { color: #047857; font-weight: 600; }
    .auth-logout { position: fixed; right: 18px; bottom: 18px; z-index: 2147482000; border: 1px solid #cbd5e1; border-radius: 999px; padding: 9px 16px; background: white; color: #0f172a; box-shadow: 0 4px 16px #0f172a20; font: 600 13px system-ui, sans-serif; cursor: pointer; }
    .auth-logout:hover { background: #f8fafc; }
  `;
  document.head.append(style);
}

function navigate(path) {
  window.history.pushState({}, "", path);
  renderCurrentPath();
}

async function onLogin(credentials) {
  const user = await login(credentials);
  if (user) {
    // Check and trigger background migration if offline records exist
    if (await checkMigrationNeeded()) {
      migrateLocalStorageToSupabase(user).catch((err) => {
        console.warn("Background migration encountered notice:", err);
      });
    }
  }
  window.location.replace("/");
}

async function onRegister(userData) {
  await register(userData);
  window.location.replace("/");
}

async function renderCurrentPath() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const root = document.getElementById(ROOT_ID);
  const authRoot = document.getElementById(AUTH_ID);
  const user = await fetchCurrentSessionUser();
  const loggedIn = Boolean(user);

  if (logoutButton) {
    logoutButton.hidden = !loggedIn;
  }

  if (path === "/logout") {
    await logout();
    window.location.replace("/login");
    return;
  }

  if (AUTH_PATHS.has(path)) {
    if (loggedIn) {
      window.location.replace("/");
      return;
    }
    if (root) root.hidden = true;
    if (authRoot) {
      authRoot.hidden = false;
      if (path === "/register") {
        renderRegisterPage(authRoot, {
          onRegister,
          onLogin: () => navigate("/login"),
        });
      } else {
        renderLoginPage(authRoot, {
          onLogin,
          onRegister: () => navigate("/register"),
        });
      }
    }
    return;
  }

  if (authRoot) authRoot.hidden = true;

  if (!loggedIn) {
    await requireAuthenticatedUser();
    return;
  }

  if (root) root.hidden = false;
}

async function initialize() {
  installSupabaseAdapter();

  const root = document.getElementById(ROOT_ID);
  if (root) root.hidden = true;

  const authRoot = document.createElement("div");
  authRoot.id = AUTH_ID;
  authRoot.hidden = true;
  document.body.append(authRoot);
  addStyles();

  // Load the React application bundle
  await import("../index-A159RRyL.js");

  logoutButton = createLogoutButton(async () => {
    await logout();
    window.location.replace("/login");
  });
  logoutButton.hidden = true;
  document.body.append(logoutButton);

  window.addEventListener("popstate", renderCurrentPath);
  await renderCurrentPath();
}

initialize().catch((error) => {
  console.error("Authentication initialization failed.", {
    code: error instanceof Error ? error.name : "UNKNOWN_ERROR",
    message: error?.message,
    timestamp: Date.now(),
  });
  const root = document.getElementById(ROOT_ID);
  if (root) {
    root.hidden = false;
    root.innerHTML = `<div style="padding: 32px; font-family: sans-serif; text-align: center; color: #b91c1c;">
      <h2>Connection Error</h2>
      <p>Could not connect to authentication services. Please check your network and refresh.</p>
    </div>`;
  }
});
