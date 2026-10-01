// GET /media/<key> — serves files from R2 with range support (needed for video seeking on iPhone).
export async function onRequestGet({ env, request, params }) {
  if (!env.MEDIA) return new Response("Storage is not configured", { status: 500 });
  const key = (Array.isArray(params.path) ? params.path : [params.path]).join("/");
  if (!/^(images|videos)\/[a-z0-9.-]+$/.test(key)) return new Response("Not found", { status: 404 });

  const rangeHeader = request.headers.get("range");
  let range;
  if (rangeHeader) {
    const m = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (m) {
      if (m[1] === "" && m[2] !== "") range = { suffix: Number(m[2]) };
      else range = { offset: Number(m[1]), ...(m[2] !== "" ? { length: Number(m[2]) - Number(m[1]) + 1 } : {}) };
    }
  }

  const obj = await env.MEDIA.get(key, range ? { range } : {});
  if (!obj) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("accept-ranges", "bytes");
  if (!headers.has("cache-control")) headers.set("cache-control", "public, max-age=31536000, immutable");

  if (range && obj.range) {
    const start = obj.range.offset ?? obj.size - obj.range.suffix;
    const length = obj.range.length ?? obj.size - start;
    headers.set("content-range", `bytes ${start}-${start + length - 1}/${obj.size}`);
    headers.set("content-length", String(length));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set("content-length", String(obj.size));
  return new Response(obj.body, { headers });
}
