import { json, error, requireAdmin } from "../../lib/lib.js";

const ALLOWED = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};
const MAX_BYTES = 95 * 1024 * 1024; // Cloudflare request limit on Free plan is 100 MB

// POST /api/media  (raw body, headers: content-type, x-file-name) — admin only.
// Streams the upload straight into R2 and returns its public URL.
export async function onRequestPost({ env, request }) {
  const denied = await requireAdmin(env, request);
  if (denied) return denied;
  if (!env.MEDIA) return error("R2 binding MEDIA is not configured", 500);

  const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const ext = ALLOWED[type];
  if (!ext) return error(`File type ${type || "unknown"} is not supported`, 415);
  const size = Number(request.headers.get("content-length") || 0);
  if (size > MAX_BYTES) return error("File is larger than 95 MB. Compress the video and try again.", 413);

  const folder = type.startsWith("video/") ? "videos" : "images";
  const original = (request.headers.get("x-file-name") || "file").replace(/\.[^.]+$/, "");
  const slug = original.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "file";
  const key = `${folder}/${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}-${slug}.${ext}`;

  await env.MEDIA.put(key, request.body, {
    httpMetadata: { contentType: type, cacheControl: "public, max-age=31536000, immutable" },
  });
  return json({ key, url: `/media/${key}`, type });
}

// DELETE /api/media?key=images/... — admin only.
export async function onRequestDelete({ env, request }) {
  const denied = await requireAdmin(env, request);
  if (denied) return denied;
  if (!env.MEDIA) return error("R2 binding MEDIA is not configured", 500);
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!/^(images|videos)\/[a-z0-9.-]+$/.test(key)) return error("Bad key");
  await env.MEDIA.delete(key);
  return json({ deleted: key });
}
