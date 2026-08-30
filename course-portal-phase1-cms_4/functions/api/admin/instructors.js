import { requireAuth, hashPassword, json } from "../../_utils/auth.js";

// Only the site owner can add new instructor accounts.
const OWNER_EMAIL = "drew@dashdigital.ca";

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.authorized) return auth.response;

  const { results } = await env.DB.prepare(
    "SELECT id, name, email, created_at FROM instructors ORDER BY created_at"
  ).all();
  return json(results);
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.authorized) return auth.response;

  if (auth.session.email.toLowerCase().trim() !== OWNER_EMAIL) {
    return json({ error: "Only the site owner can add instructor accounts" }, { status: 403 });
  }

  const { name, email, password } = await request.json().catch(() => ({}));
  if (!name || !email || !password) {
    return json({ error: "name, email, and password are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const password_hash = await hashPassword(password);
  try {
    await env.DB.prepare("INSERT INTO instructors (name, email, password_hash) VALUES (?, ?, ?)")
      .bind(name, email.toLowerCase().trim(), password_hash)
      .run();
  } catch (e) {
    return json({ error: "That email is already registered" }, { status: 409 });
  }
  return json({ ok: true });
}

// Only the site owner can remove instructor accounts, and can't remove
// their own — that would risk locking everyone out with no way back in.
export async function onRequestDelete({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.authorized) return auth.response;

  if (auth.session.email.toLowerCase().trim() !== OWNER_EMAIL) {
    return json({ error: "Only the site owner can remove instructor accounts" }, { status: 403 });
  }

  const { id } = await request.json().catch(() => ({}));
  if (!id) return json({ error: "id is required" }, { status: 400 });

  if (Number(id) === Number(auth.session.id)) {
    return json({ error: "You can't remove your own account" }, { status: 400 });
  }

  await env.DB.prepare("DELETE FROM instructors WHERE id = ?").bind(id).run();
  return json({ ok: true });
}
