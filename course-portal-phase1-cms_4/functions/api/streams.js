// Public endpoint — no auth. Streams are fixed and always returned. Each
// carries only its PUBLISHED units, and each of those only its PUBLISHED
// lessons. Assignments/Resources belong to the unit as a whole.

export async function onRequestGet({ env }) {
  const { results: streams } = await env.DB.prepare(
    "SELECT id, stream_key, name, description, objectives_html, schedule_html FROM streams ORDER BY sort_order"
  ).all();

  const { results: units } = await env.DB.prepare(
    "SELECT id, stream_id, unit_label, title, assignments_html, resources_html FROM units WHERE published = 1 ORDER BY sort_order"
  ).all();

  const { results: lessons } = await env.DB.prepare(
    "SELECT id, unit_id, title, content_html FROM lessons WHERE published = 1 ORDER BY sort_order"
  ).all();

  const data = streams.map((s) => ({
    key: s.stream_key,
    name: s.name,
    description: s.description,
    objectives: s.objectives_html,
    schedule: s.schedule_html,
    units: units
      .filter((u) => u.stream_id === s.id)
      .map((u) => ({
        id: u.id,
        unit: u.unit_label,
        title: u.title,
        assignments: u.assignments_html,
        resources: u.resources_html,
        lessons: lessons
          .filter((l) => l.unit_id === u.id)
          .map((l) => ({ id: l.id, title: l.title, content: l.content_html })),
      })),
  }));

  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30" },
  });
}
