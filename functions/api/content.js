import { json, error, loadContent, saveContent, defaultContent, requireAdmin } from "../../lib/lib.js";

// GET /api/content — public, returns current site content.
export async function onRequestGet({ env }) {
  const content = await loadContent(env);
  return json(content, 200, { "cache-control": "no-cache" });
}

// PUT /api/content — admin only, replaces the whole content document.
export async function onRequestPut({ env, request }) {
  const denied = await requireAdmin(env, request);
  if (denied) return denied;
  let body;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON");
  }
  if (!body || typeof body !== "object" || !body.site || !body.portfolio) return error("Content shape is invalid");
  const raw = JSON.stringify(body);
  if (raw.length > 1_000_000) return error("Content is too large", 413);
  return json(await saveContent(env, body));
}

// POST /api/content?reset=1 — admin only, restores defaults (media files stay in storage).
export async function onRequestPost({ env, request }) {
  const denied = await requireAdmin(env, request);
  if (denied) return denied;
  if (new URL(request.url).searchParams.get("reset") !== "1") return error("Unknown action");
  return json(await saveContent(env, defaultContent()));
}
