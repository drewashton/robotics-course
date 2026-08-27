import { requireAuth, json } from "../../_utils/auth.js";

// Streams are fixed (business/build/programming) — no create or delete.
// Returns the full tree (every unit and lesson, including unpublished) for
// the admin panel, and lets instructors edit a stream's syllabus info.

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.authorized) return auth.response;

  const { results: streams } = await env.DB.prepare(
    "SELECT id, stream_key, name, description, objectives_html, schedule_html, sort_order FROM streams ORDER BY sort_order"
  ).all();
  const { results: units } = await env.DB.prepare(
    "SELECT id, stream_id, unit_label, title, assignments_html, resources_html, published, sort_order FROM units ORDER BY sort_order"
  ).all();
  const { results: lessons } = await env.DB.prepare(
    "SELECT id, unit_id, title, content_html, published, sort_order FROM lessons ORDER BY sort_order"
  ).all();

  const data = streams.map((s) => ({
    ...s,
    units: units
      .filter((u) => u.stream_id === s.id)
      .map((u) => ({
        ...u,
        lessons: lessons.filter((l) => l.unit_id === u.id),
      })),
  }));

  return json(data);
}

// Edit a stream's syllabus: name, intro description, learning objectives,
// and recommended schedule. Cannot change stream_key or create/delete streams.
export async function onRequestPut({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.authorized) return auth.response;

  const { id, name, description, objectives_html, schedule_html } = await request.json().catch(() => ({}));
  if (!id) return json({ error: "id is required" }, { status: 400 });

  await env.DB.prepare(
    `UPDATE streams SET
       name = COALESCE(?, name),
       description = COALESCE(?, description),
       objectives_html = COALESCE(?, objectives_html),
       schedule_html = COALESCE(?, schedule_html)
     WHERE id = ?`
  )
    .bind(name ?? null, description ?? null, objectives_html ?? null, schedule_html ?? null, id)
    .run();

  return json({ ok: true });
}
