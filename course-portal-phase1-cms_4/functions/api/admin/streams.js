import { requireAuth, json } from "../../_utils/auth.js";
import { getLayout, saveLayout, slugify } from "../../_utils/layout.js";

// The learning platform's three streams (business/build/programming) are
// fixed. Sections of the internal portal can be created and deleted from the
// Portal layout screen (POST and DELETE below).
// Returns the full tree (every unit, its lessons/assignments/resources -
// including unpublished - and the stream's mentors) for the admin panel.

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.authorized) return auth.response;

  const { results: streams } = await env.DB.prepare(
    "SELECT id, stream_key, name, description, objectives_html, schedule_html, sort_order, site FROM streams ORDER BY site, sort_order"
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

  try {
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
  } catch (e) {
    return json({ error: "Couldn't save - the content may be too large (this usually means a pasted-in image rather than one added via Attach file)." }, { status: 400 });
  }

  return json({ ok: true });
}

// Create a new internal-portal section and put it in a box on the landing
// page. Body: { name, box, inline }. inline = true means the section's groups
// are listed straight in the box; false means the box shows one row that
// opens the section. New sections start hidden until they are shown.
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.authorized) return auth.response;

  const { name, description, box, inline } = await request.json().catch(() => ({}));
  const title = typeof name === "string" ? name.trim().slice(0, 80) : "";
  if (!title || !box) return json({ error: "A name and a box are required" }, { status: 400 });

  const layout = await getLayout(env);
  const target = layout.boxes.find((b) => b.key === box);
  if (!target) return json({ error: "That box doesn't exist" }, { status: 400 });

  const { results: existing } = await env.DB.prepare("SELECT stream_key FROM streams").all();
  const key = slugify(title, new Set(existing.map((r) => r.stream_key)));
  const order = await env.DB.prepare("SELECT COALESCE(MAX(sort_order), 0) AS max FROM streams WHERE site = 'internal'").first();

  const created = await env.DB.prepare(
    "INSERT INTO streams (stream_key, name, description, sort_order, site) VALUES (?, ?, ?, ?, 'internal') RETURNING id"
  ).bind(key, title, typeof description === "string" ? description.trim().slice(0, 400) : "", order.max + 1).first();

  target.items.push({ stream: key, inline: Boolean(inline), hidden: true });
  await saveLayout(env, layout);

  return json({ id: created.id, key });
}

// Delete an internal-portal section with all its groups, pages, resources
// and contacts, and take it out of the landing page.
export async function onRequestDelete({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.authorized) return auth.response;

  const { id } = await request.json().catch(() => ({}));
  if (!id) return json({ error: "id is required" }, { status: 400 });

  const stream = await env.DB.prepare("SELECT id, stream_key, site FROM streams WHERE id = ?").bind(id).first();
  if (!stream) return json({ error: "Section not found" }, { status: 404 });
  if (stream.site !== "internal") return json({ error: "Only internal portal sections can be deleted" }, { status: 400 });

  await env.DB.batch([
    env.DB.prepare("DELETE FROM lessons WHERE unit_id IN (SELECT id FROM units WHERE stream_id = ?)").bind(id),
    env.DB.prepare("DELETE FROM assignments WHERE unit_id IN (SELECT id FROM units WHERE stream_id = ?)").bind(id),
    env.DB.prepare("DELETE FROM resources WHERE unit_id IN (SELECT id FROM units WHERE stream_id = ?)").bind(id),
    env.DB.prepare("DELETE FROM units WHERE stream_id = ?").bind(id),
    env.DB.prepare("DELETE FROM mentors WHERE stream_id = ?").bind(id),
    env.DB.prepare("DELETE FROM streams WHERE id = ?").bind(id),
  ]);

  const layout = await getLayout(env);
  layout.boxes.forEach((b) => { b.items = b.items.filter((it) => it.stream !== stream.stream_key); });
  await saveLayout(env, layout);

  return json({ ok: true });
}
