import { requireAuth, verifyPassword, hashPassword, json } from "../../_utils/auth.js";

// Any logged-in instructor can change their OWN password — this is what
// makes a newly-issued password genuinely "temporary" rather than
// permanent, since there'd otherwise be no way to change it after logging in.
export async function onRequestPut({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.authorized) return auth.response;

  const { current_password, new_password } = await request.json().catch(() => ({}));
  if (!current_password || !new_password) {
    return json({ error: "current_password and new_password are required" }, { status: 400 });
  }
  if (new_password.length < 8) {
    return json({ error: "New password must be at least 8 characters" }, { status: 400 });
  }

  const instructor = await env.DB.prepare("SELECT password_hash FROM instructors WHERE id = ?")
    .bind(auth.session.id)
    .first();
  if (!instructor || !(await verifyPassword(current_password, instructor.password_hash))) {
    return json({ error: "Current password is incorrect" }, { status: 401 });
  }

  const password_hash = await hashPassword(new_password);
  await env.DB.prepare("UPDATE instructors SET password_hash = ? WHERE id = ?")
    .bind(password_hash, auth.session.id)
    .run();

  return json({ ok: true });
}
