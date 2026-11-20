import { requireAuth, json } from "../../_utils/auth.js";
import { getLayout, saveLayout } from "../../_utils/layout.js";

// The landing page layout: heading text, buttons, and the boxes with their
// sections. Any signed-in mentor can edit it.

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.authorized) return auth.response;
  return json(await getLayout(env));
}

export async function onRequestPut({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.authorized) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return json({ error: "Nothing to save" }, { status: 400 });

  try {
    return json(await saveLayout(env, body));
  } catch (e) {
    return json({ error: "Couldn't save the layout. Try again in a moment." }, { status: 500 });
  }
}
