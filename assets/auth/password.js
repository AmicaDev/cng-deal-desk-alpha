function cryptoApi() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error("Secure password hashing is unavailable in this browser.");
  }
  return globalThis.crypto;
}

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value) {
  if (!/^(?:[0-9a-f]{2})+$/i.test(value)) return null;
  return Uint8Array.from(value.match(/.{2}/g), (byte) => Number.parseInt(byte, 16));
}

const PBKDF2_ITERATIONS = 600_000;

async function derive(password, salt, iterations) {
  const crypto = cryptoApi();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return toHex(new Uint8Array(await crypto.subtle.deriveBits({
    name: "PBKDF2",
    hash: "SHA-256",
    salt,
    iterations,
  }, key, 256)));
}

export async function hashPassword(password) {
  const salt = cryptoApi().getRandomValues(new Uint8Array(16));
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toHex(salt)}$${await derive(password, salt, PBKDF2_ITERATIONS)}`;
}

export async function verifyPassword(plain, hash) {
  if (typeof hash !== "string") return false;
  const [algorithm, parameter, saltHex, expected] = hash.split("$");
  if (algorithm?.toLowerCase() === "sha256") {
    const salt = fromHex(parameter || "");
    const expectedHash = fromHex(saltHex || "");
    if (!salt || !expectedHash) return false;
    const crypto = cryptoApi();
    const candidates = await Promise.all([
      `${parameter}:${plain}`,
      `${plain}:${parameter}`,
    ].map(async (value) => toHex(new Uint8Array(await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(value),
    )))));
    return candidates.some((candidate) => constantTimeEqual(candidate, saltHex));
  }
  const iterations = Number(parameter);
  const salt = fromHex(saltHex || "");
  if (
    algorithm !== "pbkdf2" ||
    !Number.isSafeInteger(iterations) ||
    iterations < 100_000 ||
    iterations > 1_000_000 ||
    !salt ||
    !fromHex(expected || "")
  ) return false;
  const actual = await derive(plain, salt, iterations);
  return constantTimeEqual(actual, expected);
}

function constantTimeEqual(actual, expected) {
  actual = actual.toLowerCase();
  expected = expected.toLowerCase();
  if (actual.length !== expected.length) return false;

  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

export function needsPasswordRehash(hash) {
  if (typeof hash !== "string") return true;
  if (hash.startsWith("sha256$")) return true;
  const [algorithm, iterations] = hash.split("$");
  return algorithm !== "pbkdf2" || Number(iterations) < PBKDF2_ITERATIONS;
}

export function validatePasswordStrength(password) {
  const errors = [];
  if (password.length < 8) errors.push("Use at least 8 characters.");
  if (!/[A-Z]/.test(password)) errors.push("Add an uppercase letter.");
  if (!/[a-z]/.test(password)) errors.push("Add a lowercase letter.");
  if (!/[0-9]/.test(password)) errors.push("Add a number.");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("Add a symbol.");
  return { valid: errors.length === 0, errors };
}
