import { requireAuth, json } from "../../_utils/auth.js";

// Body: { table: "units" | "lessons", orderedIds: [id, id, ...] } in the
// new top-to-bottom order. Works for reordering unit folders within a
// stream, or lessons within a unit — same operation, different table.
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.authorized) return auth.response;

  const { table, orderedIds } = await request.json().catch(() => ({}));
  if ((table !== "units" && table !== "lessons") || !Array.isArray(orderedIds) || orderedIds.length === 0) {
    return json({ error: "table must be 'units' or 'lessons', and orderedIds must be a non-empty array" }, { status: 400 });
  }

  const statements = orderedIds.map((id, index) =>
    env.DB.prepare(`UPDATE ${table} SET sort_order = ? WHERE id = ?`).bind(index + 1, id)
  );
  await env.DB.batch(statements);

  return json({ ok: true });
}
