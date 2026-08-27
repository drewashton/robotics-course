import { requireAuth, json } from "../../_utils/auth.js";

// Streams are fixed (business/build/programming) — no create or delete.
// Returns the full tree (every unit, its lessons/assignments/resources —
// including unpublished — and the stream's mentors) for the admin panel.

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.authorized) return auth.response;

  const { results: streams } = await env.DB.prepare(
    "SELECT id, stream_key, name, description, objectives_html, schedule_html, sort_order FROM streams ORDER BY sort_order"
  ).all();
  const { results: units } = await env.DB.prepare(
    "SELECT id, stream_id, unit_label, title, published, sort_order FROM units ORDER BY sort_order"
  ).all();
  const { results: lessons } = await env.DB.prepare(
    "SELECT id, unit_id, title, content_html, published, sort_order FROM lessons ORDER BY sort_order"
  ).all();
  const { results: assignments } = await env.DB.prepare(
    "SELECT id, unit_id, title, content_html, published, sort_order FROM assignments ORDER BY sort_order"
  ).all();
  const { results: resources } = await env.DB.prepare(
    "SELECT id, unit_id, title, content_html, published, sort_order FROM resources ORDER BY sort_order"
  ).all();
  const { results: mentors } = await env.DB.prepare(
    "SELECT id, stream_id, name, title, description, email, photo_url, sort_order FROM mentors ORDER BY sort_order"
  ).all();

  const data = streams.map((s) => ({
    ...s,
    mentors: mentors.filter((m) => m.stream_id === s.id),
    units: units
      .filter((u) => u.stream_id === s.id)
      .map((u) => ({
        ...u,
        lessons: lessons.filter((l) => l.unit_id === u.id),
        assignments: assignments.filter((a) => a.unit_id === u.id),
        resources: resources.filter((r) => r.unit_id === u.id),
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
