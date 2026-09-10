import { clearSessionCookie, json } from "../../_utils/auth.js";

export async function onRequestPost() {
  return json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
}
