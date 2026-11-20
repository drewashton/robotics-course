// Public: how the internal portal's landing page is arranged.
import { getLayout } from "../_utils/layout.js";

export async function onRequestGet({ env }) {
  const layout = await getLayout(env);
  return new Response(JSON.stringify(layout), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30" },
  });
}
