import { requireAuth, json } from "../../_utils/auth.js";

const MAX_BYTES = 25 * 1024 * 1024; // 25MB — plenty for lesson PDFs/images, well within R2 free tier

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.authorized) return auth.response;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || typeof file === "string") {
    return json({ error: "No file was uploaded" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return json({ error: "File is larger than the 25MB limit" }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;

  await env.UPLOADS.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });

  await env.DB.prepare(
    "INSERT INTO assets (r2_key, filename, content_type, size, uploaded_by) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(key, file.name, file.type || "application/octet-stream", file.size, auth.session.id)
    .run();

  return json({ key, url: `/api/files/${key}`, filename: file.name });
}
