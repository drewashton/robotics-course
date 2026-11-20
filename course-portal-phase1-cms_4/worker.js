// Single entry point for the whole portal at portal.pentictonrobotics.ca:
//   /                     the portal home (internal/index.html)
//   /prepteam             the Prep Team learning platform (index.html)
//   /prepteam/build/...   a learning stream, unit, and lesson
//   /competitionteam, /roles, /parents, ...   internal sections
//   /admin/               the Admin Panel
// Both apps share one database and the same files. wrangler.jsonc sends every
// request here first (run_worker_first). The addresses above are not real
// files, so for them this picks which app to load and the app reads the rest
// of the address itself. The old course. and internal. addresses forward to
// the matching portal address.

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

const PORTAL_HOST = "portal.pentictonrobotics.ca";
const LEARNING = "prepteam";

function redirect(url, pathname, host) {
  const target = new URL(url);
  if (host) {
    target.protocol = "https:";
    target.hostname = host;
    target.port = "";
  }
  target.pathname = pathname;
  return Response.redirect(target.toString(), 301);
}

// The learning platform's stream keys (build, programming, ...), so that
// /prepteam/build opens the learning platform while /prepteam/onboarding
// (a Prep Team page of the internal portal) opens the portal.
async function learningKeys(env) {
  try {
    const { results } = await env.DB.prepare("SELECT stream_key FROM streams WHERE site = 'course'").all();
    return new Set(results.map((r) => r.stream_key));
  } catch (e) {
    return new Set();
  }
}

async function serveSite(request, env, url) {
  const path = url.pathname;
  const host = url.hostname;
  const isRead = request.method === "GET" || request.method === "HEAD";
  if (!isRead) return env.ASSETS.fetch(request);

  // Old addresses forward to the portal.
  if (host.startsWith("course.")) {
    return redirect(url, path === "/" || path === "/index.html" ? "/" + LEARNING : path, PORTAL_HOST);
  }
  if (host.startsWith("internal.")) {
    return redirect(url, path === "/internal" || path === "/internal/" ? "/" : path, PORTAL_HOST);
  }

  if (path === "/internal" || path === "/internal/") return redirect(url, "/");
  if (path === "/index.html") return redirect(url, "/" + LEARNING);
  if (path === "/admin") return redirect(url, "/admin/");

  // Real files (images, scripts, styles) and the Admin Panel come straight
  // from the static files.
  const lastPart = path.split("/").pop();
  if (lastPart.includes(".") || path === "/admin" || path.startsWith("/admin/") || path.startsWith("/internal/")) {
    return env.ASSETS.fetch(request);
  }

  if (path.length > 1 && path.endsWith("/")) return redirect(url, path.replace(/\/+$/, ""));

  const load = (file) => env.ASSETS.fetch(new Request(new URL(file, url), request));
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === LEARNING && (parts.length === 1 || (await learningKeys(env)).has(parts[1]))) {
    return load("/");
  }
  return load("/internal/");
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const context = { request, env, ctx };

    try {
      if (!path.startsWith("/api/")) return await serveSite(request, env, url);

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
