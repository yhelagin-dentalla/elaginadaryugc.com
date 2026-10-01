import { json, error, checkPassword, makeSessionCookie, clearSessionCookie, isAuthed, sameOrigin } from "../../lib/lib.js";

// POST /api/session {password} — log in. DELETE — log out. GET — check.
export async function onRequestGet({ env, request }) {
  return json({ authed: await isAuthed(env, request), configured: Boolean(env.ADMIN_PASSWORD), storage: Boolean(env.MEDIA && env.CONTENT) });
}

export async function onRequestPost({ env, request }) {
  if (!sameOrigin(request)) return error("Bad origin", 403);
  if (!env.ADMIN_PASSWORD) return error("ADMIN_PASSWORD is not set in Cloudflare", 500);
  let password = "";
  try {
    ({ password } = await request.json());
  } catch {}
  if (!(await checkPassword(env, password))) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return error("Wrong password", 401);
  }
  return json({ authed: true }, 200, { "set-cookie": await makeSessionCookie(env, request) });
}

export async function onRequestDelete() {
  return json({ authed: false }, 200, { "set-cookie": clearSessionCookie() });
}
