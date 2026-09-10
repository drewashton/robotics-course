import { getSession, json } from "../../_utils/auth.js";

export async function onRequestGet({ request, env }) {
  const session = await getSession(request, env.SESSION_SECRET);
  if (!session) return json({ authenticated: false }, { status: 401 });
  return json({ authenticated: true, id: session.id, name: session.name, email: session.email });
}
