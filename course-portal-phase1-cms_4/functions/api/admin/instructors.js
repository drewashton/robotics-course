import { requireAuth, hashPassword, json } from "../../_utils/auth.js";

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
