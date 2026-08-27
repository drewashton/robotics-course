import { requireAuth, json } from "../../_utils/auth.js";

// Units are folders inside a stream. Instructors can freely create, rename,
// publish/unpublish, and delete them. Assignments and Resources belong here
// (shared across every lesson in the unit) — individual lesson content is
// managed separately via /api/admin/lessons.

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.authorized) return auth.response;

  const { stream_id, unit_label, title } = await request.json().catch(() => ({}));
  if (!stream_id || !unit_label || !title) {
    return json({ error: "stream_id, unit_label, and title are required" }, { status: 400 });
  }

  const row = await env.DB.prepare("SELECT COALESCE(MAX(sort_order), 0) as max FROM units WHERE stream_id = ?")
    .bind(stream_id)
    .first();

  const inserted = await env.DB.prepare(
    "INSERT INTO units (stream_id, unit_label, title, sort_order) VALUES (?, ?, ?, ?) RETURNING id"
  )
    .bind(stream_id, unit_label, title, row.max + 1)
    .first();

  return json({ id: inserted.id });
}

export async function onRequestPut({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.authorized) return auth.response;

  const { id, unit_label, title, assignments_html, resources_html, published } =
    await request.json().catch(() => ({}));
  if (!id) return json({ error: "id is required" }, { status: 400 });

  await env.DB.prepare(
    `UPDATE units SET
       unit_label = COALESCE(?, unit_label),
       title = COALESCE(?, title),
       assignments_html = COALESCE(?, assignments_html),
       resources_html = COALESCE(?, resources_html),
       published = COALESCE(?, published)
     WHERE id = ?`
  )
    .bind(
      unit_label ?? null,
      title ?? null,
      assignments_html ?? null,
      resources_html ?? null,
      published === undefined ? null : published ? 1 : 0,
      id
    )
    .run();

  return json({ ok: true });
}

// Deleting a unit deletes every lesson inside it.
export async function onRequestDelete({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.authorized) return auth.response;

  const { id } = await request.json().catch(() => ({}));
  if (!id) return json({ error: "id is required" }, { status: 400 });

  await env.DB.batch([
    env.DB.prepare("DELETE FROM lessons WHERE unit_id = ?").bind(id),
    env.DB.prepare("DELETE FROM units WHERE id = ?").bind(id),
  ]);

  return json({ ok: true });
}
