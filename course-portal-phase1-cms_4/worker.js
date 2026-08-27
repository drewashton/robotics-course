// Single entry point for the Worker. Cloudflare serves any request that
// matches a real file in the site (index.html, style.css, admin/*, images)
// automatically, without this code ever running. Only requests that don't
// match a static file — every /api/* route — reach this fetch handler.

import { onRequestGet as streamsGet } from "./functions/api/streams.js";
import { onRequestGet as filesGet } from "./functions/api/files/[[path]].js";

import { onRequestPost as loginPost } from "./functions/api/admin/login.js";
import { onRequestPost as logoutPost } from "./functions/api/admin/logout.js";
import { onRequestGet as sessionGet } from "./functions/api/admin/session.js";
import { onRequestPost as setupPost } from "./functions/api/admin/setup.js";

import {
  onRequestGet as instructorsGet,
  onRequestPost as instructorsPost,
} from "./functions/api/admin/instructors.js";

import {
  onRequestGet as adminStreamsGet,
  onRequestPut as adminStreamsPut,
} from "./functions/api/admin/streams.js";

import {
  onRequestPost as unitsPost,
  onRequestPut as unitsPut,
  onRequestDelete as unitsDelete,
} from "./functions/api/admin/units.js";

import {
  onRequestPost as lessonsPost,
  onRequestPut as lessonsPut,
  onRequestDelete as lessonsDelete,
} from "./functions/api/admin/lessons.js";

import { onRequestPost as reorderPost } from "./functions/api/admin/reorder.js";
import { onRequestPost as uploadPost } from "./functions/api/admin/upload.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const context = { request, env, ctx };

    try {
      if (path === "/api/streams" && method === "GET") return streamsGet(context);

      if (path === "/api/admin/login" && method === "POST") return loginPost(context);
      if (path === "/api/admin/logout" && method === "POST") return logoutPost(context);
      if (path === "/api/admin/session" && method === "GET") return sessionGet(context);
      if (path === "/api/admin/setup" && method === "POST") return setupPost(context);

      if (path === "/api/admin/instructors" && method === "GET") return instructorsGet(context);
      if (path === "/api/admin/instructors" && method === "POST") return instructorsPost(context);

      if (path === "/api/admin/streams" && method === "GET") return adminStreamsGet(context);
      if (path === "/api/admin/streams" && method === "PUT") return adminStreamsPut(context);

      if (path === "/api/admin/units" && method === "POST") return unitsPost(context);
      if (path === "/api/admin/units" && method === "PUT") return unitsPut(context);
      if (path === "/api/admin/units" && method === "DELETE") return unitsDelete(context);

      if (path === "/api/admin/lessons" && method === "POST") return lessonsPost(context);
      if (path === "/api/admin/lessons" && method === "PUT") return lessonsPut(context);
      if (path === "/api/admin/lessons" && method === "DELETE") return lessonsDelete(context);

      if (path === "/api/admin/reorder" && method === "POST") return reorderPost(context);
      if (path === "/api/admin/upload" && method === "POST") return uploadPost(context);

      if (path.startsWith("/api/files/") && method === "GET") {
        const key = path.slice("/api/files/".length);
        return filesGet({ ...context, params: { path: key.split("/") } });
      }

      return new Response("Not found", { status: 404 });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};
