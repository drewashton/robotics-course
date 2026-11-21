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

// Preview text and image for each page, used when a link is shared (the
// title, description and picture that Messages, Slack and so on show) and for
// the tab title. The key is the first part of the address. Anything not
// listed here, such as a section added later, uses the portal home. The
// picture is always the team logo.
const META = {
  home: { title: "Program Portal - Penticton Robotics", desc: "Handbooks, resources and how our program runs, for students, parents and mentors." },
  prepteam: { title: "Prep Team - Penticton Robotics", desc: "Lessons, assignments and resources for the Prep Team." },
  competitionteam: { title: "Competition Team - Penticton Robotics", desc: "Handbooks, resources and the daily reflection for the competition team." },
  reflection: { title: "Daily Reflection - Penticton Robotics", desc: "Fill this out at the end of every meeting. It helps us give you a daily mark." },
  roles: { title: "Role Handbooks - Penticton Robotics", desc: "A handbook and resources for each role on the team." },
  parents: { title: "Parents - Penticton Robotics", desc: "Training, expectations and contacts for parent volunteers." },
  mentors: { title: "Mentors - Penticton Robotics", desc: "Training, expectations and resources for mentors." },
  "how-it-runs": { title: "How the Program Runs - Penticton Robotics", desc: "Everything about how our program works." },
  career: { title: "Career and Scholarships - Penticton Robotics", desc: "Certifications and scholarships for students." },
};

const NO_INDEX = "noindex, nofollow, noarchive";

function withMeta(response, url) {
  const type = response.headers.get("Content-Type") || "";
  if (!type.includes("text/html")) return response;
  const parts = url.pathname.split("/").filter(Boolean);
  const key = META[parts[0]] ? parts[0] : "home";
  const m = META[key];
  const image = `${url.origin}/pr_logo2x.PNG`;
  const set = (value) => ({ element(el) { el.setAttribute("content", value); } });
  return new HTMLRewriter()
    .on("title", { element(el) { el.setInnerContent(m.title); } })
    .on('meta[name="robots"]', set(NO_INDEX))
    .on('meta[name="description"]', set(m.desc))
    .on('meta[property="og:title"]', set(m.title))
    .on('meta[property="og:description"]', set(m.desc))
    .on('meta[property="og:url"]', set(url.origin + url.pathname))
    .on('meta[property="og:image"]', set(image))
    .on('meta[property="og:image:type"]', set("image/png"))
    .on('meta[property="og:image:width"]', set("2000"))
    .on('meta[property="og:image:height"]', set("2000"))
    .on('meta[property="og:image:alt"]', set("Penticton Robotics logo"))
    .on('meta[name="twitter:card"]', set("summary"))
    .on('meta[name="twitter:title"]', set(m.title))
    .on('meta[name="twitter:description"]', set(m.desc))
    .on('meta[name="twitter:image"]', set(image))
    .on('meta[name="apple-mobile-web-app-title"]', set(m.title))
    .transform(response);
}

// Nothing here is meant to be found through a search engine. Only people who
// have the link should get in, so every answer says "do not index".
function noIndex(response) {
  if (response.status >= 300 && response.status < 400) return response;
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", NO_INDEX);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
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
    return withMeta(await load("/"), url);
  }
  return withMeta(await load("/internal/"), url);
}

const app = {
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

export default {
  async fetch(request, env, ctx) {
    return noIndex(await app.fetch(request, env, ctx));
  },
};
