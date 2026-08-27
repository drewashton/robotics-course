import { requireAuth, json } from "../../_utils/auth.js";

// Body: { table: "units" | "lessons" | "assignments" | "resources" | "mentors", orderedIds: [id, id, ...] }
// in the new top-to-bottom order.
const ALLOWED_TABLES = new Set(["units", "lessons", "assignments", "resources", "mentors"]);

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.authorized) return auth.response;

  const { table, orderedIds } = await request.json().catch(() => ({}));
  if (!ALLOWED_TABLES.has(table) || !Array.isArray(orderedIds) || orderedIds.length === 0) {
    return json({ error: "table must be one of units/lessons/assignments/resources/mentors, and orderedIds must be a non-empty array" }, { status: 400 });
  }

  const statements = orderedIds.map((id, index) =>
    env.DB.prepare(`UPDATE ${table} SET sort_order = ? WHERE id = ?`).bind(index + 1, id)
  );
  await env.DB.batch(statements);

  return json({ ok: true });
}
