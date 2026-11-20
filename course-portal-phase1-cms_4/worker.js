// Single entry point for the Worker, shared by two sites:
//   course.pentictonrobotics.ca    - the Prep Team learning platform (/)
//   internal.pentictonrobotics.ca  - the internal program portal (/internal/)
// Both use the same database, the same /admin Admin Panel, and the same
// files. wrangler.jsonc sends every request here first (run_worker_first),
// so the only job for non-API requests is picking the right home page for
// the hostname; everything else is served straight from the static files.

import { onRequestGet as streamsGet } from "./functions/api/streams.js";
import { onRequestGet as layoutGet } from "./functions/api/layout.js";
import { onRequestGet as filesGet } from "./functions/api/files/[[path]].js";

import { onRequestPost as loginPost } from "./functions/api/admin/login.js";
import { onRequestPost as logoutPost } from "./functions/api/admin/logout.js";
import { onRequestGet as sessionGet } from "./functions/api/admin/session.js";
import { onRequestPost as setupPost } from "./functions/api/admin/setup.js";

import {
  onRequestGet as instructorsGet,
  onRequestPost as instructorsPost,
  onRequestDelete as instructorsDelete,
} from "./functions/api/admin/instructors.js";

import {
  onRequestGet as adminStreamsGet,
  onRequestPut as adminStreamsPut,
  onRequestPost as adminStreamsPost,
  onRequestDelete as adminStreamsDelete,
} from "./functions/api/admin/streams.js";

import {
  onRequestGet as adminLayoutGet,
  onRequestPut as adminLayoutPut,
} from "./functions/api/admin/layout.js";

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

import {
  onRequestPost as assignmentsPost,
  onRequestPut as assignmentsPut,
  onRequestDelete as assignmentsDelete,
} from "./functions/api/admin/assignments.js";

import {
  onRequestPost as resourcesPost,
  onRequestPut as resourcesPut,
  onRequestDelete as resourcesDelete,
} from "./functions/api/admin/resources.js";

import {
  onRequestPost as mentorsPost,
  onRequestPut as mentorsPut,
  onRequestDelete as mentorsDelete,
} from "./functions/api/admin/mentors.js";

import { onRequestPut as passwordPut } from "./functions/api/admin/password.js";
import { onRequestPost as reorderPost } from "./functions/api/admin/reorder.js";
import { onRequestPost as uploadPost } from "./functions/api/admin/upload.js";

// The internal site's home page lives at /internal/. On the internal
// hostname, "/" quietly shows it (the address bar stays clean). Every other
// path - /style.css, /pr_logo2x.PNG, /admin/, /internal/app.js - is the same
// file on both hostnames. The internal portal is also always reachable at
// /internal/ on any hostname, which is handy for testing before the
// internal. domain is connected.
function serveSite(request, env, url) {
  const isInternalHost = url.hostname.startsWith("internal.");
  if (isInternalHost && (url.pathname === "/" || url.pathname === "/index.html")) {
    return env.ASSETS.fetch(new Request(new URL("/internal/", url), request));
  }
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const context = { request, env, ctx };

    try {
      if (!path.startsWith("/api/")) return serveSite(request, env, url);

      if (path === "/api/streams" && method === "GET") return streamsGet(context);
      if (path === "/api/layout" && method === "GET") return layoutGet(context);

      if (path === "/api/admin/login" && method === "POST") return loginPost(context);
      if (path === "/api/admin/logout" && method === "POST") return logoutPost(context);
      if (path === "/api/admin/session" && method === "GET") return sessionGet(context);
      if (path === "/api/admin/setup" && method === "POST") return setupPost(context);

      if (path === "/api/admin/instructors" && method === "GET") return instructorsGet(context);
      if (path === "/api/admin/instructors" && method === "POST") return instructorsPost(context);
      if (path === "/api/admin/instructors" && method === "DELETE") return instructorsDelete(context);

      if (path === "/api/admin/streams" && method === "GET") return adminStreamsGet(context);
      if (path === "/api/admin/streams" && method === "PUT") return adminStreamsPut(context);
      if (path === "/api/admin/streams" && method === "POST") return adminStreamsPost(context);
      if (path === "/api/admin/streams" && method === "DELETE") return adminStreamsDelete(context);

      if (path === "/api/admin/layout" && method === "GET") return adminLayoutGet(context);
      if (path === "/api/admin/layout" && method === "PUT") return adminLayoutPut(context);

      if (path === "/api/admin/units" && method === "POST") return unitsPost(context);
      if (path === "/api/admin/units" && method === "PUT") return unitsPut(context);
      if (path === "/api/admin/units" && method === "DELETE") return unitsDelete(context);

      if (path === "/api/admin/lessons" && method === "POST") return lessonsPost(context);
      if (path === "/api/admin/lessons" && method === "PUT") return lessonsPut(context);
      if (path === "/api/admin/lessons" && method === "DELETE") return lessonsDelete(context);

      if (path === "/api/admin/assignments" && method === "POST") return assignmentsPost(context);
      if (path === "/api/admin/assignments" && method === "PUT") return assignmentsPut(context);
      if (path === "/api/admin/assignments" && method === "DELETE") return assignmentsDelete(context);

      if (path === "/api/admin/resources" && method === "POST") return resourcesPost(context);
      if (path === "/api/admin/resources" && method === "PUT") return resourcesPut(context);
      if (path === "/api/admin/resources" && method === "DELETE") return resourcesDelete(context);

      if (path === "/api/admin/mentors" && method === "POST") return mentorsPost(context);
      if (path === "/api/admin/mentors" && method === "PUT") return mentorsPut(context);
      if (path === "/api/admin/mentors" && method === "DELETE") return mentorsDelete(context);

      if (path === "/api/admin/password" && method === "PUT") return passwordPut(context);

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
