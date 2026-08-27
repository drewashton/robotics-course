import { verifyPassword, createSessionCookie, json } from "../../_utils/auth.js";

export async function onRequestPost({ request, env }) {
  const { email, password } = await request.json().catch(() => ({}));
  if (!email || !password) {
    return json({ error: "Email and password are required" }, { status: 400 });
  }

  const instructor = await env.DB.prepare(
    "SELECT id, name, email, password_hash FROM instructors WHERE email = ?"
  )
    .bind(email.toLowerCase().trim())
    .first();

  if (!instructor || !(await verifyPassword(password, instructor.password_hash))) {
    return json({ error: "Incorrect email or password" }, { status: 401 });
  }

  const cookie = await createSessionCookie(instructor, env.SESSION_SECRET);
  return json(
    { id: instructor.id, name: instructor.name, email: instructor.email },
    { headers: { "Set-Cookie": cookie } }
  );
}
