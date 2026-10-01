// Shared helpers for Pages Functions: auth, JSON responses, content storage.
import DEFAULT_CONTENT from "./default-content.json";

export const CONTENT_KEY = "site-content";
const COOKIE = "ugc_admin";
const SESSION_HOURS = 24 * 14;

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });
}

export function error(message, status = 400) {
  return json({ error: message }, status);
}

export async function loadContent(env) {
  if (env.CONTENT) {
    const stored = await env.CONTENT.get(CONTENT_KEY, "json");
    if (stored) return stored;
  }
  return DEFAULT_CONTENT;
}

export async function saveContent(env, content) {
  if (!env.CONTENT) throw new Error("KV binding CONTENT is not configured");
  content.updatedAt = new Date().toISOString();
  await env.CONTENT.put(CONTENT_KEY, JSON.stringify(content));
  return content;
}

export function defaultContent() {
  return structuredClone(DEFAULT_CONTENT);
}

// ---------- auth ----------
const enc = new TextEncoder();

function secretOf(env) {
  const s = env.SESSION_SECRET || env.ADMIN_PASSWORD;
  if (!s) throw new Error("ADMIN_PASSWORD is not configured");
  return s;
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function checkPassword(env, password) {
  if (!env.ADMIN_PASSWORD) return false;
  // Compare HMACs so the comparison is constant-length.
  const a = await hmac("pw", String(password || ""));
  const b = await hmac("pw", env.ADMIN_PASSWORD);
  return safeEqual(a, b);
}

export async function makeSessionCookie(env, request) {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  const token = `${exp}.${await hmac(secretOf(env), String(exp))}`;
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}${secure}`;
}

export function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

export async function isAuthed(env, request) {
  const cookie = request.headers.get("cookie") || "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return false;
  const [exp, sig] = m[1].split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  try {
    return safeEqual(sig, await hmac(secretOf(env), exp));
  } catch {
    return false;
  }
}

// Blocks cross-site writes even if a cookie leaks into a cross-site context.
export function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

export async function requireAdmin(env, request) {
  if (!sameOrigin(request)) return error("Bad origin", 403);
  if (!(await isAuthed(env, request))) return error("Not logged in", 401);
  return null;
}
