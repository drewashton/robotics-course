// Serves uploaded files back out of R2. Public/no-auth on purpose: images and
// PDFs embedded in a *published* lesson need to load for students who aren't
// logged in. Unpublished lessons simply aren't linked anywhere public, so
// their attachments are only reachable if you already have the exact URL.

export async function onRequestGet({ params, env }) {
  const key = Array.isArray(params.path) ? params.path.join("/") : params.path;
  if (!key) return new Response("Not found", { status: 404 });

  const object = await env.UPLOADS.get(key);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("ETag", object.httpEtag);

  return new Response(object.body, { headers });
}
