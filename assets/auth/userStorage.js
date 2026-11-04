const USERS_KEY = "cng_store_User";
const ROLES = new Set(["admin", "user", "viewer"]);
const SENSITIVE_FIELDS = new Set([
  "password",
  "passwordhash",
  "credentialhash",
  "hash",
  "token",
  "accesstoken",
  "refreshtoken",
  "secret",
  "clientsecret",
  "apisecret",
  "apikey",
  "authorization",
  "jwt",
  "privatekey",
]);

function sanitizeUser(user) {
  return Object.fromEntries(
    Object.entries(user).filter(([key]) =>
      !SENSITIVE_FIELDS.has(key.toLowerCase().replace(/[_-]/g, "")),
    ),
  );
}

function readUsers() {
  const serialized = localStorage.getItem(USERS_KEY);
  if (serialized === null) return [];
  const users = JSON.parse(serialized);
  if (!Array.isArray(users)) throw new Error("Stored user data is invalid.");
  return users;
}

function normalized(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function getUsers() {
  try {
    const storedUsers = readUsers();
    const users = storedUsers.map(sanitizeUser);
    if (JSON.stringify(users) !== JSON.stringify(storedUsers)) {
      saveUsers(users);
    }
    return users;
  } catch (error) {
    throw new Error("Could not read saved users.", { cause: error });
  }
}

export function saveUsers(users) {
  if (!Array.isArray(users)) throw new TypeError("Users must be an array.");
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users.map(sanitizeUser)));
  } catch (error) {
    throw new Error("Could not save users in browser storage.", { cause: error });
  }
}

export function getUserByEmail(email) {
  const sought = normalized(email);
  return getUsers().find((user) => normalized(user.email) === sought) ?? null;
}

export function getUserByUsername(username) {
  const sought = normalized(username);
  return getUsers().find((user) => normalized(user.username) === sought) ?? null;
}

export async function createUser(userData) {
  const email = normalized(userData.email);
  const username = String(userData.username ?? "").trim();
  const name = String(userData.name ?? "").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }
  if (!username) throw new Error("Username is required.");
  if (!name) throw new Error("Name is required.");
  if (!ROLES.has(userData.role)) throw new Error("Choose a valid user role.");

  const users = getUsers();
  if (users.some((user) => normalized(user.email) === email)) {
    throw new Error("An account with this email already exists.");
  }
  if (users.some((user) => normalized(user.username) === normalized(username))) {
    throw new Error("This username is already taken.");
  }

  const updatedUsers = getUsers();
  if (updatedUsers.some((user) => normalized(user.email) === email)) {
    throw new Error("An account with this email already exists.");
  }
  if (updatedUsers.some((user) => normalized(user.username) === normalized(username))) {
    throw new Error("This username is already taken.");
  }

  const user = {
    id: `user_${crypto.randomUUID().replaceAll("-", "")}`,
    email,
    username,
    name,
    role: userData.role,
    createdAt: new Date().toISOString(),
    lastLogin: null,
    isActive: true,
  };
  updatedUsers.push(user);
  saveUsers(updatedUsers);
  return user;
}

export function updateUser(id, partial) {
  const users = getUsers();
  const index = users.findIndex((user) => user.id === id);
  if (index < 0) return null;

  const changes = sanitizeUser(partial);
  delete changes.id;
  if (changes.email !== undefined) {
    changes.email = normalized(changes.email);
    if (users.some((user, itemIndex) => itemIndex !== index && normalized(user.email) === changes.email)) {
      throw new Error("An account with this email already exists.");
    }
  }
  if (changes.username !== undefined) {
    changes.username = String(changes.username).trim();
    if (users.some((user, itemIndex) => itemIndex !== index && normalized(user.username) === normalized(changes.username))) {
      throw new Error("This username is already taken.");
    }
  }
  if (changes.role !== undefined && !ROLES.has(changes.role)) {
    throw new Error("Choose a valid user role.");
  }

  users[index] = { ...users[index], ...changes, id };
  saveUsers(users);
  return users[index];
}

export function deleteUser(id) {
  const users = getUsers();
  const remaining = users.filter((user) => user.id !== id);
  if (remaining.length === users.length) return false;
  saveUsers(remaining);
  return true;
}
