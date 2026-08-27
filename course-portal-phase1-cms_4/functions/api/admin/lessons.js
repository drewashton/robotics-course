import { requireAuth, json } from "../../_utils/auth.js";

// A lesson is one entry in a unit's Lessons list — just a title and its own
// content. Assignments and Resources live on the unit instead.

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.authorized) return auth.response;

  const { unit_id, title } = await request.json().catch(() => ({}));
  if (!unit_id || !title) {
    return json({ error: "unit_id and title are required" }, { status: 400 });
  }

  const row = await env.DB.prepare("SELECT COALESCE(MAX(sort_order), 0) as max FROM lessons WHERE unit_id = ?")
    .bind(unit_id)
    .first();

  const inserted = await env.DB.prepare(
    "INSERT INTO lessons (unit_id, title, sort_order) VALUES (?, ?, ?) RETURNING id"
  )
    .bind(unit_id, title, row.max + 1)
    .first();

  return json({ id: inserted.id });
}

export async function onRequestPut({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.authorized) return auth.response;

  const { id, title, content_html, published } = await request.json().catch(() => ({}));
  if (!id) return json({ error: "id is required" }, { status: 400 });

  await env.DB.prepare(
    `UPDATE lessons SET
       title = COALESCE(?, title),
       content_html = COALESCE(?, content_html),
       published = COALESCE(?, published),
       updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(title ?? null, content_html ?? null, published === undefined ? null : published ? 1 : 0, id)
    .run();

  return json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.authorized) return auth.response;

  const { id } = await request.json().catch(() => ({}));
  if (!id) return json({ error: "id is required" }, { status: 400 });

  await env.DB.prepare("DELETE FROM lessons WHERE id = ?").bind(id).run();
  return json({ ok: true });
}
