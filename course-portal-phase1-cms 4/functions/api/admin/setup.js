// One-time bootstrap: creates the FIRST instructor account so you have a way
// in before any admin UI login exists. Protected by a SETUP_TOKEN secret you
// set yourself, and refuses to run again once any instructor exists.
//
// Usage (see README-DEPLOYMENT.md):
//   curl -X POST https://course.pentictonrobotics.ca/api/admin/setup \
//     -H "X-Setup-Token: <your SETUP_TOKEN>" \
//     -H "Content-Type: application/json" \
//     -d '{"name":"Jane Mentor","email":"jane@example.com","password":"choose-a-strong-password"}'

import { hashPassword, json } from "../../_utils/auth.js";

export async function onRequestPost({ request, env }) {
  const token = request.headers.get("X-Setup-Token");
  if (!env.SETUP_TOKEN || token !== env.SETUP_TOKEN) {
    return json({ error: "Not authorized" }, { status: 401 });
  }

  const existing = await env.DB.prepare("SELECT COUNT(*) as count FROM instructors").first();
  if (existing.count > 0) {
    return json(
      { error: "Setup already completed. Add further instructors from the admin panel instead." },
      { status: 409 }
    );
  }

  const { name, email, password } = await request.json().catch(() => ({}));
  if (!name || !email || !password) {
    return json({ error: "name, email, and password are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const password_hash = await hashPassword(password);
  await env.DB.prepare("INSERT INTO instructors (name, email, password_hash) VALUES (?, ?, ?)")
    .bind(name, email.toLowerCase().trim(), password_hash)
    .run();

  return json({ ok: true });
}
