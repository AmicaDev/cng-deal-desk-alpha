import { i as loadReact } from "../utils-fF95r_SJ.js";
import { supabase } from "../supabaseClient.js";

const React = loadReact();
export const AuthContext = React.createContext(null);

let activeUserCache = null;

// Synchronously or asynchronously fetch current authenticated user
export function getCurrentUser() {
  return activeUserCache;
}

export async function fetchCurrentSessionUser() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.user) {
      activeUserCache = null;
      return null;
    }

    const user = session.user;
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        activeUserCache = {
          id: profile.id,
          email: profile.email,
          username: profile.username,
          name: profile.name,
          role: profile.role,
          lastLogin: profile.last_login,
          isActive: profile.is_active,
        };
        return activeUserCache;
      }
    } catch {
      // Profile table query error fallback to user metadata
    }

    activeUserCache = {
      id: user.id,
      email: user.email,
      username: user.user_metadata?.username || user.email?.split("@")[0] || "user",
      name: user.user_metadata?.name || user.email?.split("@")[0] || "Desk User",
      role: user.user_metadata?.role || "user",
      lastLogin: user.last_sign_in_at,
      isActive: true,
    };
    return activeUserCache;
  } catch (err) {
    console.warn("Session check error:", err);
    activeUserCache = null;
    return null;
  }
}

export async function resendConfirmationEmail(email) {
  if (!email || !email.includes("@")) {
    throw new Error("Enter a valid email address.");
  }
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.trim(),
  });
  if (error) {
    if (error.code === "over_email_send_rate_limit" || error.message?.includes("rate limit")) {
      throw new Error("Email send rate limit reached. Please wait a few minutes or confirm your user in the Supabase Dashboard.");
    }
    throw new Error(error.message || "Could not resend confirmation email.");
  }
  return true;
}

export async function login(credentials) {
  if (!credentials.email || !credentials.password) {
    throw new Error("Email and password are required.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email.trim(),
    password: credentials.password,
  });

  if (error) {
    if (error.message.includes("Invalid login credentials") || error.code === "invalid_credentials") {
      throw new Error("Email or password is incorrect.");
    }
    if (error.message.includes("Email not confirmed") || error.code === "email_not_confirmed") {
      const err = new Error("Email not confirmed. Please check your inbox or confirm the user in Supabase.");
      err.code = "email_not_confirmed";
      throw err;
    }
    throw new Error(error.message || "Failed to sign in.");
  }

  const user = await fetchCurrentSessionUser();
  if (user && !user.isActive) {
    await supabase.auth.signOut();
    activeUserCache = null;
    throw new Error("This account is inactive. Contact an administrator.");
  }

  return user;
}

export async function register(userData) {
  if (!userData.email || !userData.password) {
    throw new Error("Email and password are required.");
  }
  if (userData.password !== userData.confirmPassword) {
    throw new Error("Passwords do not match.");
  }

  const { data, error } = await supabase.auth.signUp({
    email: userData.email.trim(),
    password: userData.password,
    options: {
      data: {
        name: userData.name?.trim(),
        username: userData.username?.trim(),
      },
    },
  });

  if (error) {
    if (error.code === "over_email_send_rate_limit" || error.message?.includes("rate limit")) {
      throw new Error("Supabase email rate limit reached. Please disable 'Confirm email' in Supabase Dashboard -> Auth -> Providers -> Email.");
    }
    throw new Error(error.message || "Registration failed.");
  }

  if (!data?.session && data?.user) {
    return {
      user: data.user,
      needsConfirmation: true,
      message: "Registration successful! Please confirm your email before signing in.",
    };
  }

  const user = await fetchCurrentSessionUser();
  return { user: user || data?.user, needsConfirmation: false };
}

export async function logout() {
  activeUserCache = null;
  await supabase.auth.signOut();
}

export async function deleteCurrentAccount() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return false;

  await supabase
    .from("profiles")
    .update({ is_active: false })
    .eq("id", session.user.id);

  await logout();
  return true;
}

export async function resetPassword(email) {
  if (!email || !email.includes("@")) {
    throw new Error("Enter a valid email address.");
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/settings`,
  });
  if (error) throw error;
  return true;
}

export function AuthProvider({ children }) {
  const [state, setState] = React.useState({
    user: null,
    isAuthenticated: false,
    loading: true,
    error: null,
  });

  React.useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const user = await fetchCurrentSessionUser();
        if (mounted) {
          setState({
            user,
            isAuthenticated: Boolean(user),
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        if (mounted) {
          setState({
            user: null,
            isAuthenticated: false,
            loading: false,
            error: err.message,
          });
        }
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
          const user = await fetchCurrentSessionUser();
          setState({
            user,
            isAuthenticated: Boolean(user),
            loading: false,
            error: null,
          });
        } else if (event === "SIGNED_OUT") {
          activeUserCache = null;
          setState({
            user: null,
            isAuthenticated: false,
            loading: false,
            error: null,
          });
        }
      }
    );

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const value = React.useMemo(() => ({
    ...state,
    login: async (credentials) => {
      const u = await login(credentials);
      setState({ user: u, isAuthenticated: Boolean(u), loading: false, error: null });
      return u;
    },
    register: async (userData) => {
      const u = await register(userData);
      setState({ user: u, isAuthenticated: Boolean(u), loading: false, error: null });
      return u;
    },
    logout: async () => {
      await logout();
      setState({ user: null, isAuthenticated: false, loading: false, error: null });
    },
    deleteAccount: async () => {
      const ok = await deleteCurrentAccount();
      if (ok) {
        setState({ user: null, isAuthenticated: false, loading: false, error: null });
      }
      return ok;
    },
    resetPassword,
  }), [state]);

  return React.createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
