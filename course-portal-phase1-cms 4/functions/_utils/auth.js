// Shared auth helpers for Pages Functions:
// - PBKDF2 password hashing (no external deps, uses the platform Web Crypto API)
// - Signed, HttpOnly session cookies (HMAC-SHA256) instead of a sessions table

const encoder = new TextEncoder();
const PBKDF2_ITERATIONS = 100000;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

function toBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function fromBase64(str) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return `${PBKDF2_ITERATIONS}:${toBase64(salt)}:${toBase64(bits)}`;
}

export async function verifyPassword(password, stored) {
  const parts = (stored || "").split(":");
  if (parts.length !== 3) return false;
  const [iterStr, saltB64, hashB64] = parts;
  const iterations = parseInt(iterStr, 10);
  const salt = fromBase64(saltB64);
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, keyMaterial, 256);
  return toBase64(bits) === hashB64;
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return toBase64(sig);
}

export async function createSessionCookie(instructor, secret) {
  const payload = JSON.stringify({
    id: instructor.id,
    name: instructor.name,
    email: instructor.email,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  });
  const payloadB64 = toBase64(encoder.encode(payload));
  const sig = await hmac(secret, payloadB64);
  const token = `${payloadB64}.${sig}`;
  return `pr_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookie() {
  return `pr_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const match = header
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

export async function getSession(request, secret) {
  const token = getCookie(request, "pr_session");
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expectedSig = await hmac(secret, payloadB64);
  if (expectedSig !== sig) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64(payloadB64)));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function requireAuth(request, env) {
  const session = await getSession(request, env.SESSION_SECRET);
  if (!session) {
    return {
      authorized: false,
      response: json({ error: "Not authenticated" }, { status: 401 }),
    };
  }
  return { authorized: true, session };
}

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
}
