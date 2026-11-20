import { requireAuth, json } from "../../_utils/auth.js";

const MAX_MENTORS_PER_STREAM = 3;      // learning platform streams
const MAX_CONTACTS_PER_SECTION = 8;    // internal portal sections

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.authorized) return auth.response;

  const { stream_id, name, title, description, email, photo_url } = await request.json().catch(() => ({}));
  if (!stream_id || !name) {
    return json({ error: "stream_id and name are required" }, { status: 400 });
  }

  const stream = await env.DB.prepare("SELECT site FROM streams WHERE id = ?").bind(stream_id).first();
  if (!stream) return json({ error: "Section not found" }, { status: 404 });
  const limit = stream.site === "internal" ? MAX_CONTACTS_PER_SECTION : MAX_MENTORS_PER_STREAM;

  const count = await env.DB.prepare("SELECT COUNT(*) as count FROM mentors WHERE stream_id = ?")
    .bind(stream_id)
    .first();
  if (count.count >= limit) {
    return json({ error: `This ${stream.site === "internal" ? "section" : "stream"} can only have up to ${limit} contacts` }, { status: 400 });
  }

  const row = await env.DB.prepare("SELECT COALESCE(MAX(sort_order), 0) as max FROM mentors WHERE stream_id = ?")
    .bind(stream_id)
    .first();

  const inserted = await env.DB.prepare(
    "INSERT INTO mentors (stream_id, name, title, description, email, photo_url, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id"
  )
    .bind(stream_id, name, title || "", description || "", email || "", photo_url || "", row.max + 1)
    .first();

  return json({ id: inserted.id });
}

export async function onRequestPut({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.authorized) return auth.response;

  const { id, name, title, description, email, photo_url } = await request.json().catch(() => ({}));
  if (!id) return json({ error: "id is required" }, { status: 400 });

  await env.DB.prepare(
    `UPDATE mentors SET
       name = COALESCE(?, name),
       title = COALESCE(?, title),
       description = COALESCE(?, description),
       email = COALESCE(?, email),
       photo_url = COALESCE(?, photo_url)
     WHERE id = ?`
  )
    .bind(name ?? null, title ?? null, description ?? null, email ?? null, photo_url ?? null, id)
    .run();

  return json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.authorized) return auth.response;

  const { id } = await request.json().catch(() => ({}));
  if (!id) return json({ error: "id is required" }, { status: 400 });

  await env.DB.prepare("DELETE FROM mentors WHERE id = ?").bind(id).run();
  return json({ ok: true });
}
