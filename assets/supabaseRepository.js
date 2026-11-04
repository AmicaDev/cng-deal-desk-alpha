/**
 * Supabase Entity Repository for CNG Deal Desk Alpha V2
 * 
 * Replaces the mock/localStorage __B44_DB__ implementation with production Supabase
 * PostgreSQL queries and real Supabase Auth.
 */

import { supabase } from "./supabaseClient.js";

// Counterparty normalization rules
export function normalizeCounterpartyName(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

export function normalizeDistrict(district) {
  return String(district ?? "")
    .trim()
    .toLowerCase() || "unknown";
}

// Generate random ID consistent with existing Alpha V2 rec_* pattern
export function generateRecordId() {
  return "rec_" + Math.random().toString(36).substr(2, 9);
}

// Table mapping
const TABLE_MAP = {
  Party: "parties",
  Observation: "observations",
  Deal: "deals",
  DealEvent: "deal_events",
  User: "profiles",
};

function createEntityRepository(entityName) {
  const tableName = TABLE_MAP[entityName] || entityName.toLowerCase();

  return {
    async filter(query = {}, options = {}) {
      let req = supabase.from(tableName).select("*");

      // Apply equality filters
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== "") {
          req = req.eq(key, value);
        }
      }

      // Apply sorting
      if (options.sort) {
        const desc = options.sort.startsWith("-");
        const col = desc ? options.sort.slice(1) : options.sort;
        req = req.order(col, { ascending: !desc });
      } else {
        // Default sort by created_date desc if column exists
        if (["parties", "observations", "deals", "deal_events"].includes(tableName)) {
          req = req.order(tableName === "profiles" ? "created_at" : "created_date", { ascending: false });
        }
      }

      // Apply limit
      if (options.limit && Number.isFinite(options.limit)) {
        req = req.limit(options.limit);
      }

      const { data, error } = await req;
      if (error) {
        console.error(`Supabase filter query failed on ${tableName}:`, error);
        throw error;
      }
      return data || [];
    },

    async get(id) {
      if (!id) return null;
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error(`Supabase get query failed on ${tableName} for ID ${id}:`, error);
        throw error;
      }
      return data || null;
    },

    async create(payload = {}) {
      const id = payload.id || generateRecordId();
      const now = new Date().toISOString();

      // Special duplicate protection for Party
      if (entityName === "Party") {
        if (!payload.name || !String(payload.name).trim()) {
          throw new Error("Party name is required.");
        }
        const normName = normalizeCounterpartyName(payload.name);
        const normDist = normalizeDistrict(payload.district);

        // Frontend pre-check against database
        const { data: existingParties } = await supabase
          .from("parties")
          .select("id, name, district");

        if (existingParties && existingParties.length > 0) {
          const match = existingParties.find(
            (p) =>
              normalizeCounterpartyName(p.name) === normName &&
              normalizeDistrict(p.district) === normDist
          );
          if (match) {
            const duplicateError = new Error("Counterparty with this name already exists in this district");
            duplicateError.status = 409;
            duplicateError.code = "DUPLICATE_COUNTERPARTY";
            duplicateError.error = "DUPLICATE_COUNTERPARTY";
            duplicateError.existingId = match.id;
            throw duplicateError;
          }
        }
      }

      // Sanitize fields and build record
      const record = {
        id,
        created_date: payload.created_date || now,
        updated_date: payload.updated_date || now,
        ...payload,
      };

      const { data, error } = await supabase
        .from(tableName)
        .insert(record)
        .select()
        .single();

      if (error) {
        // Handle PostgreSQL unique constraint violation (code 23505)
        if (entityName === "Party" && (error.code === "23505" || error.message?.includes("unique") || error.message?.includes("normalized"))) {
          const duplicateError = new Error("Counterparty with this name already exists in this district");
          duplicateError.status = 409;
          duplicateError.code = "DUPLICATE_COUNTERPARTY";
          duplicateError.error = "DUPLICATE_COUNTERPARTY";
          throw duplicateError;
        }
        console.error(`Supabase insert failed on ${tableName}:`, error);
        throw error;
      }

      return data;
    },

    async update(id, payload = {}) {
      if (!id) throw new Error("ID is required for update.");
      const now = new Date().toISOString();

      // Clean payload: remove id from update body
      const { id: _, ...cleanPayload } = payload;
      cleanPayload.updated_date = now;

      const { data, error } = await supabase
        .from(tableName)
        .update(cleanPayload)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        if (entityName === "Party" && (error.code === "23505" || error.message?.includes("unique"))) {
          const duplicateError = new Error("Counterparty with this name already exists in this district");
          duplicateError.status = 409;
          duplicateError.code = "DUPLICATE_COUNTERPARTY";
          duplicateError.error = "DUPLICATE_COUNTERPARTY";
          throw duplicateError;
        }
        console.error(`Supabase update failed on ${tableName} for ID ${id}:`, error);
        throw error;
      }

      return data;
    },

    async delete(id) {
      if (!id) throw new Error("ID is required for delete.");
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq("id", id);

      if (error) {
        console.error(`Supabase delete failed on ${tableName} for ID ${id}:`, error);
        throw error;
      }

      return { success: true };
    },

    async deleteMany(query = {}) {
      let req = supabase.from(tableName).delete();
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== "") {
          req = req.eq(key, value);
        }
      }
      const { error } = await req;
      if (error) {
        console.error(`Supabase deleteMany failed on ${tableName}:`, error);
        throw error;
      }
      return { success: true };
    },

    async bulkCreate(records = []) {
      if (!Array.isArray(records) || records.length === 0) return [];
      const now = new Date().toISOString();
      const sanitized = records.map((r) => ({
        id: r.id || generateRecordId(),
        created_date: r.created_date || now,
        updated_date: r.updated_date || now,
        ...r,
      }));

      const { data, error } = await supabase
        .from(tableName)
        .insert(sanitized)
        .select();

      if (error) {
        console.error(`Supabase bulkCreate failed on ${tableName}:`, error);
        throw error;
      }

      return data || [];
    },
  };
}

export function createSupabaseDatabaseAdapter() {
  const entityCache = {};

  return {
    app: {
      async getPublicSettings() {
        try {
          const { data } = await supabase.from("app_settings").select("*");
          const settings = {};
          if (data) {
            for (const row of data) {
              settings[row.key] = row.value;
            }
          }
          return { id: "cng-deal-desk", public_settings: settings };
        } catch {
          return { id: "cng-deal-desk", public_settings: {} };
        }
      },
    },

    auth: {
      async isAuthenticated() {
        const { data: { session } } = await supabase.auth.getSession();
        return Boolean(session?.user);
      },

      async me() {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session?.user) return null;

        const user = session.user;
        try {
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

          if (profile && !error) {
            return {
              id: profile.id,
              email: profile.email,
              username: profile.username,
              name: profile.name,
              role: profile.role,
              last_login: profile.last_login,
              is_active: profile.is_active,
            };
          }
        } catch {
          // Fall back to user metadata if profile not yet committed
        }

        return {
          id: user.id,
          email: user.email,
          username: user.user_metadata?.username || user.email?.split("@")[0] || "user",
          name: user.user_metadata?.name || user.email?.split("@")[0] || "Desk User",
          role: user.user_metadata?.role || "user",
          last_login: user.last_sign_in_at,
          is_active: true,
        };
      },

      async login(credentials) {
        if (!credentials.email || !credentials.password) {
          throw new Error("Email and password are required.");
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: credentials.email.trim(),
          password: credentials.password,
        });

        if (error) {
          throw new Error(error.message || "Invalid email or password.");
        }

        // Record last login in profiles
        if (data?.user?.id) {
          await supabase
            .from("profiles")
            .update({ last_login: new Date().toISOString() })
            .eq("id", data.user.id);
        }

        return data.user;
      },

      async register(userData) {
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
              // Role is NOT self-assigned; database trigger sets role to 'user'
            },
          },
        });

        if (error) {
          throw new Error(error.message || "Could not complete registration.");
        }

        return data.user;
      },

      async logout() {
        await supabase.auth.signOut();
        window.location.assign("/login");
      },

      redirectToLogin() {
        if (!["/login", "/register"].includes(window.location.pathname)) {
          window.location.assign("/login");
        }
      },

      async deleteAccount() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return { success: false };
        const userId = session.user.id;

        // Mark user profile as inactive
        await supabase
          .from("profiles")
          .update({ is_active: false })
          .eq("id", userId);

        await supabase.auth.signOut();
        return { success: true };
      },
    },

    entities: new Proxy({}, {
      get(_, entityName) {
        if (!entityCache[entityName]) {
          entityCache[entityName] = createEntityRepository(entityName);
        }
        return entityCache[entityName];
      },
    }),

    integrations: {
      Core: {
        async UploadFile(file) {
          try {
            const fileName = `${Date.now()}_${file.name}`;
            const { data, error } = await supabase.storage
              .from("evidence")
              .upload(fileName, file);

            if (error) throw error;
            const { data: urlData } = supabase.storage
              .from("evidence")
              .getPublicUrl(data.path);

            return { file_url: urlData.publicUrl };
          } catch (err) {
            console.warn("Evidence upload fell back to local URL:", err);
            return { file_url: URL.createObjectURL(file) };
          }
        },
      },
    },
  };
}

