// Public endpoint - no auth. Streams are fixed and always returned, each
// with its mentor contacts. Each stream carries only its PUBLISHED units,
// and each of those only its PUBLISHED lessons/assignments/resources.

export async function onRequestGet({ env }) {
  const { results: streams } = await env.DB.prepare(
    "SELECT id, stream_key, name, description, objectives_html, schedule_html FROM streams ORDER BY sort_order"
  ).all();

  const { results: units } = await env.DB.prepare(
    "SELECT id, stream_id, unit_label, title FROM units WHERE published = 1 ORDER BY sort_order"
  ).all();

  const { results: lessons } = await env.DB.prepare(
    "SELECT id, unit_id, title, content_html FROM lessons WHERE published = 1 ORDER BY sort_order"
  ).all();
  const { results: assignments } = await env.DB.prepare(
    "SELECT id, unit_id, title, content_html FROM assignments WHERE published = 1 ORDER BY sort_order"
  ).all();
  const { results: resources } = await env.DB.prepare(
    "SELECT id, unit_id, title, content_html FROM resources WHERE published = 1 ORDER BY sort_order"
  ).all();

  const { results: mentors } = await env.DB.prepare(
    "SELECT id, stream_id, name, title, email, photo_url FROM mentors ORDER BY sort_order"
  ).all();

  const data = streams.map((s) => ({
    key: s.stream_key,
    name: s.name,
    description: s.description,
    objectives: s.objectives_html,
    schedule: s.schedule_html,
    mentors: mentors
      .filter((m) => m.stream_id === s.id)
      .map((m) => ({ name: m.name, title: m.title, email: m.email, photo: m.photo_url })),
    units: units
      .filter((u) => u.stream_id === s.id)
      .map((u) => ({
        id: u.id,
        unit: u.unit_label,
        title: u.title,
        lessons: lessons.filter((l) => l.unit_id === u.id).map((l) => ({ id: l.id, title: l.title, content: l.content_html })),
        assignments: assignments.filter((a) => a.unit_id === u.id).map((a) => ({ id: a.id, title: a.title, content: a.content_html })),
        resources: resources.filter((r) => r.unit_id === u.id).map((r) => ({ id: r.id, title: r.title, content: r.content_html })),
      })),
  }));

  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30" },
  });
}
